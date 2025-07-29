#!/bin/bash

# Configuration
PROJECT_ID="your-project-id"
SERVICE_NAME="vision-face-detection"
REGION="us-central1"
TOPIC_NAME="image-processing-topic"
SUBSCRIPTION_NAME="vision-face-detection-sub"
SERVICE_ACCOUNT_NAME="vision-face-detection-sa"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Deploying Vision Face Detection Service to Cloud Run...${NC}"

# Set the project
gcloud config set project $PROJECT_ID

# Create service account if it doesn't exist
echo -e "${YELLOW}Setting up service account...${NC}"
gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL > /dev/null 2>&1 || \
  gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="Vision Face Detection Service Account"

# Grant necessary permissions to the service account
echo -e "${YELLOW}Granting necessary permissions...${NC}"
# Vision API access
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/vision.annotator"

# BigQuery access
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/bigquery.dataEditor"

# Firestore access
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/datastore.user"

# Build and deploy to Cloud Run
echo -e "${YELLOW}Building and deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
    --source . \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 1 \
    --timeout 300 \
    --max-instances 10 \
    --service-account $SERVICE_ACCOUNT_EMAIL

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format='value(status.url)')
echo -e "${GREEN}Service deployed at: $SERVICE_URL${NC}"

# Create Pub/Sub topic if it doesn't exist
echo -e "${YELLOW}Setting up Pub/Sub topic...${NC}"
gcloud pubsub topics create $TOPIC_NAME --quiet || echo "Topic already exists"

# Create push subscription
echo -e "${YELLOW}Creating push subscription...${NC}"
gcloud pubsub subscriptions create $SUBSCRIPTION_NAME \
    --topic $TOPIC_NAME \
    --push-endpoint $SERVICE_URL \
    --ack-deadline 60

echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${GREEN}Service URL: $SERVICE_URL${NC}"
echo -e "${GREEN}Pub/Sub Topic: $TOPIC_NAME${NC}"
echo -e "${GREEN}Subscription: $SUBSCRIPTION_NAME${NC}"
echo -e "${GREEN}Service Account: $SERVICE_ACCOUNT_EMAIL${NC}"
echo ""
echo -e "${YELLOW}To test the service, publish a message to the topic:${NC}"
echo "gcloud pubsub topics publish $TOPIC_NAME --message='{\"image_uri\":\"gs://your-bucket/image.jpg\",\"video_uri\":\"gs://your-bucket/video.mp4\",\"zone_id\":\"zone-1\",\"camera_id\":\"cam-1\",\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"location_lat\":37.7749,\"location_long\":-122.4194,\"video_id\":\"video-1\"}'" 
echo ""
echo -e "${YELLOW}Tip: You can also test locally with curl:${NC}"
echo 'curl -X POST http://localhost:8080 -H "Content-Type: application/json" -d "{\\"message\\": {\\"data\\": \\"$(echo '\''{"image_uri":"gs://your-bucket/image.jpg","video_uri":"gs://your-bucket/video.mp4","zone_id":"zone-1","camera_id":"cam-1","timestamp":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'","location_lat":37.7749,"location_long":-122.4194,"video_id":"video-1"}'\'' | base64)\\"}}"' 