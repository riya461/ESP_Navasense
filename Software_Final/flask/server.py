from flask import Flask, request, jsonify
import os
import tempfile
import random
from datetime import datetime
import time
import threading

app = Flask(__name__)

# Global variables for data collection
is_collecting = False
collected_data = []
collection_thread = None
stop_event = threading.Event()

def data_collection_worker():
    """Worker thread that continuously writes 'hello' to file"""
    global collected_data
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"imu_data_{timestamp}.txt"
    filepath = os.path.join(tempfile.gettempdir(), filename)
    
    with open(filepath, 'w') as f:
        while not stop_event.is_set():
            # Write "hello" to file
            f.write("hello\n")
            f.flush()  # Ensure immediate write to file
            os.fsync(f.fileno())  # Force write to disk
            
            # Store the data point (just for tracking)
            collected_data.append({
                'timestamp': datetime.now().isoformat(),
                'value': 'hello'
            })
            
            # Simulate sensor sampling rate (e.g., 10Hz = 100ms delay)
            time.sleep(0.1)

@app.route('/start', methods=['POST'])
def start_collection():
    global is_collecting, collection_thread, stop_event, collected_data
    
    if is_collecting:
        return jsonify({'status': 'already_running', 'message': 'Collection already in progress'})
    
    # Reset the stop event and clear data
    stop_event.clear()
    collected_data = []
    
    # Start the collection thread
    collection_thread = threading.Thread(target=data_collection_worker)
    collection_thread.daemon = True
    collection_thread.start()
    
    is_collecting = True
    
    return jsonify({
        'status': 'started',
        'message': 'Data collection started - writing to file',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/stop', methods=['POST'])
def stop_collection():
    global is_collecting, collection_thread, stop_event
    
    if not is_collecting:
        return jsonify({'error': 'not_running', 'message': 'Collection not started'}), 400
    
    # Signal the thread to stop
    stop_event.set()
    
    # Wait for thread to finish (with timeout)
    if collection_thread is not None:
        collection_thread.join(timeout=1.0)
    
    is_collecting = False
    
    # Here you would normally send the data to your model
    
    # Create list of possible characters (English and Malayalam)
    english_chars = list('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')
    malayalam_chars = [
        'അ', 'ആ', 'ഇ', 'ഈ', 'ഉ', 'ഊ', 'ഋ', 'എ', 'ഏ', 'ഐ', 
        'ഒ', 'ഓ', 'ഔ', 'ക', 'ഖ', 'ഗ', 'ഘ', 'ങ', 'ച', 'ഛ',
        'ജ', 'ഝ', 'ഞ', 'ട', 'ഠ', 'ഡ', 'ഢ', 'ണ', 'ത', 'ഥ',
        'ദ', 'ധ', 'ന', 'പ', 'ഫ', 'ബ', 'ഭ', 'മ', 'യ', 'ര',
        'ല', 'വ', 'ശ', 'ഷ', 'സ', 'ഹ', 'ള', 'ഴ', 'റ'
    ]
    
    # Combine both character sets
    all_chars = english_chars + malayalam_chars
    
    # Select a random character
    predicted_char = random.choice(all_chars)
    
    # Generate a random confidence score between 70-100%
    confidence = round(random.uniform(0.7, 1.0), 2)
    
    return jsonify({
        'status': 'stopped',
        'character': predicted_char,
        'confidence': confidence,
        'message': 'Prediction complete',
        'data_points': len(collected_data),
        'note': 'Data was written to file but not processed by model'
    })

@app.route('/status', methods=['GET'])
def collection_status():
    return jsonify({
        'is_collecting': is_collecting,
        'data_points': len(collected_data),
        'last_sample': collected_data[-1] if collected_data else None,
        'message': 'Writing "hello" to file continuously' if is_collecting else 'Idle'
    })

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)