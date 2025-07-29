import os
import json
import datetime
from flask import Flask, request, jsonify
from google.cloud import firestore
import vertexai
from google.genai.types import HttpOptions, Part
from utils.common_utils import recover_json
from google import genai

app = Flask(__name__)

os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "1"
os.environ["GOOGLE_CLOUD_PROJECT"] = "qualified-acre-466511-u6"
os.environ["GOOGLE_CLOUD_LOCATION"] = "us-central1"
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "config/service_account.json"

# Initialize clients
vertexai.init(project=os.environ.get("GOOGLE_CLOUD_PROJECT"), location=os.environ.get("GOOGLE_CLOUD_LOCATION"))
client = genai.Client(http_options=HttpOptions(api_version="v1"))
db = firestore.Client()

# Severity mapping for different incident types
SEVERITY_MAPPING = {
    "congestion": "medium",
    "crowd_surges": "high",
    "unruly_behavior": "high",
    "panic_or_danger": "critical",
    "injuries_from_objects": "high",
    "injuries_from_slippery_surface": "medium",
    "cardiac_arrest": "critical",
    "unauthorized_access": "medium",
    "theft": "medium",
    "unattended_bags": "high",
    "weapon_detection": "critical",
    "active_shooter": "critical",
    "property_damage": "medium",
    "missing_signage": "low",
    "fire_and_smoke": "critical",
    "structural_failures": "critical",
    "weather_related_incidents": "high",
    "equipment_malfunctions": "medium",
    "staffing_shortages": "low",
    "waste_management_failures": "low",
    "parking_or_traffic_congestion": "medium"
}

analysis_prompt = """
Analyze this video and provide a JSON response that assesses the presence of the following safety incidents.

    For each incident type, provide:
    1. A confidence score between 0.0 (not present) and 1.0 (definitely present)
    2. A brief explanation of your assessment
    3. Timestamp ranges where the incident occurs (if applicable)

    Return your analysis in this exact JSON structure:
    {
      "incidents": {
        "congestion": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "crowd_surges": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "unruly_behavior": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "panic_or_danger": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "injuries_from_objects": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "injuries_from_slippery_surface": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "cardiac_arrest": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "unauthorized_access": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "theft": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "unattended_bags": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "weapon_detection": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "active_shooter": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "property_damage": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "missing_signage": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "fire_and_smoke": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "structural_failures": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "weather_related_incidents": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "equipment_malfunctions": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "staffing_shortages": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "waste_management_failures": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        },
        "parking_or_traffic_congestion": {
          "score": <float>,
          "explanation": <string>,
          "timestamps": [{"start": <float>, "end": <float>}]
        }
      },
      "crowd_density": {
        "persons_per_sq_m": <float>,
        "explanation": <string>
      },
      "crowd_sentiment": {
        "score": <float>,
        "explanation": <string>
      },
      "zone_capacity": {
        "estimated_capacity": <integer>,
        "explanation": <string>
      },
      "normalized_crowd_density": {
        "score": <float>,
        "explanation": <string>
      },
      "normalized_flow_speed": {
        "score": <float>,
        "explanation": <string>
      },
      "overall_safety_assessment": <string>,
      "recommended_actions": [<string>]
    }

    Important definitions:
    - Crowd Density: Estimated number of people per square meter (person/m2). Your explanation should detail how you estimated the area and the person count.
    - Crowd Sentiment: A score from -1.0 (very negative) to 1.0 (very positive), along with an explanation of the dominant sentiment.
    - Zone Capacity: An estimation of the total number of people that can safely occupy the zone, with an explanation of the calculation.
    - Normalized Crowd Density: A score from 0.0 (empty) to 1.0 (at or over capacity), derived from crowd_density and zone_capacity. Explain your calculation.
    - Normalized Flow Speed: A score from 0.0 (static) to 1.0 (free-flowing), representing the speed of crowd movement.
    - Congestion: Overcrowding of people in a space beyond safe capacity.
    - Crowd Surges: Sudden, uncontrolled movements of a crowd.
    - Unruly behavior: People acting aggressively, fighting, or causing disruption.
    - Panic/danger: People showing fear, running chaotically, or responding to threats.
    - Injuries from objects: People getting hurt by falling, moving, or stationary objects.
    - Injuries from slippery surfaces: Falls or near-falls due to wet/slippery floors.
    - Cardiac arrest: Someone collapsing with signs of possible heart failure.
    - Unauthorized access: People entering restricted areas.
    - Theft: Stealing of personal or event property.
    - Unattended bags: Bags or packages left without an owner.
    - Weapon detection: Presence of any type of weapon.
    - Active shooter: An individual actively engaged in killing or attempting to kill people in a populated area.
    - Property damage: Intentional damage to property.
    - Missing signage: Important signs are missing or broken.
    - Fire and Smoke: Detection of fire or smoke.
    - Structural failures: Breakage of stages, barriers, or other structures.
    - Weather-related incidents: Incidents caused by severe weather conditions.
    - Equipment malfunctions: Failure of screens, lighting, or other equipment.
    - Staffing shortages: Not enough staff to manage the event safely.
    - Waste management failures: Overflowing trash bins or unsanitary conditions.
    - Parking/traffic congestion: Severe congestion in parking areas or access roads.

    DO NOT include any text outside of the JSON structure. Return ONLY valid, parseable JSON.
 """

def save_incident(incident_type, incident_data, zone_id, video_id, ts):
    """Saves a single incident to Firestore."""
    doc_ref = db.collection('incidents').document()
    doc_ref.set({
        "video_id": video_id,
        "type": incident_type,
        "severity": SEVERITY_MAPPING.get(incident_type, "unknown"),
        "zone_id": zone_id,
        "ts": ts,
        "source": "gemini_mm",
        "details": {
            "confidence": incident_data.get('score'),
            "timestamps": incident_data.get('timestamps'),
            "explanation": incident_data.get('explanation')
        },
        "status": "active"
    })
    return doc_ref.id

@app.route('/', methods=['POST'])
def analyze_video():
    """
    HTTP endpoint to analyze a video and store results in Firestore.
    """
    message_data = request.get_json()
    if not message_data:
        return jsonify({"error": "Invalid JSON"}), 400

    gcs_uri = message_data.get('video_uri')
    zone_id = message_data.get('zone_id', 'unknown_zone')
    video_id = message_data.get('video_id', 'unknown_video')
    ts = message_data.get('ts', datetime.datetime.utcnow().isoformat() + "Z")

    if not gcs_uri:
        return jsonify({"error": "video_uri is required"}), 400

    print(f"Processing video from GCS: {gcs_uri}")

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                Part.from_uri(
                    file_uri=gcs_uri,
                    mime_type="video/mp4",
                ),
                analysis_prompt,
            ],
        )

        analysis_result = recover_json(response.text)

        incident_ids = []
        if 'incidents' in analysis_result:
            for incident_type, incident_data in analysis_result['incidents'].items():
                if incident_data.get('score', 0) > 0.5:
                    incident_id = save_incident(incident_type, incident_data, zone_id, video_id, ts)
                    incident_ids.append(incident_id)

        # Save the overall analysis report
        report_ref = db.collection('analysis_reports').document()
        report_ref.set({
            "video_id": video_id,
            "video_uri": gcs_uri,
            "zone_id": zone_id,
            "created_at": ts,
            "crowd_density": analysis_result.get("crowd_density"),
            "crowd_sentiment": analysis_result.get("crowd_sentiment"),
            "zone_capacity": analysis_result.get("zone_capacity"),
            "normalized_crowd_density": analysis_result.get("normalized_crowd_density"),
            "normalized_flow_speed": analysis_result.get("normalized_flow_speed"),
            "bottle_neck_index": analysis_result.get("bottle_neck_index"),
            "overall_safety_assessment": analysis_result.get("overall_safety_assessment"),
            "recommended_actions": analysis_result.get("recommended_actions"),
            "incident_refs": [db.collection('incidents').document(id) for id in incident_ids]
        })

        print(f"Video analysis successful. Report ID: {report_ref.id}")
        return jsonify({"status": "success", "report_id": report_ref.id}), 200

    except Exception as e:
        print(f"Error processing video: {e}")
        return jsonify({"error": "Failed to process video", "details": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))