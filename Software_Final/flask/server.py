from flask import Flask, request, jsonify
import time
import json
import random

app = Flask(__name__)

# Global Variables
data_file_path = None
is_collecting = False
file_handle = None  # File handle for writing


@app.route("/start", methods=["POST"])
def start_collection():
    """Start collecting IMU data and write to a file."""
    global is_collecting, data_file_path, file_handle

    if is_collecting:
        return jsonify({"error": "Already collecting data"}), 400

    timestamp = int(time.time())
    data_file_path = f"imu_data_{timestamp}.json"
    is_collecting = True

    # Open file in write mode and start JSON array
    file_handle = open(data_file_path, "w")
    file_handle.write("[\n")

    return jsonify({"status": "started", "file": data_file_path})


@app.route("/stop", methods=["POST"])
def stop_collection():
    """Stop data collection, finalize file, and run prediction."""
    global is_collecting, data_file_path, file_handle

    if not is_collecting:
        return jsonify({"error": "No active collection"}), 400

    is_collecting = False

    # Close JSON array and file
    if file_handle:
        file_handle.seek(file_handle.tell() - 2)  # Remove last comma
        file_handle.write("\n]\n")
        file_handle.close()
        file_handle = None

    # Run prediction
    predicted_char, confidence = run_prediction(data_file_path)

    return jsonify(
        {
            "status": "stopped",
            "character": predicted_char,
            "confidence": confidence,
            "file_path": data_file_path,
        }
    )


@app.route("/imu", methods=["POST"])
def receive_imu_data():
    """Receive IMU data from ESP32 and store it in a file."""
    global is_collecting, file_handle

    if not is_collecting or file_handle is None:
        return jsonify({"error": "Data collection is not active"}), 400

    try:
        imu_data = request.json  # Parse incoming JSON
        json.dump(imu_data, file_handle)
        file_handle.write(",\n")  # Separate entries with commas
        return jsonify({"status": "data received"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def run_prediction(file_path):
    """Simulate running predictions using a model."""
    predictions = {
        "A": random.uniform(0.7, 0.99),
        "B": random.uniform(0.6, 0.95),
        "C": random.uniform(0.5, 0.9),
    }

    best_character = max(predictions, key=predictions.get)
    confidence = predictions[best_character]

    return best_character, confidence


@app.route("/status", methods=["GET"])
def collection_status():
    """Check if data collection is active."""
    return jsonify({"is_collecting": is_collecting, "file": data_file_path})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
