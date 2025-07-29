import { NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bucket = searchParams.get('bucket');
    const object = searchParams.get('object');
    
    if (!bucket || !object) {
      return NextResponse.json(
        { error: 'Missing required parameters: bucket and object' },
        { status: 400 }
      );
    }

    const { 
      GCP_PROJECT_ID, 
      GCP_CLIENT_EMAIL, 
      GCP_PRIVATE_KEY 
    } = process.env;

    if (!GCP_PROJECT_ID || !GCP_CLIENT_EMAIL || !GCP_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error: Google Cloud credentials are not fully set' },
        { status: 500 }
      );
    }

    const storage = new Storage({
      projectId: GCP_PROJECT_ID,
      credentials: {
        client_email: GCP_CLIENT_EMAIL,
        private_key: GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }
    });

    // Determine the content type based on the file extension
    const isImage = object.toLowerCase().endsWith('.jpg') || 
                   object.toLowerCase().endsWith('.jpeg') || 
                   object.toLowerCase().endsWith('.png');
    const contentType = isImage ? 'image/jpeg' : 'video/webm';

    // Generate a signed URL with a 15-minute expiration
    const [signedUrl] = await storage
      .bucket(bucket)
      .file(object)
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        responseDisposition: 'inline',
        responseType: contentType,
      });

    return NextResponse.json({ signedUrl });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed URL' },
      { status: 500 }
    );
  }
} 