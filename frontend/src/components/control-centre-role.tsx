
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, Loader2, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { uploadVideoChunkToGcs, uploadImageFrameToGcs, publishToRawVideoStream } from "@/app/actions";
import { useToast } from "@/hooks/use-toast";
import { ZoneGcsVideoPlayer } from "./zone-gcs-video-player";

interface VideoFeed {
    camera_id: string;
    zone_id: string;
    source: 'local' | 'gcs';
    location_lat: string;
    location_long: string;
    video_path: string;
}

interface UploadTracker {
    video_uri?: string;
    image_uri?: string;
}

export function ControlCentreRole() {
    const [isStreaming, setIsStreaming] = useState(false);
    const [videoFeeds, setVideoFeeds] = useState<VideoFeed[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
    const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
    const mediaRecorderRefs = useRef<(MediaRecorder | null)[]>([]);
    const processingIntervals = useRef<NodeJS.Timeout[]>([]);
    const uploadTrackerRef = useRef(new Map<string, UploadTracker>());

    const { toast } = useToast();

    useEffect(() => {
        async function fetchMetadata() {
            try {
                const response = await fetch('/metadata.json');
                if (!response.ok) {
                    throw new Error(`Failed to fetch metadata: ${response.statusText}`);
                }
                const data = await response.json();
                
                const formattedData = data.map((feed: any) => ({
                    ...feed,
                    video_path: feed.source === 'local' ? feed.video_path.replace('public/', '/') : feed.video_path,
                }));

                setVideoFeeds(formattedData);
                const localVideoCount = formattedData.filter((f: VideoFeed) => f.source === 'local').length;
                videoRefs.current = new Array(localVideoCount).fill(null);
                canvasRefs.current = new Array(localVideoCount).fill(null);
                mediaRecorderRefs.current = new Array(localVideoCount).fill(null);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred');
                console.error("Error fetching video metadata:", err);
            } finally {
                setIsLoading(false);
            }
        }
        fetchMetadata();
    }, []);

    const checkAndPublish = useCallback(async (videoId: string, feed: VideoFeed, timestamp: Date) => {
        console.log(`[checkAndPublish] Starting for videoId: ${videoId}, zone: ${feed.zone_id}`);
        
        const tracker = uploadTrackerRef.current.get(videoId);
        if (!tracker) {
            console.error(`[checkAndPublish] No tracker found for videoId: ${videoId}`);
            return;
        }
        
        console.log(`[checkAndPublish] Tracker state:`, {
            hasVideoUri: !!tracker.video_uri, 
            hasImageUri: !!tracker.image_uri
        });
        
        // Only proceed if both URIs are available
        if (!tracker.video_uri || !tracker.image_uri) {
            console.log(`[checkAndPublish] Still waiting for URIs for videoId: ${videoId}`, {
                hasVideoUri: !!tracker.video_uri,
                hasImageUri: !!tracker.image_uri
            });
            return;
        }
            
        console.log(`[checkAndPublish] Required URIs found, checking feed data`);
        console.log(`[checkAndPublish] Feed coordinates:`, {
            lat: feed.location_lat,
            long: feed.location_long
        });
        
        try {
            // Make sure we have valid coordinates before publishing
            if (!feed.location_lat || !feed.location_long) {
                console.error(`[checkAndPublish] Missing coordinates for feed ${feed.zone_id}`);
                return;
            }
            
            console.log(`[checkAndPublish] Publishing to input-streams for videoId: ${videoId}`);
            // Only send to the input-streams topic
            const publishResult = await publishToRawVideoStream({
                video_id: videoId,
                camera_id: feed.camera_id,
                zone_id: feed.zone_id,
                location_lat: parseFloat(feed.location_lat),
                location_long: parseFloat(feed.location_long),
                timestamp: timestamp.toISOString(),
                image_uri: tracker.image_uri,
                video_uri: tracker.video_uri,
            });
            
            if (publishResult.success) {
                console.log(`[checkAndPublish] Successfully published for videoId: ${videoId}, messageId: ${publishResult.messageId}`);
            } else {
                console.error(`[checkAndPublish] Failed to publish, error:`, publishResult.error);
            }
        } catch (e) {
            console.error(`[checkAndPublish] Failed to publish for videoId: ${videoId}, zone: ${feed.zone_id}:`, e);
        } finally {
            // Clean up the tracker for this video ID
            uploadTrackerRef.current.delete(videoId);
            console.log(`[checkAndPublish] Cleaned up tracker for videoId: ${videoId}`);
        }
    }, []);

    const captureAndUploadFrame = useCallback(async (index: number, videoId: string, timestamp: Date) => {
        const localFeeds = videoFeeds.filter(f => f.source === 'local');
        const video = videoRefs.current[index];
        const canvas = canvasRefs.current[index];
        const feed = localFeeds[index];

        console.log(`[captureAndUploadFrame] Starting for videoId: ${videoId}, zone: ${feed?.zone_id || 'unknown'}`);

        if (!video || !canvas || !feed) {
            console.error(`[captureAndUploadFrame] Missing required references for videoId: ${videoId}`, {
                hasVideo: !!video,
                hasCanvas: !!canvas,
                hasFeed: !!feed
            });
            return;
        }

        try {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            console.log(`[captureAndUploadFrame] Video dimensions: ${video.videoWidth}x${video.videoHeight} for videoId: ${videoId}`);
            
            const context = canvas.getContext('2d');
            if (!context) {
                console.error(`[captureAndUploadFrame] Could not get canvas context for videoId: ${videoId}`);
                return;
            }
            
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            
            const fileName = `frame-${timestamp.toISOString().replace(/[:.]/g, '-')}.jpg`;
            
            console.log(`[captureAndUploadFrame] Captured frame, uploading for videoId: ${videoId}, zone: ${feed.zone_id}`);

            const result = await uploadImageFrameToGcs({
                imageDataUrl,
                fileName,
                zoneName: feed.zone_id,
            });
            
            console.log(`[captureAndUploadFrame] Frame upload result:`, {
                videoId,
                zone: feed.zone_id,
                success: result.success,
                hasGcsUri: !!result.gcsUri
            });
            
            if (result.success && result.gcsUri) {
                console.log(`[captureAndUploadFrame] Setting image_uri in tracker for videoId: ${videoId}`);
                const tracker = uploadTrackerRef.current.get(videoId) || {};
                tracker.image_uri = result.gcsUri;
                uploadTrackerRef.current.set(videoId, tracker);
                
                // Check if we can publish immediately
                checkAndPublish(videoId, feed, timestamp);
            } else if (result.error) {
                console.error(`[captureAndUploadFrame] Frame upload failed for videoId: ${videoId}, zone: ${feed.zone_id}, error:`, result.error);
            }
        } catch (error) {
            console.error(`[captureAndUploadFrame] Exception during frame capture/upload for ${videoId}:`, error);
        }
    }, [videoFeeds, checkAndPublish]);

    const startProcessingForFeed = useCallback((index: number) => {
        const localFeeds = videoFeeds.filter(f => f.source === 'local');
        const videoElement = videoRefs.current[index];
        const feed = localFeeds[index];
        
        if (!videoElement || !feed) {
            console.error(`[startProcessingForFeed] Missing video element or feed for index: ${index}`);
            return;
        }

        console.log(`[startProcessingForFeed] Starting processing for zone: ${feed.zone_id}`);

        const stream = (videoElement as any).captureStream();
        if (!stream) {
            console.error(`[startProcessingForFeed] Could not capture stream for ${feed.zone_id}`);
            return;
        }

        // Function to start a new recording chunk
        const startNewChunk = () => {
            try {
                const mimeType = 'video/webm;codecs=vp9,opus';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    console.error('[startProcessingForFeed] VP9/Opus codecs not supported.');
                    return;
                }

                // Generate a new videoId for this chunk
                const videoId = crypto.randomUUID();
                console.log(`[startProcessingForFeed] Created new recorder with videoId: ${videoId}`);
                
                // Initialize the tracker for this video ID
                uploadTrackerRef.current.set(videoId, {});

                // Create a new recorder for this chunk
                const recorder = new MediaRecorder(stream, { mimeType });
                mediaRecorderRefs.current[index] = recorder;

                // Capture a frame immediately when we start recording
                const frameTimestamp = new Date();
                captureAndUploadFrame(index, videoId, frameTimestamp);
                
                recorder.ondataavailable = async (event: BlobEvent) => {
                    if (event.data.size > 0) {
                        const videoBlob = new Blob([event.data], { type: mimeType });
                        const timestamp = new Date();
                        const fileName = `patrol-video-${timestamp.toISOString().replace(/[:.]/g, '-')}.webm`;

                        console.log(`[startProcessingForFeed] Processing video chunk, videoId: ${videoId}, size: ${(videoBlob.size / 1024).toFixed(2)} KB`);

                        const reader = new FileReader();
                        reader.readAsDataURL(videoBlob);
                        reader.onloadend = () => {
                            console.log(`[startProcessingForFeed] FileReader loaded, uploading video to GCS, videoId: ${videoId}`);
                            
                            uploadVideoChunkToGcs({
                                videoDataUrl: reader.result as string,
                                fileName: fileName,
                                zoneName: feed.zone_id,
                            }).then(result => {
                                console.log(`[startProcessingForFeed] Video upload result:`, {
                                    videoId,
                                    zone: feed.zone_id,
                                    success: result.success,
                                    hasGcsUri: !!result.gcsUri
                                });
                                
                                if (result.success && result.gcsUri) {
                                    console.log(`[startProcessingForFeed] Setting video_uri in tracker for videoId: ${videoId}`);
                                    // Get the tracker (should exist, but create if it doesn't)
                                    const tracker = uploadTrackerRef.current.get(videoId) || {};
                                    tracker.video_uri = result.gcsUri;
                                    uploadTrackerRef.current.set(videoId, tracker);
                                    
                                    // Check if we can publish immediately
                                    checkAndPublish(videoId, feed, timestamp);
                                } else if (result.error) {
                                    console.error(`[startProcessingForFeed] Chunk upload failed for ${feed.zone_id}, error:`, result.error);
                                }
                            }).catch(err => {
                                console.error(`[startProcessingForFeed] Exception during video upload for ${videoId}:`, err);
                            });
                        };
                    }
                };

                // Start recording this chunk
                recorder.start();
                
                // Schedule this recorder to stop after chunk duration
                setTimeout(() => {
                    if (recorder.state === 'recording') {
                        console.log(`[startProcessingForFeed] Stopping recorder for videoId: ${videoId}`);
                        recorder.stop();
                    }
                }, 10000); // Record for 10 seconds
                
            } catch (e) {
                console.error(`[startProcessingForFeed] Error starting recorder for ${feed.zone_id}:`, e);
            }
        };

        // Start the first chunk immediately
        startNewChunk();
        
        // Set up the interval to start a new chunk every 10 seconds
        const interval = setInterval(() => {
            if (!isStreaming) return; // Don't start new chunks if we're not streaming
            startNewChunk();
        }, 10000);

        processingIntervals.current[index] = interval;

    }, [videoFeeds, captureAndUploadFrame, checkAndPublish, isStreaming]);

    const stopProcessing = useCallback(() => {
        console.log('[stopProcessing] Stopping all video processing and streaming');
        setIsStreaming(false);
        
        processingIntervals.current.forEach((interval, index) => {
            console.log(`[stopProcessing] Clearing interval for index ${index}`);
            clearInterval(interval);
        });
        
        mediaRecorderRefs.current.forEach((recorder, index) => {
            if (recorder?.state === 'recording') {
                console.log(`[stopProcessing] Stopping recorder for index ${index}`);
                recorder.stop();
            }
        });
        
        processingIntervals.current = [];
        uploadTrackerRef.current.clear();
        console.log('[stopProcessing] Cleared all upload trackers');
        
        const localVideoCount = videoFeeds.filter(f => f.source === 'local').length;
        mediaRecorderRefs.current = new Array(localVideoCount).fill(null);
        
        toast({ title: "Streaming and Archiving Stopped" });
        console.log('[stopProcessing] Processing stopped successfully');
    }, [videoFeeds, toast]);

    const handleStreamingToggle = () => {
        const nextIsStreaming = !isStreaming;
        
        videoRefs.current.forEach(video => {
            if (video) {
                if (nextIsStreaming) {
                    video.play().catch(e => console.error("Video play failed:", e));
                } else {
                    video.pause();
                    video.currentTime = 0;
                }
            }
        });

        if (nextIsStreaming) {
            setIsStreaming(true);
            const localFeeds = videoFeeds.filter(f => f.source === 'local');
            localFeeds.forEach((_, index) => {
                startProcessingForFeed(index);
            });
            toast({ title: "Streaming and Archiving Started", description: "Capturing 10-sec video chunks and frames for local feeds." });
        } else {
            stopProcessing();
        }
    };
    
    useEffect(() => {
        return () => {
            stopProcessing();
        };
    }, [stopProcessing]);

    const localFeeds = videoFeeds.filter(f => f.source === 'local');

    return (
        <div className="space-y-6">
            {localFeeds.map((feed, index) => (
                <canvas 
                    key={feed.camera_id} 
                    ref={(el) => { 
                        canvasRefs.current[index] = el; 
                    }} 
                    className="hidden" 
                />
            ))}

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight font-headline">Video Feeds</h2>
                    <p className="text-muted-foreground">Simulated and live video feeds from key zones.</p>
                </div>
                {!isLoading && !error && (
                    <Button onClick={handleStreamingToggle} size="lg" disabled={videoFeeds.length === 0} variant={isStreaming ? "destructive" : "default"}>
                        {isStreaming ? (
                            <>
                                <span className="relative flex h-3 w-3 mr-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                                </span>
                                Stop Streaming
                            </>
                        ) : "Start Streaming"}
                    </Button>
                )}
            </div>

            {isLoading && (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Card key={index} className="overflow-hidden relative group flex flex-col">
                             <CardContent className="p-0">
                                <Skeleton className="aspect-video w-full" />
                            </CardContent>
                            <CardHeader className="p-4 flex-grow">
                                <Skeleton className="h-5 w-3/4" />
                            </CardHeader>
                        </Card>
                    ))}
                 </div>
            )}

            {error && (
                 <Card className="flex flex-col items-center justify-center py-12">
                     <AlertTriangle className="w-12 h-12 text-destructive" />
                    <CardHeader>
                        <CardTitle className="text-destructive">Failed to Load Videos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">{error}</p>
                    </CardContent>
                 </Card>
            )}

            {!isLoading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {videoFeeds.map((feed, index) => {
                       if (feed.source === 'gcs') {
                           return <ZoneGcsVideoPlayer key={feed.camera_id} zoneName={feed.zone_id} isStreaming={isStreaming} />
                       }
                       
                       const localIndex = localFeeds.findIndex(f => f.camera_id === feed.camera_id);

                       return (
                        <Card key={feed.camera_id} className="overflow-hidden relative group flex flex-col">
                            <CardContent className="p-0">
                                <div className="aspect-video w-full bg-muted">
                                    <video
                                        ref={(el) => { 
                                            videoRefs.current[localIndex] = el; 
                                        }}
                                        className="h-full w-full object-cover"
                                        src={feed.video_path}
                                        crossOrigin="anonymous"
                                        loop
                                        muted
                                        playsInline
                                    >
                                        Your browser does not support the video tag.
                                    </video>
                                </div>
                            </CardContent>
                            <CardHeader className="p-4 flex-grow">
                                <CardTitle className="font-headline text-lg flex items-center truncate">
                                    <Video className="mr-2 h-5 w-5 flex-shrink-0" />
                                    <span className="truncate" title={feed.zone_id}>{feed.zone_id}</span>
                                </CardTitle>
                            </CardHeader>
                        </Card>
                       )
                    })}
                </div>
            )}
        </div>
    );
}

    