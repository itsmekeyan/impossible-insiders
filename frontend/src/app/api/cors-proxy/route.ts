import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    
    if (!url) {
      return NextResponse.json({ error: 'Missing URL parameter' }, { status: 400 });
    }

    // Only allow proxying URLs from Google Cloud Storage to prevent abuse
    if (!url.startsWith('https://storage.googleapis.com/') && !url.startsWith('https://storage.cloud.google.com/')) {
      return NextResponse.json({ error: 'URL must be from Google Cloud Storage' }, { status: 403 });
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'image/*, video/*, application/octet-stream',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch content: ${response.status} ${response.statusText}` }, { 
        status: response.status 
      });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'public, max-age=3600', // 1 hour cache
      },
    });
  } catch (error) {
    console.error('CORS proxy error:', error);
    return NextResponse.json({ error: 'Failed to proxy request' }, { status: 500 });
  }
} 