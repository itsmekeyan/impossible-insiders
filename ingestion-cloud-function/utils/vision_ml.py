from google.cloud import vision
import logging
import re

logger = logging.getLogger(__name__)

def detect_faces_uri(uri):
    """Detects faces in the file located in Google Cloud Storage or the web."""
    
    try:
        # Validate URI
        if not uri:
            logger.error("No image URI provided")
            return {"success": False, "error": "No image URI provided", "total_faces": 0}
            
        # Basic validation of URI format
        if not (uri.startswith('gs://') or uri.startswith('http://') or uri.startswith('https://')):
            logger.error(f"Invalid URI format: {uri}")
            return {"success": False, "error": f"Invalid URI format: {uri}", "total_faces": 0}
            
        logger.info(f"Attempting face detection with URI: {uri}")
        
        client = vision.ImageAnnotatorClient()
        image = vision.Image()
        image.source.image_uri = uri

        # Log client and request details for debugging
        logger.info(f"Vision API client initialized, sending request for image: {uri}")
        
        response = client.face_detection(image=image)
        
        # Check for API-level errors first
        if response.error.message:
            logger.error(f"Vision API returned error: {response.error.message}")
            return {
                "success": False,
                "error": response.error.message,
                "total_faces": 0
            }
            
        faces = response.face_annotations
        logger.info(f"Face detection request successful. Total faces detected: {len(faces)}")

        # Names of likelihood from google.cloud.vision.enums
        likelihood_name = (
            "UNKNOWN",
            "VERY_UNLIKELY",
            "UNLIKELY",
            "POSSIBLE",
            "LIKELY",
            "VERY_LIKELY",
        )

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

        return {
            "success": True,
            "total_faces": len(faces),
            "faces": face_results
        }
        
    except Exception as e:
        logger.error(f"Error in face detection: {str(e)}")
        # Ensure we always return total_faces key even on error
        return {
            "success": False,
            "error": str(e),
            "total_faces": 0
        }
