#!/bin/bash

# Configuration
PROJECT_ID="your-project-id"
SERVICE_NAME="vision-face-detection"
REGION="us-central1"
TOPIC_NAME="image-processing-topic"
SUBSCRIPTION_NAME="vision-face-detection-sub"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Deploying Vision Face Detection Service to Cloud Run...${NC}"

# Set the project
gcloud config set project $PROJECT_ID

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
    --max-instances 10

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
echo ""
echo -e "${YELLOW}To test the service, publish a message to the topic:${NC}"
echo "gcloud pubsub topics publish $TOPIC_NAME --message='{\"image_uri\":\"gs://your-bucket/image.jpg\"}'" 