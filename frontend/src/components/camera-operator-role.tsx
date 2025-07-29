
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Video, VideoOff, Play, Pause, AlertTriangle, MapPin, Loader2, UploadCloud, CheckCircle2, FileClock, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGeolocation } from "@/hooks/use-geolocation";
import { uploadVideoChunkToGcs, reverseGeocode, uploadImageFrameToGcs, uploadFullVideoToGcs, publishToRawVideoStream } from "@/app/actions";
import { Badge } from "@/components/ui/badge";


type PatrolStatus = "idle" | "recording" | "error";
type UploadStatus = "pending" | "uploading" | "success" | "error";

interface UploadingFile {
  id: string; // videoId
  fileName: string;
  timestamp: string;
  status: UploadStatus;
  type: 'video' | 'image';
}

interface UploadTracker {
    video_uri?: string;
    image_uri?: string;
}

export function CameraOperatorRole() {
  const [zoneName, setZoneName] = useState("Zone_A");
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [status, setStatus] = useState<PatrolStatus>("idle");
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [address, setAddress] = useState<string | null>(null);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fullVideoRecorderRef = useRef<MediaRecorder | null>(null);
  const fullVideoChunksRef = useRef<Blob[]>([]);
  const patrolTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Store the latest coordinates in a ref so they're always accessible
  const latestCoordinatesRef = useRef<{latitude: number, longitude: number} | null>(null);

  const statusRef = useRef(status);
  const uploadTrackerRef = useRef(new Map<string, UploadTracker>());

  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  
  const { toast } = useToast();
  // Always get location data, not just during recording
  const { coordinates, error: locationError, isLoading: isLocationLoading } = useGeolocation(true);

  // Update the coordinates ref whenever coordinates change
  useEffect(() => {
    if (coordinates) {
      console.log(`[useEffect] Updating latest coordinates: ${coordinates.latitude}, ${coordinates.longitude}`);
      latestCoordinatesRef.current = coordinates;
    }
  }, [coordinates]);

  const getDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true }); // Prompt for permission first
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      setVideoDevices(videoInputs);

      if (videoInputs.length > 0) {
        // Prefer the back camera on mobile by default
        const backCamera = videoInputs.find(device => device.label.toLowerCase().includes('back'));
        if (isMobile && backCamera) {
          setSelectedDeviceId(backCamera.deviceId);
        } else {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      }
    } catch(err) {
      console.error("Error enumerating devices:", err)
      setHasCameraPermission(false);
    }
  }, [isMobile]);

  useEffect(() => {
    const mobileCheck = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setIsMobile(mobileCheck);
    getDevices();
  }, [getDevices]);


  useEffect(() => {
    if (coordinates) {
        setIsFetchingAddress(true);
        reverseGeocode({ lat: coordinates.latitude, lng: coordinates.longitude })
            .then(result => {
                if (result.address) {
                    setAddress(result.address);
                } else if (result.error) {
                    console.warn("Could not fetch address:", result.error);
                    setAddress("Could not retrieve address.");
                }
            })
            .finally(() => {
                setIsFetchingAddress(false);
            });
    } else {
      setAddress(null);
    }
  }, [coordinates]);

  const checkAndPublish = useCallback(async (videoId: string, timestamp: Date) => {
    console.log(`[checkAndPublish] Starting for videoId: ${videoId}, timestamp: ${timestamp.toISOString()}`);
    
    const tracker = uploadTrackerRef.current.get(videoId);
    if (!tracker) {
      console.error(`[checkAndPublish] No tracker found for videoId: ${videoId}`);
      return;
    }
    
    console.log(`[checkAndPublish] Tracker state:`, {
      hasVideoUri: !!tracker.video_uri, 
      hasImageUri: !!tracker.image_uri
    });
    
    if (tracker && tracker.video_uri && tracker.image_uri) {
        console.log(`[checkAndPublish] Required URIs found, checking coordinates and device ID`);
        console.log(`[checkAndPublish] Current coordinates:`, coordinates);
        console.log(`[checkAndPublish] Latest coordinates ref:`, latestCoordinatesRef.current);
        console.log(`[checkAndPublish] Selected device ID:`, selectedDeviceId ? `${selectedDeviceId.substring(0, 8)}...` : 'undefined');
        
        // Use latestCoordinatesRef if current coordinates are null
        const coordsToUse = coordinates || latestCoordinatesRef.current;
        
        if (!coordsToUse) {
            console.error(`[checkAndPublish] Missing coordinates for videoId: ${videoId}`);
            return;
        }
        
        if (!selectedDeviceId) {
            console.error(`[checkAndPublish] Missing deviceId for videoId: ${videoId}`);
            return;
        }

        try {
            console.log(`[checkAndPublish] Publishing to input-streams for videoId: ${videoId}`);
            // Only send to input-streams topic
            await publishToRawVideoStream({
                video_id: videoId,
                camera_id: `cam_${selectedDeviceId.substring(0, 8)}`,
                zone_id: zoneName,
                location_lat: coordsToUse.latitude,
                location_long: coordsToUse.longitude,
                timestamp: timestamp.toISOString(),
                image_uri: tracker.image_uri,
                video_uri: tracker.video_uri,
            });
            console.log(`[checkAndPublish] Successfully published for videoId: ${videoId}`);
        } catch (e) {
            console.error(`[checkAndPublish] Failed to publish for videoId: ${videoId}`, e);
        } finally {
            // Clean up the tracker for this video ID
            uploadTrackerRef.current.delete(videoId);
            console.log(`[checkAndPublish] Cleaned up tracker for videoId: ${videoId}`);
        }
    } else {
        console.log(`[checkAndPublish] Missing URIs for videoId: ${videoId}`, {
            hasVideoUri: !!tracker.video_uri,
            hasImageUri: !!tracker.image_uri
        });
    }
  }, [coordinates, selectedDeviceId, zoneName]);


  const handleDataAvailable = useCallback(async (event: BlobEvent) => {
    if (event.data.size > 0) {
      const videoBlob = new Blob([event.data], { type: 'video/webm;codecs=vp9,opus' });
      const timestamp = new Date();
      const videoId = (event.target as any).videoId as string; // Retrieve the videoId
      const fileName = `patrol-video-${timestamp.toISOString().replace(/[:.]/g, '-')}.webm`;
      const fileId = `${videoId}-video`;

      console.log(`[handleDataAvailable] Processing video chunk, videoId: ${videoId}, size: ${(videoBlob.size / 1024).toFixed(2)} KB`);

      setUploadingFiles(prev => [{
          id: fileId,
          fileName,
          timestamp: timestamp.toLocaleTimeString(),
          status: 'uploading',
          type: 'video',
      }, ...prev]);

      try {
          const reader = new FileReader();
          reader.readAsDataURL(videoBlob);
          reader.onloadend = async () => {
              const base64data = reader.result as string;
              
              console.log(`[handleDataAvailable] FileReader loaded, uploading video to GCS, videoId: ${videoId}`);
              
              const result = await uploadVideoChunkToGcs({
                  videoDataUrl: base64data,
                  fileName: fileName,
                  zoneName: zoneName,
              });

              console.log(`[handleDataAvailable] Video upload result:`, { 
                videoId, 
                success: result.success, 
                hasGcsUri: !!result.gcsUri
              });

              setUploadingFiles(prev => prev.map(f => 
                  f.id === fileId 
                      ? { ...f, status: result.success ? 'success' : 'error' } 
                      : f
              ));

              if (result.success && result.gcsUri) {
                  console.log(`[handleDataAvailable] Setting video_uri in tracker for videoId: ${videoId}`);
                  const tracker = uploadTrackerRef.current.get(videoId) || {};
                  tracker.video_uri = result.gcsUri;
                  uploadTrackerRef.current.set(videoId, tracker);
                  checkAndPublish(videoId, timestamp);
              } else if (result.error) {
                  console.error(`[handleDataAvailable] Upload failed for videoId: ${videoId}, error:`, result.error);
                  toast({ variant: "destructive", title: "Upload Failed", description: `Could not upload ${fileName}: ${result.error}` });
              }
          };
      } catch (error) {
          console.error(`[handleDataAvailable] Error processing video for videoId: ${videoId}:`, error);
          setUploadingFiles(prev => prev.map(f => 
              f.id === fileId ? { ...f, status: 'error' } : f
          ));
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
          toast({ variant: "destructive", title: "Upload Preparation Failed", description: errorMessage });
      }
    }
  }, [zoneName, toast, checkAndPublish]);

  const captureAndUploadFrame = useCallback(async (videoId: string, timestamp: Date) => {
    console.log(`[captureAndUploadFrame] Starting for videoId: ${videoId}`);
    
    if (!videoRef.current || !canvasRef.current || !zoneName) {
        console.error(`[captureAndUploadFrame] Missing required references for videoId: ${videoId}`, {
          hasVideoRef: !!videoRef.current,
          hasCanvasRef: !!canvasRef.current,
          zoneName
        });
        return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    console.log(`[captureAndUploadFrame] Video dimensions: ${video.videoWidth}x${video.videoHeight} for videoId: ${videoId}`);
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        const fileName = `patrol-frame-${timestamp.toISOString().replace(/[:.]/g, '-')}.jpg`;
        const fileId = `${videoId}-image`;
        
        console.log(`[captureAndUploadFrame] Captured frame, uploading for videoId: ${videoId}`);
        
        setUploadingFiles(prev => [{
            id: fileId,
            fileName: fileName,
            timestamp: timestamp.toLocaleTimeString(),
            status: 'uploading',
            type: 'image'
        }, ...prev]);

        try {
            const result = await uploadImageFrameToGcs({
                imageDataUrl,
                fileName,
                zoneName,
            });

            console.log(`[captureAndUploadFrame] Frame upload result:`, {
              videoId,
              success: result.success,
              hasGcsUri: !!result.gcsUri
            });

            setUploadingFiles(prev => prev.map(f => 
                f.id === fileId 
                    ? { ...f, status: result.success ? 'success' : 'error' } 
                    : f
            ));

            if (result.success && result.gcsUri) {
                 console.log(`[captureAndUploadFrame] Setting image_uri in tracker for videoId: ${videoId}`);
                 const tracker = uploadTrackerRef.current.get(videoId) || {};
                 tracker.image_uri = result.gcsUri;
                 uploadTrackerRef.current.set(videoId, tracker);
                 checkAndPublish(videoId, timestamp);
            } else if (result.error) {
                console.error(`[captureAndUploadFrame] Frame upload failed for videoId: ${videoId}, error:`, result.error);
                toast({ variant: 'destructive', title: "Frame Upload Failed", description: result.error });
            }
        } catch (error) {
             console.error(`[captureAndUploadFrame] Error processing frame for videoId: ${videoId}:`, error);
             setUploadingFiles(prev => prev.map(f => 
                f.id === fileId ? { ...f, status: 'error' } : f
            ));
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            toast({ variant: 'destructive', title: 'Frame Upload Failed', description: errorMessage });
        }
    } else {
        console.error(`[captureAndUploadFrame] Could not get canvas context for videoId: ${videoId}`);
    }
}, [zoneName, checkAndPublish, toast]);


  const startStream = useCallback(async (deviceId: string) => {
    // Stop any existing stream
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }

    try {
        const constraints: MediaStreamConstraints = {
            audio: true,
            video: {
                deviceId: { exact: deviceId },
            }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        mediaStreamRef.current = stream;
        setHasCameraPermission(true);

        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({ variant: 'destructive', title: 'Camera Access Denied', description: 'Please enable camera and microphone permissions.' });
        setStatus('idle');
    }
  }, [toast]);
  
  const recordAndUploadChunk = useCallback(() => {
    if (!mediaStreamRef.current) {
        console.error("No media stream available to record.");
        if (statusRef.current === 'recording') {
            toast({ variant: 'destructive', title: 'Recording Error', description: 'Media stream lost. Please restart recording.'});
            setStatus('error');
        }
        return;
    }

    try {
        const mimeType = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            toast({ variant: 'destructive', title: 'Unsupported Browser', description: 'VP9/Opus codecs not supported.' });
            setStatus('error');
            return;
        }

        mediaRecorderRef.current = new MediaRecorder(mediaStreamRef.current, { mimeType });
        
        const videoId = crypto.randomUUID();
        (mediaRecorderRef.current as any).videoId = videoId; 

        mediaRecorderRef.current.ondataavailable = handleDataAvailable;
        
        mediaRecorderRef.current.onstop = () => {
            if (statusRef.current === 'recording') {
                recordAndUploadChunk();
            }
        };

        mediaRecorderRef.current.start();
        
        const timestamp = new Date();
        // Use a small timeout to ensure the video has started rendering on the canvas
        setTimeout(() => captureAndUploadFrame(videoId, timestamp), 100);

        patrolTimeoutRef.current = setTimeout(() => {
            if (mediaRecorderRef.current?.state === "recording") {
                mediaRecorderRef.current.stop();
            }
        }, 10000); // Record for 10 seconds

    } catch (e) {
        console.error("Error setting up media recorder:", e);
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
        toast({ variant: 'destructive', title: 'Recording Error', description: `Could not start recorder: ${errorMessage}` });
        setStatus('error');
    }
  }, [handleDataAvailable, toast, captureAndUploadFrame]);
  
  const setupFullVideoRecorder = useCallback(() => {
    if (!mediaStreamRef.current) {
        console.error("No media stream available for full recording.");
        return;
    }
    
    fullVideoChunksRef.current = []; // Clear previous chunks
    const mimeType = 'video/webm;codecs=vp9,opus';
    fullVideoRecorderRef.current = new MediaRecorder(mediaStreamRef.current, { mimeType });

    fullVideoRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
            fullVideoChunksRef.current.push(event.data);
        }
    };
    
    fullVideoRecorderRef.current.onstop = async () => {
        const fullVideoBlob = new Blob(fullVideoChunksRef.current, { type: mimeType });
        const timestamp = new Date();
        const fileName = `full-patrol-${timestamp.toISOString().replace(/[:.]/g, '-')}.webm`;

        toast({ title: "Uploading full video archive...", description: fileName });

        try {
            const reader = new FileReader();
            reader.readAsDataURL(fullVideoBlob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;
                const result = await uploadFullVideoToGcs({
                    videoDataUrl: base64data,
                    fileName,
                    zoneName
                });

                if (result.success) {
                    toast({ title: "Full Video Uploaded", description: `Successfully uploaded ${fileName}` });
                } else {
                    toast({ variant: 'destructive', title: "Full Video Upload Failed", description: result.error });
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            toast({ variant: 'destructive', title: 'Full Video Upload Failed', description: errorMessage });
        }
    };
    
    fullVideoRecorderRef.current.start();
  }, [zoneName, toast]);

  const handleStartRecording = async () => {
    if (status !== 'idle' || !selectedDeviceId) return;

    if (!zoneName.trim()) {
      toast({ variant: "destructive", title: "Zone Name Required" });
      return;
    }
    
    setStatus("recording");
    setUploadingFiles([]);
    uploadTrackerRef.current.clear();
    toast({ title: "Recording Started", description: `Recording patrol in zone: ${zoneName}.` });
    
    await startStream(selectedDeviceId);

    setTimeout(() => {
        recordAndUploadChunk();
        setupFullVideoRecorder();
    }, 500); 
  };

  const handleStopRecording = () => {
    setStatus("idle");
    
    if (patrolTimeoutRef.current) {
      clearTimeout(patrolTimeoutRef.current);
      patrolTimeoutRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    
    if (fullVideoRecorderRef.current && fullVideoRecorderRef.current.state === 'recording') {
        fullVideoRecorderRef.current.stop();
    }
    fullVideoRecorderRef.current = null;

    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }

    toast({ title: "Recording Stopped" });
  };

  const handleSwitchCamera = () => {
    if (videoDevices.length > 1 && selectedDeviceId) {
        const currentIndex = videoDevices.findIndex(device => device.deviceId === selectedDeviceId);
        const nextIndex = (currentIndex + 1) % videoDevices.length;
        const nextDeviceId = videoDevices[nextIndex].deviceId;
        setSelectedDeviceId(nextDeviceId);
        
        if (statusRef.current === 'recording') {
          startStream(nextDeviceId).then(() => {
             if (mediaRecorderRef.current?.state === "recording") {
                 mediaRecorderRef.current.stop();
             }
             if (fullVideoRecorderRef.current?.state === "recording") {
                fullVideoRecorderRef.current.stop();
                setupFullVideoRecorder();
             }
          });
        }
    }
  };

  useEffect(() => {
    return () => {
      handleStopRecording();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayedFiles = uploadingFiles.filter(f => f.type === 'video');

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start mt-4">
      <canvas ref={canvasRef} className="hidden" />
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Operator Control</CardTitle>
            <CardDescription>Enter your assigned zone and manage your recording.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="zone-name" className="text-base font-semibold">Zone Name</Label>
              <Input 
                id="zone-name" 
                placeholder="e.g., North Sector 7" 
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                disabled={status === 'recording'}
              />
            </div>
            
            <div className="space-y-4">
              {status === 'recording' ? (
                  <Button onClick={handleStopRecording} variant="destructive" size="lg" className="w-full">
                      <Pause className="mr-2" /> Stop Recording
                  </Button>
              ) : (
                  <Button onClick={handleStartRecording} size="lg" className="w-full" disabled={!zoneName.trim() || hasCameraPermission === false || !selectedDeviceId}>
                      <Play className="mr-2" /> Start Recording
                  </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl flex items-center">
                    <FileClock className="mr-2" /> Upload Queue
                </CardTitle>
                 <CardDescription>Status of your 10-second patrol video chunks.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[240px] w-full">
                  <div className="space-y-3 pr-4">
                    {displayedFiles.length === 0 ? (
                      <p className="text-sm text-muted-foreground pt-4 text-center">Start recording to begin uploading chunks.</p>
                    ) : (
                      displayedFiles.map(file => (
                        <div key={file.id} className="flex items-center justify-between rounded-md border p-3">
                          <div className="truncate">
                            <p className="text-sm font-medium truncate" title={file.fileName}>{file.fileName}</p>
                            <p className="text-xs text-muted-foreground">{file.timestamp}</p>
                          </div>
                          <Badge variant={file.status === 'success' ? 'default' : file.status === 'error' ? 'destructive' : 'secondary'} className="capitalize">
                            {file.status === 'uploading' && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                            {file.status === 'success' && <CheckCircle2 className="mr-2 h-3 w-3" />}
                            {file.status === 'error' && <AlertTriangle className="mr-2 h-3 w-3" />}
                            {file.status}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl flex items-center">
                    <MapPin className="mr-2" /> Location Status
                </CardTitle>
                <CardDescription>Your current GPS coordinates and address.</CardDescription>
            </CardHeader>
            <CardContent>
                {(isLocationLoading && status === 'recording') && (
                    <div className="flex items-center text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Acquiring GPS signal...
                    </div>
                )}
                {locationError && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Location Error</AlertTitle>
                        <AlertDescription>{locationError}</AlertDescription>
                    </Alert>
                )}
                {coordinates && (
                    <div className="space-y-2">
                        <div className="flex items-center space-x-4 text-sm">
                            <span>Lat: <span className="font-mono text-primary">{coordinates.latitude.toFixed(6)}</span></span>
                            <span>Lon: <span className="font-mono text-primary">{coordinates.longitude.toFixed(6)}</span></span>
                        </div>
                        <div className="text-sm">
                            {isFetchingAddress ? (
                                <div className="flex items-center text-muted-foreground">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Fetching address...
                                </div>
                            ) : (
                                <p className="text-foreground">{address || "Address not available."}</p>
                            )}
                        </div>
                    </div>
                )}
                 {status !== 'recording' && !isLocationLoading && (
                    <p className="text-sm text-muted-foreground">Start recording to begin location tracking.</p>
                )}
            </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center">
            <Video className="mr-2" /> Live Camera Feed
          </CardTitle>
          <CardDescription>Your real-time video feed for event monitoring.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
            <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
            
            {status === 'recording' && (
                 <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-destructive/80 px-3 py-1 text-xs font-semibold text-destructive-foreground">
                    <div className="h-2 w-2 rounded-full bg-white animate-pulse"></div>
                    REC
                </div>
            )}

            {isMobile && videoDevices.length > 1 && status === 'recording' && (
              <Button onClick={handleSwitchCamera} variant="outline" size="icon" className="absolute top-3 right-3 rounded-full bg-background/50 hover:bg-background/80">
                  <RefreshCw className="h-5 w-5" />
                  <span className="sr-only">Switch Camera</span>
              </Button>
            )}

            {hasCameraPermission === false && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 p-4 text-center">
                 <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                 <AlertTitle className="text-xl font-bold">Camera Access Required</AlertTitle>
                 <AlertDescription className="mt-2">
                    Please allow camera access in your browser settings to use this feature.
                 </AlertDescription>
              </div>
            )}
             {hasCameraPermission === true && status !== 'recording' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                    <VideoOff className="h-16 w-16 text-white/70" />
                    <p className="mt-4 text-lg font-semibold text-white">Recording is Inactive</p>
                </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
    
    