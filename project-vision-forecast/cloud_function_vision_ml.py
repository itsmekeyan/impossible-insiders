import os
import json
import base64
import logging
from flask import Flask, request, jsonify
from google.cloud import vision
from google.cloud.vision_v1 import types
from google.cloud import pubsub_v1
from google.cloud import bigquery

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Set up Google Cloud credentials
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "config/service_account.json"

def detect_faces_uri(uri):
    """Detects faces in the file located in Google Cloud Storage or the web."""
    
    try:
        client = vision.ImageAnnotatorClient()
        image = vision.Image()
        image.source.image_uri = uri

        response = client.face_detection(image=image)
        faces = response.face_annotations

        # Names of likelihood from google.cloud.vision.enums
        likelihood_name = (
            "UNKNOWN",
            "VERY_UNLIKELY",
            "UNLIKELY",
            "POSSIBLE",
            "LIKELY",
            "VERY_LIKELY",
        )

        logger.info(f"Total faces detected: {len(faces)}")

        face_results = []
        for face in faces:
            face_data = {
                "anger": likelihood_name[face.anger_likelihood],
                "joy": likelihood_name[face.joy_likelihood],
                "surprise": likelihood_name[face.surprise_likelihood],
                "sorrow": likelihood_name[face.sorrow_likelihood],
                "bounds": [
                    {"x": vertex.x, "y": vertex.y} 
                    for vertex in face.bounding_poly.vertices
                ]
            }
            face_results.append(face_data)
            logger.info(f"Face detected: {face_data}")

        if response.error.message:
            raise Exception(
                f"{response.error.message}\nFor more info on error messages, check: "
                "https://cloud.google.com/apis/design/errors"
            )

        return {
            "success": True,
            "total_faces": len(faces),
            "faces": face_results
        }
        
    except Exception as e:
        logger.error(f"Error in face detection: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def process_pubsub_message(message_data):
    """Process Pub/Sub message and extract image URI."""
    try:
        # Decode the message data
        if isinstance(message_data, str):
            decoded_data = json.loads(message_data)
        else:
            decoded_data = message_data
            
        # Extract image URI from the message
        # You can customize this based on your message structure
        image_uri = decoded_data.get('image_uri') or decoded_data.get('uri') or decoded_data.get('url')
        zone_id = decoded_data.get('zone_id')
        timestamp = decoded_data.get('timestamp')
        camera_id = decoded_data.get('camera_id')
        
        if not image_uri:
            raise ValueError("No image URI found in message")
            
        return image_uri, zone_id, timestamp, camera_id
        
    except Exception as e:
        logger.error(f"Error processing Pub/Sub message: {str(e)}")
        raise

@app.route('/', methods=['POST'])
def handle_pubsub_message():
    """Handle incoming Pub/Sub messages."""
    try:
        # Get the request data
        envelope = request.get_json()
        
        if not envelope:
            return jsonify({"error": "No Pub/Sub message received"}), 400

        # Extract the message data
        if not isinstance(envelope, dict):
            return jsonify({"error": "Invalid message format"}), 400

        # Handle different Pub/Sub message formats
        if 'message' in envelope:
            # Standard Pub/Sub push format
            message = envelope['message']
            if 'data' in message:
                # Decode base64 data
                data = base64.b64decode(message['data']).decode('utf-8')
                image_uri, zone_id, timestamp, camera_id = process_pubsub_message(data)
            else:
                return jsonify({"error": "No data in message"}), 400
        else:
            # Direct JSON format
            image_uri, zone_id, timestamp, camera_id = process_pubsub_message(envelope)

        # Perform face detection
        result = detect_faces_uri(image_uri)

        faces_count = result["total_faces"]

        # store these data to the bigquery
        # create a bigquery client
        client = bigquery.Client()
        # create a table
        table_id = "qualified-acre-466511-u6.vision_ml.vision_ml_table"
        # create a schema
        schema = [
            bigquery.SchemaField("image_uri", "STRING"),
            bigquery.SchemaField("zone_id", "STRING"),
            bigquery.SchemaField("timestamp", "TIMESTAMP"),
            bigquery.SchemaField("camera_id", "STRING"),
            bigquery.SchemaField("faces_count", "INTEGER"),
        ]

        # create the table if not exists
        table = bigquery.Table(table_id, schema=schema)
        client.create_table(table, exists_ok=True)

        # insert the data to the table
        rows = [
            {
                "image_uri": image_uri,
                "zone_id": zone_id,
                "timestamp": timestamp,
                "camera_id": camera_id,
                "faces_count": faces_count
            }
        ]

        # insert the data to the table
        client.insert_rows_json(table_id, rows)

        # print the data that is inserted
        logger.info(f"Data inserted: {rows}")

        # return the result
        return jsonify(result), 200
    
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for Cloud Run."""
    return jsonify({"status": "healthy"}), 200

@app.route('/detect', methods=['POST'])
def detect_faces_direct():
    """Direct endpoint for face detection (for testing)."""
    try:
        data = request.get_json()
        if not data or 'image_uri' not in data:
            return jsonify({"error": "image_uri is required"}), 400
            
        result = detect_faces_uri(data['image_uri'])
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error in direct detection: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Run the Flask app
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
