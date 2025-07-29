
'use server';

import { z } from 'zod';
import { getEventRiskProfile, GetEventRiskProfileInput } from '@/ai/flows/get-event-risk-profile';
import { fetchYoutubeCrazeScore } from '@/ai/flows/youtube-craze-analyzer';
import { uploadFile, FileUploadParams, listFiles } from '@/services/gcs';
import { PubSub } from '@google-cloud/pubsub';
import { getIncidentsFromFirestore, Incident } from '@/lib/firebase-admin';


const viewportSchema = z.object({
  south: z.number(),
  west: z.number(),
  north: z.number(),
  east: z.number(),
});

const formSchema = z.object({
    eventDate: z.date(),
    location: z.string().min(3, 'Location must be at least 3 characters.'),
    attendees: z.coerce.number().int().positive('Attendees must be a positive number.'),
    eventType: z.string(),
    otherEventType: z.string().optional(),
    keyword: z.string().min(2, 'Tags must be at least 2 characters.'),
    viewport: viewportSchema.optional(),
}).refine(data => {
    if (data.eventType === 'Other') {
        return !!data.otherEventType && data.otherEventType.length > 0;
    }
    return true;
}, {
    message: "Please specify the event type.",
    path: ["otherEventType"],
});


type FormValues = z.infer<typeof formSchema>;

// Haversine formula to calculate distance between two points on a sphere
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180; // φ, λ in radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
}


function getAreaFromViewport(viewport: z.infer<typeof viewportSchema>): number {
    const { south, west, north, east } = viewport;
    // Calculate width and height using Haversine distance for accuracy
    const width = haversineDistance(north, west, north, east);
    const height = haversineDistance(north, west, south, west);
    return width * height; // Area in square meters
}

export async function runEventSimulation(data: FormValues) {
  try {
    const validation = formSchema.safeParse(data);
    if (!validation.success) {
      const formattedErrors = validation.error.format();
      return { error: `Invalid data provided: ${JSON.stringify(formattedErrors)}` };
    }

    const { keyword, eventDate, otherEventType, viewport, ...eventDetails } = validation.data;

    let finalEventType = eventDetails.eventType;
    if (finalEventType === 'Other' && otherEventType) {
        finalEventType = otherEventType;
    }

    // 1. Calculate Area
    let areaSquareMeters: number;
    if (viewport) {
      areaSquareMeters = getAreaFromViewport(viewport);
    } else {
      // Fallback to 1km radius if no viewport is available
      areaSquareMeters = Math.PI * (1000 * 1000); 
    }


    // 2. Fetch YouTube Craze Score for multiple tags
    const keywords = keyword.split(',').map(k => k.trim()).filter(k => k.length > 1);
    
    if (keywords.length === 0) {
      return { error: 'Please provide at least one valid information tag.' };
    }

    const crazeScorePromises = keywords.map(kw => fetchYoutubeCrazeScore({ keyword: kw }));
    const crazeScoreResponses = await Promise.all(crazeScorePromises);

    const totalCrazeScore = crazeScoreResponses.reduce((acc, curr) => acc + curr.crazeScore, 0);
    const averageCrazeScore = totalCrazeScore / crazeScoreResponses.length;

    // Combine and de-duplicate videos
    const allVideos = crazeScoreResponses.flatMap(res => res.videos);
    const uniqueVideos = Array.from(new Map(allVideos.map(video => [video.id, video])).values());


    // 3. Prepare input for Risk Profile
    const riskProfileInput: GetEventRiskProfileInput = {
      ...eventDetails,
      eventType: finalEventType,
      date: eventDate.toISOString().split('T')[0],
      crazeMultiplier: averageCrazeScore,
      areaSquareMeters: areaSquareMeters
    };

    // 4. Get Event Risk Profile
    const riskProfile = await getEventRiskProfile(riskProfileInput);

    return { ...riskProfile, crazeScore: averageCrazeScore, videos: uniqueVideos, location: eventDetails.location };
  } catch (error) {
    console.error('Error during simulation:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { error: `Failed to run simulation: ${errorMessage}` };
  }
}

interface UploadAndProcessParams {
  dataUrl: string;
  fileName: string;
  zoneName: string;
  fileType: 'video' | 'image';
}

async function uploadAndProcessFile({ dataUrl, fileName, zoneName, fileType }: UploadAndProcessParams): Promise<{ success: boolean; gcsUri?: string; error?: string }> {
    try {
        const { GCS_BUCKET_NAME, GCP_PROJECT_ID, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } = process.env;
        
        if (!GCS_BUCKET_NAME || !GCP_PROJECT_ID || !GCP_CLIENT_EMAIL || !GCP_PRIVATE_KEY) {
            const errorMsg = 'Server configuration error: Google Cloud credentials are not fully set in environment variables.';
            console.error(errorMsg);
            return { success: false, error: errorMsg };
        }
        
        const folder = fileType === 'video' ? 'video' : 'images';
        const filePath = `${zoneName.replace(/\s+/g, '_')}/${folder}/${fileName}`;

        const params: Omit<FileUploadParams, 'pubsubTopicId' | 'metadata'> = {
          bucketName: GCS_BUCKET_NAME,
          projectId: GCP_PROJECT_ID,
          clientEmail: GCP_CLIENT_EMAIL,
          privateKey: GCP_PRIVATE_KEY,
          dataUrl: dataUrl,
          filePath: filePath,
          fileType,
        };

        return await uploadFile(params);

    } catch (error) {
        console.error(`Error in uploadAndProcessFile for ${fileType}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during upload.';
        return { success: false, error: `Upload failed: ${errorMessage}` };
    }
}


interface UploadVideoParams {
  videoDataUrl: string;
  fileName: string;
  zoneName: string;
}

export async function uploadVideoChunkToGcs(params: UploadVideoParams): Promise<{ success: boolean; gcsUri?: string; error?: string }> {
    return uploadAndProcessFile({
        dataUrl: params.videoDataUrl,
        fileName: params.fileName,
        zoneName: params.zoneName,
        fileType: 'video',
    });
}

interface UploadImageFrameParams {
  imageDataUrl: string;
  fileName: string;
  zoneName: string;
}

export async function uploadImageFrameToGcs(params: UploadImageFrameParams): Promise<{ success: boolean; gcsUri?: string; error?: string }> {
    return uploadAndProcessFile({
        dataUrl: params.imageDataUrl,
        fileName: params.fileName,
        zoneName: params.zoneName,
        fileType: 'image',
    });
}


interface UploadFullVideoParams {
  videoDataUrl: string;
  fileName: string;
  zoneName: string;
}

export async function uploadFullVideoToGcs({ videoDataUrl, fileName, zoneName }: UploadFullVideoParams): Promise<{ success: boolean; gcsUri?: string; error?: string }> {
    try {
        const { GCS_BUCKET_NAME, GCP_PROJECT_ID, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } = process.env;
        
        if (!GCS_BUCKET_NAME || !GCP_PROJECT_ID || !GCP_CLIENT_EMAIL || !GCP_PRIVATE_KEY) {
            const errorMsg = 'Server configuration error: Google Cloud Storage credentials are not fully set in environment variables.';
            console.error(errorMsg);
            return { success: false, error: errorMsg };
        }
        
        const filePath = `${zoneName.replace(/\s+/g, '_')}/full_video/${fileName}`;

        // Re-using FileUploadParams but without Pub/Sub info for the archival upload
        const params = {
          bucketName: GCS_BUCKET_NAME,
          projectId: GCP_PROJECT_ID,
          clientEmail: GCP_CLIENT_EMAIL,
          privateKey: GCP_PRIVATE_KEY,
          dataUrl: videoDataUrl,
          filePath: filePath,
          fileType: 'video'
        };
        
        // Directly call a simplified upload here as it doesn't need the Pub/Sub logic
        return await uploadFile(params);

    } catch (error) {
        console.error('Error in uploadFullVideoToGcs:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during upload.';
        return { success: false, error: `Upload failed: ${errorMessage}` };
    }
}


export async function reverseGeocode(coords: { lat: number, lng: number }): Promise<{ address?: string, error?: string }> {
    try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return { error: 'Google Maps API key is not configured.' };
        }
        
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.lat},${coords.lng}&key=${apiKey}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            return { error: `Geocoding API request failed with status: ${response.status}` };
        }
        
        const data = await response.json();
        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            return { error: `Geocoding failed: ${data.status} - ${data.error_message || 'No results found.'}` };
        }

        const address = data.results[0].formatted_address;
        return { address };

    } catch (error) {
        console.error('Reverse geocoding error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { error: `Failed to fetch address: ${errorMessage}` };
    }
}

export interface VideoFile {
    url: string;
    name: string;
}

export type ZoneData = {
    [key: string]: VideoFile[];
}

export async function getZoneVideoPlaylist(zoneName: string): Promise<{ videos?: VideoFile[], error?: string }> {
    try {
        const { GCS_BUCKET_NAME, GCP_PROJECT_ID, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } = process.env;

        if (!GCS_BUCKET_NAME || !GCP_PROJECT_ID || !GCP_CLIENT_EMAIL || !GCP_PRIVATE_KEY) {
            const errorMsg = 'Server configuration error: GCS credentials for fetching playlist are not set.';
            console.error(errorMsg);
            return { error: errorMsg };
        }
        
        const prefix = `${zoneName.replace(/\s+/g, '_')}/video/`;

        const files = await listFiles({
            bucketName: GCS_BUCKET_NAME,
            projectId: GCP_PROJECT_ID,
            clientEmail: GCP_CLIENT_EMAIL,
            privateKey: GCP_PRIVATE_KEY,
            prefix: prefix,
        });

        if (files.error) {
            return { error: files.error };
        }

        // Check and validate URLs to ensure they're accessible
        const validFiles = files.videoFiles?.filter(file => file.url && file.url.trim() !== '') || [];
        
        if (validFiles.length === 0 && files.videoFiles && files.videoFiles.length > 0) {
            console.warn(`Found ${files.videoFiles.length} files but none had valid URLs for zone ${zoneName}`);
        }
        
        const sortedFiles = validFiles.sort((a, b) => a.name.localeCompare(b.name));
        
        return { videos: sortedFiles };

    } catch (error) {
        console.error(`Error fetching video playlist for ${zoneName}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { error: `Failed to fetch playlist: ${errorMessage}` };
    }
}

export interface PublishVideoAnalysisParams {
    image_uri: string;
    video_uri: string;
    zone_id: string;
    location_lat: number;
    location_long: number;
    timestamp: string;
    camera_id: string;
    video_id: string;
}

export async function publishToRawVideoStream(params: PublishVideoAnalysisParams): Promise<{success: boolean, messageId?: string, error?: string}> {
    const {
        GCP_PROJECT_ID,
        GCP_CLIENT_EMAIL,
        GCP_PRIVATE_KEY
    } = process.env;

    const PUBSUB_TOPIC = 'input-streams';

    if (!GCP_PROJECT_ID || !GCP_CLIENT_EMAIL || !GCP_PRIVATE_KEY) {
        const errorMsg = 'Server configuration error: Google Cloud credentials for Pub/Sub are not fully set.';
        console.error(errorMsg);
        return { success: false, error: errorMsg };
    }

    try {
        const pubsub = new PubSub({
          projectId: GCP_PROJECT_ID,
          credentials: {
            client_email: GCP_CLIENT_EMAIL,
            private_key: GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }
        });
        
        const messageData = JSON.stringify(params);
        const dataBuffer = Buffer.from(messageData);

        const messageId = await pubsub.topic(PUBSUB_TOPIC).publishMessage({ data: dataBuffer });
        console.log(`Message ${messageId} published to input-streams for video_id ${params.video_id}.`);

        return { success: true, messageId };

    } catch(pubsubError) {
        console.error(`Error publishing to input-streams for video_id ${params.video_id}:`, pubsubError);
        const errorMessage = pubsubError instanceof Error ? pubsubError.message : 'An unknown error occurred.';
        return { success: false, error: errorMessage };
    }
}

export async function publishVideoAnalysis(params: PublishVideoAnalysisParams): Promise<{success: boolean, messageId?: string, error?: string}> {
    const {
        GCP_PROJECT_ID,
        GCP_CLIENT_EMAIL,
        GCP_PRIVATE_KEY,
        GCP_PUBSUB_TOPIC_ID
    } = process.env;

    if (!GCP_PROJECT_ID || !GCP_CLIENT_EMAIL || !GCP_PRIVATE_KEY || !GCP_PUBSUB_TOPIC_ID) {
        const errorMsg = 'Server configuration error: Google Cloud credentials for Pub/Sub are not fully set.';
        console.error(errorMsg);
        return { success: false, error: errorMsg };
    }

    try {
        const pubsub = new PubSub({
          projectId: GCP_PROJECT_ID,
          credentials: {
            client_email: GCP_CLIENT_EMAIL,
            private_key: GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }
        });
        
        const messageData = JSON.stringify(params);
        const dataBuffer = Buffer.from(messageData);

        const messageId = await pubsub.topic(GCP_PUBSUB_TOPIC_ID).publishMessage({ data: dataBuffer });
        console.log(`Message ${messageId} published for video_id ${params.video_id}.`);

        return { success: true, messageId };

    } catch(pubsubError) {
        console.error(`Error publishing notification for video_id ${params.video_id}:`, pubsubError);
        const errorMessage = pubsubError instanceof Error ? pubsubError.message : 'An unknown error occurred.';
        return { success: false, error: errorMessage };
    }
}

export async function getIncidents(): Promise<{ incidents?: Incident[], error?: string }> {
    try {
        const incidents = await getIncidentsFromFirestore();
        return { incidents };
    } catch (error) {
        console.error("Error fetching incidents in server action:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        return { error: `Could not fetch incidents: ${errorMessage}` };
    }
}
