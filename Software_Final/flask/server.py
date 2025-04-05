from flask import Flask, request, jsonify
import requests
import time
import json
import random
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model

app = Flask(__name__)

# Global Variables
data_file_path = None
is_collecting = False
file_handle = None  # File handle for writing
imu_data = []  # Simulated IMU data
model_capital = None  # Loaded model for capital letters
model_small = None  # Loaded model for small letters
# for the ESP32 
sensor_url = 'http://192.168.68.118/motion'  
# for the ESP8266
sensor_url = 'http://192.168.226.171/motion'  
# Load both trained models
model_capital = load_model('capital_letter_model.h5', compile=False)
model_small = load_model('small_letter_model.h5', compile=False)

# Define class labels mapping (0-25 to A-Z for capital and a-z for small letters)
CLASS_LABELS_CAPITAL = {i: chr(65+i) for i in range(26)}  # 65 is ASCII for 'A'
CLASS_LABELS_SMALL = {i: chr(97+i) for i in range(26)}  # 97 is ASCII for 'a'

def preprocess_imu_data(raw_data, max_len=50):
    """Process raw IMU data for prediction with position handling"""
    try:
        data = np.array(raw_data, dtype=np.float32)

        # Ensure we have at least 6 columns (accelerometer + gyroscope)
        if data.shape[1] < 6:
            padded_data = np.zeros((len(data), 10))
            padded_data[:, :data.shape[1]] = data
            data = padded_data
        elif data.shape[1] == 6:
            # Pad 6 columns to 10 if needed
            padded_data = np.zeros((len(data), 10))
            padded_data[:, :6] = data
            data = padded_data

        # Handle NaN/Inf
        col_median = np.nanmedian(data, axis=0)
        data = np.where(np.isnan(data), col_median, data)

        # Robust scaling
        q05 = np.percentile(data, 5, axis=0)
        q95 = np.percentile(data, 95, axis=0)
        scale = q95 - q05
        scale[scale == 0] = 1  # Avoid division by zero
        data = (data - q05) / scale

        # Clip values
        data = np.clip(data, -5, 5)

        # Pad/truncate time steps
        if len(data) > max_len:
            data = data[:max_len]
        else:
            pad_len = max_len - len(data)
            data = np.pad(data, ((0, pad_len), (0, 0)), 'constant')

        return np.expand_dims(data, axis=0)

    except Exception as e:
        print(f"Error during preprocessing: {str(e)}")
        return None
def simulate_imu_data():
    """Simulate fetching IMU data from the ESP8266 sensor."""
    try:
        response = requests.get(sensor_url)
        if response.status_code == 200:
            print("Raw Response:\n", response.text)  # Print raw response for debugging
            data = response.text  # This should now correctly parse the JSON
            print(f"Data received from sensor: {data}")
            return data
        else:
            print("Error: Could not retrieve data from the sensor.")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from sensor: {e}")
        return None
    except ValueError as e:
        print(f"Error parsing JSON response: {e}")
        return None


def save_imu_data_to_file(file_handle):
    """Collect data for 5 seconds and store it into a file."""
    imu = simulate_imu_data()
        # Write the data in imu as imu_data.txt her e
    if imu:
        # Append the IMU data to the list
        imu_data.append(imu)
        # Write the data to the file
        file_handle.write(f"{imu}\n")
    else:
        print("No data received from sensor.")
    time.sleep(0.1)  # Simulating data collection interval


@app.route("/status", methods=["GET"])
def collection_status():
    """Check if data collection is active."""
    return jsonify({"is_collecting": is_collecting, "file": data_file_path})


@app.route("/collect", methods=["POST"])
def start_data_collection():
    """Start collecting IMU data for 5 seconds and return model output."""
    global is_collecting, imu_data, file_handle, data_file_path

    # Start data collection
    is_collecting = True
    imu_data = []  # Reset IMU data
    data_file_path = "imu_data.txt"
    file_handle = open(data_file_path, "w")

    # Collect data for 5 seconds
    save_imu_data_to_file(file_handle)

    # Close the file after collection
    file_handle.close()
    is_collecting = False

    # Read the collected IMU data from file
    try:
        with open(data_file_path, 'r') as f:
            content = f.readlines()
    except Exception as e:
        print(f"Error reading file: {str(e)}")
        return jsonify({"error": "Failed to read the data file"}), 500

    # Prepare the data to be processed
    numeric_data = []
    for line_num, line in enumerate(content, 1):
        line = line.strip()
        if not line:  # Skip empty lines
            continue

        try:
            parts = [x.strip() for x in line.split(',')]
            if len(parts) < 6:
                print(f"Warning: Line {line_num} has only {len(parts)} values (minimum 6 required)")
                parts += ['0.0'] * (6 - len(parts))  # Pad missing values

            row = [float(x) for x in parts[:6]]  # Use the first 6 values (accel + gyro)
            numeric_data.append(row)
        except ValueError as e:
            print(f"Skipping malformed line {line_num}: {line} (Error: {str(e)})")
            continue

    if not numeric_data:
        print("Error: No valid data found in file")
        return jsonify({"error": "No valid data found in the file"}), 500

    print(f"Successfully read {len(numeric_data)} data points")

    # Preprocess the IMU data for prediction
    processed_data = preprocess_imu_data(numeric_data)
    if processed_data is None:
        return jsonify({"error": "Failed to preprocess data"}), 500

    try:
        # Predict with both models (capital and small letter models)
        pred_capital = model_capital.predict(processed_data)
        pred_small = model_small.predict(processed_data)

        # Get the prediction with the highest confidence
        capital_pred_class = np.argmax(pred_capital[0])
        small_pred_class = np.argmax(pred_small[0])

        capital_confidence = np.max(pred_capital[0])
        small_confidence = np.max(pred_small[0])

        # Compare confidence scores and choose the model with the highest confidence
        if (capital_confidence  > small_confidence and CLASS_LABELS_CAPITAL.get(capital_pred_class) != None):
            pred_class = capital_pred_class
            confidence = capital_confidence
            model_used = 'Capital Letter Model'
            character = CLASS_LABELS_CAPITAL.get(pred_class)
        elif (small_confidence  > capital_confidence) and CLASS_LABELS_CAPITAL.get(small_pred_class) != None:
            pred_class = small_pred_class
            confidence = small_confidence
            model_used = 'Small Letter Model'
            character = CLASS_LABELS_SMALL.get(pred_class)
        else:
            pred_class = 'Dot'
            confidence = 0.0
            model_used = 'Dot'
            character = '.'

        print(f"\n=== Prediction Result ===")
        print(f"Model used: {model_used}")
        print(f"Predicted letter: {character}")
        print(f"Confidence: {confidence:.2%}")
        print("========================")

        # Return the prediction as a JSON response
        return jsonify({
            "status": "Collected",
            "file": data_file_path,
            "character": character,
            "confidence": float(confidence),
            "model_used": model_used,
        })

    except Exception as e:
        print(f"Error during prediction: {str(e)}")
        return jsonify({"error": "Prediction failed"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
