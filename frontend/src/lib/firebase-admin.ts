
import { Firestore } from '@google-cloud/firestore';
import { GetSignedUrlConfig, Storage } from '@google-cloud/storage';

export interface Incident {
  id: string;
  video_id: string;
  type: string;
  severity: string;
  zone_id: string;
  timestamp: string;
  source: string;
  details: {
    confidence: number;
    timestamps: { start: number; end: number }[];
    explanation: string;
  };
  status: string;
  image_uri: string;
  video_uri: string;
  location_lat: number;
  location_long: number;
}

let firestore: Firestore;
let storage: Storage;

const getFirestoreInstance = (): Firestore => {
  if (!firestore) {
    const { GCP_PROJECT_ID, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } = process.env;

    if (!GCP_PROJECT_ID || !GCP_CLIENT_EMAIL || !GCP_PRIVATE_KEY) {
      throw new Error('Google Cloud credentials (GCP_PROJECT_ID, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY) are not fully set in environment variables.');
    }
    
    firestore = new Firestore({
      projectId: GCP_PROJECT_ID,
      credentials: {
        client_email: GCP_CLIENT_EMAIL,
        private_key: GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
    });
  }
  return firestore;
};

const getStorageInstance = (): Storage => {
    if (!storage) {
        const { GCP_PROJECT_ID, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } = process.env;

        if (!GCP_PROJECT_ID || !GCP_CLIENT_EMAIL || !GCP_PRIVATE_KEY) {
            throw new Error('Google Cloud credentials for Storage are not fully set.');
        }

        storage = new Storage({
            projectId: GCP_PROJECT_ID,
            credentials: {
                client_email: GCP_CLIENT_EMAIL,
                private_key: GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
            },
        });
    }
    return storage;
}

async function getSignedUrl(gcsUri: string): Promise<string> {
    if (!gcsUri || !gcsUri.startsWith('gs://')) {
        return '';
    }
    try {
        const storage = getStorageInstance();
        const [bucketName, ...filePathParts] = gcsUri.replace('gs://', '').split('/');
        const filePath = filePathParts.join('/');
        
        const options: GetSignedUrlConfig = {
            version: 'v4',
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        };

        const [signedUrl] = await storage.bucket(bucketName).file(filePath).getSignedUrl(options);
        return signedUrl;
    } catch (error) {
        console.error(`Failed to get signed URL for ${gcsUri}:`, error);
        return ''; // Return empty string on error
    }
}


export async function getIncidentsFromFirestore(): Promise<Incident[]> {
    try {
        const db = getFirestoreInstance();
        const incidentsCollection = db.collection('aggregrated_incidents');
        const snapshot = await incidentsCollection.orderBy('timestamp', 'desc').get();

        if (snapshot.empty) {
            console.log('No matching documents in "incidents" collection.');
            return [];
        }

        const incidentsPromises: Promise<Incident>[] = snapshot.docs.map(async (doc) => {
            const data = doc.data();
            
            const [imageUrl, videoUrl] = await Promise.all([
                getSignedUrl(data.image_uri),
                getSignedUrl(data.video_uri)
            ]);
            
            return {
                id: doc.id,
                video_id: data.video_id,
                type: data.type,
                severity: data.severity,
                zone_id: data.zone_id,
                timestamp: data.timestamp,
                source: data.source,
                details: data.details,
                status: data.status,
                image_uri: imageUrl,
                video_uri: videoUrl,
                location_lat: data.location_lat,
                location_long: data.location_long,
            } as Incident;
        });
        
        const incidents = await Promise.all(incidentsPromises);
        return incidents;

    } catch (error) {
        console.error("Error fetching data from Firestore: ", error);
        throw error;
    }
}
