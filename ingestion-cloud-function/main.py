import os
import json
import logging
from flask import Flask, request, jsonify
from google.cloud import bigquery, firestore
from utils.vision_ml import detect_faces_uri
from utils.gemini_segmentation import analyze_video, SEVERITY_MAPPING

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)

# Set up Google Cloud credentials
# For local development using a service account file
service_account_path = "config/service_account.json"
if os.path.exists(service_account_path):
    logger.info(f"Using service account from: {service_account_path}")
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = service_account_path
else:
    # In Cloud Run, the service account is provided by the environment
    logger.info("No local service account file found. Using environment credentials.")
    # Check if running in Cloud Run with default credentials
    if os.environ.get("K_SERVICE"):
        logger.info("Running in Cloud Run with default service account")

# create a bigquery client
client = bigquery.Client()

# create a table
project_id = "qualified-acre-466511-u6"
dataset_id = "vision_ml"
table_name = "vision_ml_table"
table_id = f"{project_id}.{dataset_id}.{table_name}"

# Create the dataset if it doesn't exist
dataset_ref = bigquery.DatasetReference(project_id, dataset_id)
try:
    client.get_dataset(dataset_ref)
    logger.info(f"Dataset {dataset_id} already exists")
except Exception:
    logger.info(f"Dataset {dataset_id} not found, creating it")
    dataset = bigquery.Dataset(dataset_ref)
    dataset = client.create_dataset(dataset)
    logger.info(f"Dataset {dataset_id} created")

# create a schema
schema = [
    bigquery.SchemaField("image_uri", "STRING"),
    bigquery.SchemaField("zone_id", "STRING"),
    bigquery.SchemaField("video_id", "STRING"),
    bigquery.SchemaField("timestamp", "TIMESTAMP"),
    bigquery.SchemaField("camera_id", "STRING"),
    bigquery.SchemaField("faces_count", "INTEGER"),
    bigquery.SchemaField("location_lat", "FLOAT"),
    bigquery.SchemaField("location_long", "FLOAT"),
    bigquery.SchemaField("bottle_neck_index", "FLOAT"),
]
# create the table if not exists
table = bigquery.Table(table_id, schema=schema)
client.create_table(table, exists_ok=True)
logger.info(f"Table {table_id} is ready")
firestore_db = firestore.Client()


@app.route('/', methods=['POST'])
def handle_pubsub_message():
    """Handle incoming Pub/Sub messages."""
    try:
        # Get the request data
        envelope = request.get_json()
        logger.info(f"Received request: {envelope}")
        
        if not envelope:
            logger.error("No Pub/Sub message received")
            # Pub/Sub will retry if we return 4xx
            return jsonify({"error": "No Pub/Sub message received"}), 400
            
        # Check if this is a Pub/Sub message
        if not isinstance(envelope, dict) or 'message' not in envelope:
            logger.warning("Invalid Pub/Sub message format")
            # Try processing as direct JSON payload for testing purposes
            message_data = envelope
        else:
            # Extract the Pub/Sub message
            pubsub_message = envelope['message']
            
            # If the message has data, it will be base64-encoded
            if 'data' in pubsub_message:
                import base64
                encoded_data = pubsub_message['data']
                decoded_data = base64.b64decode(encoded_data).decode('utf-8')
                logger.info(f"Decoded message data: {decoded_data}")
                
                try:
                    message_data = json.loads(decoded_data)
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse message as JSON: {decoded_data}")
                    # Permanent failure - don't retry
                    return jsonify({"error": "Invalid message format"}), 400
            else:
                # No data field
                logger.warning("No data field in Pub/Sub message")
                message_data = {}
                
            # Include any attributes from the Pub/Sub message
            if 'attributes' in pubsub_message and pubsub_message['attributes']:
                message_data.update(pubsub_message['attributes'])

        logger.info(f"Processed message data: {message_data}")

        # Validate required fields
        required_fields = ['image_uri', 'zone_id', 'timestamp', 'camera_id']
        missing_fields = [field for field in required_fields if field not in message_data]
        if missing_fields:
            logger.error(f"Missing required fields: {missing_fields}")
            # Don't retry - this is a permanent failure
            return jsonify({"error": f"Missing required fields: {missing_fields}"}), 400

        image_uri = message_data.get('image_uri')
        video_uri = message_data.get('video_uri')
        zone_id = message_data.get('zone_id')
        location_lat = message_data.get('location_lat')
        location_long = message_data.get('location_long')
        timestamp = message_data.get('timestamp')
        camera_id = message_data.get('camera_id')
        video_id = message_data.get('video_id')

        # Log incoming request data for debugging
        logger.info(f"Processing request with image_uri: {image_uri}, video_uri: {video_uri}, zone_id: {zone_id}")

        # Perform face detection with error handling
        faces_count = 0
        try:
            if image_uri:
                faces_count_results = detect_faces_uri(image_uri)
                logger.info(f"Face detection results: {faces_count_results}")
                faces_count = faces_count_results.get("total_faces", 0)
                logger.info(f"Face detection completed successfully with {faces_count} faces")
            else:
                logger.warning("No image_uri provided, skipping face detection")
        except Exception as e:
            logger.error(f"Face detection failed: {str(e)}")
            # Continue processing without failing the entire request
            faces_count = 0

        ### Analysis results
        analysis_results = {}
        try:
            if video_uri:
                analysis_results = analyze_video(video_uri)
                logger.info("Video analysis completed successfully: ", analysis_results)
            else:
                logger.warning("No video_uri provided, skipping video analysis")
        except Exception as e:
            logger.error(f"Video analysis failed: {str(e)}")
            # Continue with empty analysis results
            analysis_results = {}

        incident_ids = []
        incidents = []
        if 'incidents' in analysis_results:
            for incident_type, incident_data in analysis_results['incidents'].items():
                if incident_data.get('score', 0) > 0.5:
                    doc_ref = firestore_db.collection('incidents').document()
                    incidents.append({
                        "video_id": video_id,
                        "image_uri": image_uri,
                        "video_uri": video_uri,
                        "camera_id": camera_id,
                        "location_lat": location_lat,
                        "location_long": location_long,
                        "type": incident_type,
                        "severity": SEVERITY_MAPPING.get(incident_type, "unknown"),
                        "zone_id": zone_id,
                        "timestamp": timestamp,
                        "source": "gemini_mm",
                        "details": {
                            "confidence": incident_data.get('score'),
                            "timestamps": incident_data.get('timestamps'),
                            "explanation": incident_data.get('explanation')
                        },
                        "status": "active"
                    })
                    doc_ref.set(incidents[-1])
                    incident_ids.append(doc_ref.id)

        # Save the overall analysis report
        report_ref = firestore_db.collection('analysis_reports').document()
        firestore_data = {
            "video_id": video_id,
            "video_uri": video_uri,
            "zone_id": zone_id,
            "timestamp": timestamp,
            "crowd_density": analysis_results.get("crowd_density"),
            "crowd_sentiment": analysis_results.get("crowd_sentiment"),
            "zone_capacity": analysis_results.get("zone_capacity"),
            "normalized_crowd_density": analysis_results.get("normalized_crowd_density"),
            "normalized_flow_speed": analysis_results.get("normalized_flow_speed"),
            "overall_safety_assessment": analysis_results.get("overall_safety_assessment"),
            "recommended_actions": analysis_results.get("recommended_actions"),
            "incident_refs": [firestore_db.collection('incidents').document(id) for id in incident_ids]
        }
        
        # Get numeric values for calculations, handling possible dictionary or complex structures
        normalized_crowd_density = 0.0
        normalized_flow_speed = 0.0
        
        # Extract crowd density - could be a number or dict with a score
        if isinstance(firestore_data["normalized_crowd_density"], dict):
            if "score" in firestore_data["normalized_crowd_density"]:
                normalized_crowd_density = float(firestore_data["normalized_crowd_density"]["score"])
            else:
                # Try to get the first numeric value from the dict
                for val in firestore_data["normalized_crowd_density"].values():
                    if isinstance(val, (int, float)):
                        normalized_crowd_density = float(val)
                        break
        elif firestore_data["normalized_crowd_density"] is not None:
            try:
                normalized_crowd_density = float(firestore_data["normalized_crowd_density"])
            except (ValueError, TypeError):
                normalized_crowd_density = 0.0
                
        # Extract flow speed - could be a number or dict with a score
        if isinstance(firestore_data["normalized_flow_speed"], dict):
            if "score" in firestore_data["normalized_flow_speed"]:
                normalized_flow_speed = float(firestore_data["normalized_flow_speed"]["score"])
            else:
                # Try to get the first numeric value from the dict
                for val in firestore_data["normalized_flow_speed"].values():
                    if isinstance(val, (int, float)):
                        normalized_flow_speed = float(val)
                        break
        elif firestore_data["normalized_flow_speed"] is not None:
            try:
                normalized_flow_speed = float(firestore_data["normalized_flow_speed"])
            except (ValueError, TypeError):
                normalized_flow_speed = 0.0
                
        # Calculate bottleneck index safely
        bottle_neck_index = normalized_crowd_density * (1 - normalized_flow_speed)
        logger.info(f"Calculated bottle_neck_index: {bottle_neck_index} from density: {normalized_crowd_density} and flow: {normalized_flow_speed}")
        report_ref.set(firestore_data)

        # send to the pub sub topic
        # insert the data to the table
        rows = [
            {
                "image_uri": image_uri,
                "zone_id": zone_id,
                "video_id": video_id,
                "timestamp": timestamp,
                "camera_id": camera_id,
                "faces_count": faces_count,
                "location_lat": location_lat,
                "location_long": location_long,
                "bottle_neck_index": bottle_neck_index
            }
        ]

        # For each agent, we've to check if the incident is already in active status in that zone
        # get the active incidents in that zone
        try: 
            current_active_incidents = firestore_db.collection('aggregrated_incidents').where('zone_id', '==', zone_id).where('status', '==', 'active').get()
        except Exception as e:
            current_active_incidents = []

        unique_types_in_active_incidents = set()
        for current_active_incident in current_active_incidents:
            current_active_incident = current_active_incident.to_dict()
            unique_types_in_active_incidents.add(current_active_incident.get('type'))

        for incident in incidents:
            if incident.get('type') not in unique_types_in_active_incidents:
                # insert the incident to the table 'aggregrated_incidents'
                report_ref = firestore_db.collection('aggregrated_incidents').document()
                report_ref.set(incident)


        # insert the data to the table
        client.insert_rows_json(table_id, rows)
        
        # Return success status - Pub/Sub requires 2xx for acknowledgement
        logger.info("Message processed successfully")
        return jsonify({"success": True, "message": "Message processed successfully"}), 200
    
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        # Return 500 error - Pub/Sub will retry the message
        return jsonify({
            "success": False,
            "error": str(e),
            "retry": True  # Indicate this should be retried by Pub/Sub
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for Cloud Run."""
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    # Run the Flask app
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)