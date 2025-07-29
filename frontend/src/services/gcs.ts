
import { GetSignedUrlConfig, Storage } from '@google-cloud/storage';
import { PublishVideoAnalysisParams } from '@/app/actions';
import type { VideoFile } from '@/app/actions';

export interface FileUploadParams {
    bucketName: string;
    projectId: string;
    clientEmail: string;
    privateKey: string;
    dataUrl: string;
    filePath: string;
    fileType: 'video' | 'image';
}

export async function uploadFile({
    bucketName,
    projectId,
    clientEmail,
    privateKey,
    dataUrl,
    filePath,
    fileType,
}: FileUploadParams): Promise<{ success: boolean; gcsUri?: string; error?: string }> {

    if (!dataUrl) return { success: false, error: `No ${fileType} data found.` };

    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        return { success: false, error: `Invalid ${fileType} data format.` };
    }
    
    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    
    const storage = new Storage({
        projectId: projectId,
        credentials: {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n'),
        }
    });
  
    const bucket = storage.bucket(bucketName);
    const gcsFile = bucket.file(filePath);

    try {
        await gcsFile.save(buffer, {
            metadata: { 
                contentType,
                cacheControl: 'public, max-age=86400' // 1 day caching
            },
            resumable: false,
        });
        
        const gcsUri = `gs://${bucketName}/${filePath}`;
        console.log(`Successfully uploaded ${fileType} to ${gcsUri}.`);
        
        return { success: true, gcsUri: gcsUri };

    } catch (uploadError) {
        console.error(`GCS upload failed for ${filePath}:`, uploadError);
        const errorMessage = uploadError instanceof Error ? uploadError.message : 'An unknown GCS error occurred.';
        return { success: false, error: errorMessage };
    }
}

interface ListFilesParams {
    bucketName: string;
    projectId: string;
    clientEmail: string;
    privateKey: string;
    prefix: string;
}

export async function listFiles({
    bucketName,
    projectId,
    clientEmail,
    privateKey,
    prefix,
}: ListFilesParams): Promise<{ videoFiles?: VideoFile[], error?: string }> {
    try {
        const storage = new Storage({
            projectId: projectId,
            credentials: {
                client_email: clientEmail,
                private_key: privateKey.replace(/\\n/g, '\n'),
            }
        });

        const bucket = storage.bucket(bucketName);
        const [files] = await bucket.getFiles({ prefix: prefix });
        
        if (files.length === 0) {
            return { videoFiles: [] };
        }
        
        const signedUrlConfig: GetSignedUrlConfig = {
            version: 'v4',
            action: 'read',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
            // Add CORS related headers for browser compatibility
            responseDisposition: 'inline',
            responseType: files[0].metadata?.contentType || 'video/webm'
        };

        const videoFilesPromises = files.map(async (file) => {
            try {
                const [url] = await file.getSignedUrl(signedUrlConfig);
                return { 
                    name: file.name.split('/').pop() || file.name,
                    url 
                };
            } catch (signError) {
                console.error(`Error signing URL for ${file.name}:`, signError);
                // Return a placeholder instead of failing the whole operation
                return { 
                    name: file.name.split('/').pop() || file.name,
                    url: '' 
                };
            }
        });

        const videoFiles = await Promise.all(videoFilesPromises);
        // Filter out any files that failed to sign
        const validVideoFiles = videoFiles.filter(file => file.url !== '');
        
        return { videoFiles: validVideoFiles };

    } catch (error) {
        console.error('GCS listFiles error:', error);
        return { error: 'Failed to list or sign files in GCS.' };
    }
}

    