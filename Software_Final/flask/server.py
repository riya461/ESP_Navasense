from flask import Flask, request, jsonify
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
model = None  # Loaded model

# Load trained model with compile=False to avoid metric warnings
model = load_model('capital_letter_model.h5', compile=False)

# Define class labels mapping (0-25 to A-Z)
CLASS_LABELS = {i: chr(65+i) for i in range(26)}  # 65 is ASCII for 'A'

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
    """Simulate IMU data collection (e.g., accelerometer and gyroscope readings)."""
    return {
        "accelerometer": [random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1)],
        "gyroscope": [random.uniform(-180, 180), random.uniform(-180, 180), random.uniform(-180, 180)],
    }

def save_imu_data_to_file(file_handle):
    """Simulate collecting and writing IMU data into the file."""
    start_time = time.time()
    while time.time() - start_time < 5:
        imu = simulate_imu_data()
        imu_data.append(imu)
        # Write each IMU data in the format: Acc x, Acc y, Acc z, Gyr x, Gyr y, Gyr z
        file_handle.write(
            f"{imu['accelerometer'][0]},{imu['accelerometer'][1]},{imu['accelerometer'][2]}," +
            f"{imu['gyroscope'][0]},{imu['gyroscope'][1]},{imu['gyroscope'][2]}\n"
        )
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
    data_file_path = "A_caps.txt"
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
        # Predict the class with the trained model
        prediction = model.predict(processed_data)
        pred_class = np.argmax(prediction[0])
        confidence = np.max(prediction[0])

        print("\n=== Prediction Result ===")
        print(f"File: {data_file_path}")
        print(f"Predicted letter: {CLASS_LABELS.get(pred_class, 'unknown')}")
        print(f"Confidence: {confidence:.2%}")
        print("========================")

        # Return the prediction as a JSON response
        return jsonify({
            "status": "Collected",
            "file": data_file_path,
            "character": CLASS_LABELS.get(pred_class),
            "confidence": float(confidence),
        })

    except Exception as e:
        print(f"Error during prediction: {str(e)}")
        return jsonify({"error": "Prediction failed"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
