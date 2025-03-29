from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import numpy as np
import cv2
import os
import tempfile
from tensorflow.keras.models import load_model

app = Flask(__name__)

# Load your trained model
try:
    # model = load_model('character_recognition_model.h5')
    print("Model not loaded ")
    # print("Model input shape:", model.input_shape)
except Exception as e:
    print("Error loading model:", str(e))
    raise e

# Define your character classes (adjust according to your model)
CHARACTERS = [chr(i) for i in range(ord('A'), ord('Z')+1)]  # Example: A-Z uppercase

def preprocess_image(image_path, target_size=(32, 32)):
    """Preprocess the drawn image for prediction"""
    try:
        # Read and convert to grayscale
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            raise ValueError("Could not read image")
        
        # Resize and normalize
        img = cv2.resize(img, target_size)
        img = cv2.bitwise_not(img)  # Invert colors (white drawing on black background)
        
        # Add channel dimension
        img = np.expand_dims(img, axis=-1)
        
        # Normalize
        img = img.astype('float32') / 255.0
        
        # Add batch dimension
        img = np.expand_dims(img, axis=0)
        
        return img
    except Exception as e:
        print("Error in preprocessing:", str(e))
        raise e

@app.route('/predict', methods=['POST'])
def predict():
    if 'drawing' not in request.files:
        return jsonify({'error': 'No drawing uploaded'}), 400
    
    file = request.files['drawing']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    # Save temporarily
    temp_dir = tempfile.mkdtemp()
    filename = secure_filename(file.filename)
    filepath = os.path.join(temp_dir, filename)
    file.save(filepath)
    
    try:
        # Preprocess and predict
        processed_img = preprocess_image(filepath)
        
        # Debug print input shape
        print("Input shape to model:", processed_img.shape)
        
        # predictions = model.predict(processed_img)
        # predicted_class = np.argmax(predictions)
        # predicted_char = CHARACTERS[predicted_class]
        
        return jsonify({
            'character': 'A',
            'confidence': 1.0,
            'message': 'Prediction successful'
        })
    except Exception as e:
        print("Prediction error:", str(e))
        return jsonify({'error': str(e)}), 500
    finally:
        # Clean up
        if os.path.exists(filepath):
            os.remove(filepath)
        if os.path.exists(temp_dir):
            os.rmdir(temp_dir)

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)