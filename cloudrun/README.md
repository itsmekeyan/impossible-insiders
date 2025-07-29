# Vision Face Detection Cloud Run Service

A Google Cloud Run service that performs face detection using Google Cloud Vision API, triggered by Pub/Sub messages.

## Features

- Face detection using Google Cloud Vision API
- Pub/Sub message processing
- RESTful API endpoints
- Structured JSON responses
- Comprehensive error handling and logging
- Health check endpoint

## Architecture

```
Pub/Sub Topic → Cloud Run Service → Vision API → Response
```

## Setup

### Prerequisites

1. Google Cloud Project with billing enabled
2. Google Cloud CLI installed and configured
3. Service account with Vision API permissions

### Required APIs

Enable the following APIs in your Google Cloud project:

```bash
gcloud services enable run.googleapis.com
gcloud services enable vision.googleapis.com
gcloud services enable pubsub.googleapis.com
```

### Service Account Setup

1. Create a service account with the following roles:
   - Cloud Vision API User
   - Pub/Sub Subscriber
   - Cloud Run Invoker

2. Download the service account key and place it in `config/service_account.json`

### Environment Variables

The service uses the following environment variables:
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to service account key (set in code)
- `PORT`: Port for the service (default: 8080)

## Deployment

### Quick Deploy

1. Update the `PROJECT_ID` in `deploy.sh`
2. Make the script executable and run it:

```bash
chmod +x deploy.sh
./deploy.sh
```

### Manual Deploy

```bash
# Build and deploy
gcloud run deploy vision-face-detection \
    --source . \
    --region us-central1 \
    --platform managed \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 1 \
    --timeout 300 \
    --max-instances 10

# Create Pub/Sub topic
gcloud pubsub topics create image-processing-topic

# Create push subscription
gcloud pubsub subscriptions create vision-face-detection-sub \
    --topic image-processing-topic \
    --push-endpoint YOUR_SERVICE_URL \
    --ack-deadline 60
```

## Usage

### Pub/Sub Message Format

The service expects Pub/Sub messages in the following format:

```json
{
  "image_uri": "gs://your-bucket/image.jpg"
}
```

Or for web URLs:

```json
{
  "image_uri": "https://example.com/image.jpg"
}
```

### Publishing Messages

```bash
# Using gcloud CLI
gcloud pubsub topics publish image-processing-topic \
    --message='{"image_uri":"gs://your-bucket/image.jpg"}'

# Using Python
from google.cloud import pubsub_v1

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(project_id, topic_name)

message = '{"image_uri":"gs://your-bucket/image.jpg"}'
publisher.publish(topic_path, message.encode('utf-8'))
```

### Direct API Endpoints

#### Health Check
```bash
curl https://your-service-url/health
```

#### Direct Face Detection
```bash
curl -X POST https://your-service-url/detect \
    -H "Content-Type: application/json" \
    -d '{"image_uri":"gs://your-bucket/image.jpg"}'
```

## Response Format

### Success Response
```json
{
  "success": true,
  "total_faces": 2,
  "faces": [
    {
      "anger": "UNLIKELY",
      "joy": "LIKELY",
      "surprise": "VERY_UNLIKELY",
      "sorrow": "UNLIKELY",
      "bounds": [
        {"x": 100, "y": 200},
        {"x": 300, "y": 200},
        {"x": 300, "y": 400},
        {"x": 100, "y": 400}
      ]
    }
  ]
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message here"
}
```

## Local Development

### Prerequisites
```bash
pip install -r requirements.txt
```

### Running Locally
```bash
python cloud_function_vision_ml.py
```

The service will be available at `http://localhost:8080`

### Testing Locally
```bash
# Health check
curl http://localhost:8080/health

# Direct detection
curl -X POST http://localhost:8080/detect \
    -H "Content-Type: application/json" \
    -d '{"image_uri":"https://example.com/image.jpg"}'
```

## Monitoring and Logging

- Logs are available in Google Cloud Console under Cloud Run
- Use Cloud Monitoring to set up alerts
- Structured logging is implemented for better observability

## Security Considerations

- Service account key should be stored securely
- Consider using Workload Identity for production
- Implement authentication if needed
- Use VPC connector for private network access

## Troubleshooting

### Common Issues

1. **Service account permissions**: Ensure the service account has Vision API access
2. **Image URI format**: Use valid GCS URIs (gs://bucket/file) or HTTPS URLs
3. **Pub/Sub message format**: Ensure messages contain valid JSON with image_uri field
4. **Memory limits**: Increase memory allocation for large images

### Debug Commands

```bash
# Check service logs
gcloud run services logs read vision-face-detection --region=us-central1

# Check Pub/Sub subscription
gcloud pubsub subscriptions describe vision-face-detection-sub

# Test service directly
curl -X POST https://your-service-url/detect \
    -H "Content-Type: application/json" \
    -d '{"image_uri":"gs://your-bucket/test-image.jpg"}'
```

## License

This project is licensed under the MIT License. 