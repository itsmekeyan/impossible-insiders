
"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { getIncidents, uploadVideoChunkToGcs, uploadImageFrameToGcs, publishToRawVideoStream } from "@/app/actions";
import { Incident } from "@/lib/firebase-admin";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2, List, Activity, Filter, Video, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { IncidentTypePieChart } from "./incident-type-pie-chart";
import { IncidentsTable } from "./incidents-table";
import { IncidentZoneBarChart } from "./incident-zone-bar-chart";
import { IncidentSeverityPieChart } from "./incident-severity-pie-chart";
import { IncidentStatusBarChart } from "./incident-status-bar-chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { ZoneGcsVideoPlayer } from "./zone-gcs-video-player";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";


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


export function IncidentsDashboard() {
  const [allIncidents, setAllIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [severityFilter, setSeverityFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [videoFeeds, setVideoFeeds] = useState<VideoFeed[]>([]);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const mediaRecorderRefs = useRef<(MediaRecorder | null)[]>([]);
  const processingIntervals = useRef<NodeJS.Timeout[]>([]);
  const uploadTrackerRef = useRef(new Map<string, UploadTracker>());

  const { toast } = useToast();
  
  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
        setIsRefreshing(true);
    }

    try {
        const result = await getIncidents();
        if (result.error) {
            setError(result.error);
        } else if (result.incidents) {
            setAllIncidents(result.incidents);
            setLastRefreshed(new Date());
        }
    } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
        setIsLoading(false);
        if (isManualRefresh) {
            setIsRefreshing(false);
        }
    }
  }, []);

  useEffect(() => {
    fetchData(); // Initial fetch
    const interval = setInterval(() => fetchData(), 5000); // Auto-refresh every 5 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

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
                setVideoError(err instanceof Error ? err.message : 'An unknown error occurred');
            } finally {
                setIsVideoLoading(false);
            }
        }
        fetchMetadata();
    }, []);

  const { uniqueSeverities, uniqueZones, uniqueStatuses } = useMemo(() => {
    const severities = new Set<string>();
    const zones = new Set<string>();
    const statuses = new Set<string>();
    allIncidents.forEach(incident => {
      severities.add(incident.severity);
      zones.add(incident.zone_id);
      statuses.add(incident.status);
    });
    return {
      uniqueSeverities: Array.from(severities),
      uniqueZones: Array.from(zones),
      uniqueStatuses: Array.from(statuses),
    };
  }, [allIncidents]);

  const filteredIncidents = useMemo(() => {
    return allIncidents.filter(incident => {
      const severityMatch = severityFilter === 'all' || incident.severity === severityFilter;
      const zoneMatch = zoneFilter === 'all' || incident.zone_id === zoneFilter;
      const statusMatch = statusFilter === 'all' || incident.status === statusFilter;
      return severityMatch && zoneMatch && statusMatch;
    });
  }, [allIncidents, severityFilter, zoneFilter, statusFilter]);

  const filteredVideos = useMemo(() => {
      if (zoneFilter === 'all') return videoFeeds;
      return videoFeeds.filter(feed => feed.zone_id === zoneFilter);
  }, [videoFeeds, zoneFilter]);
  
  const localFeeds = useMemo(() => videoFeeds.filter(f => f.source === 'local'), [videoFeeds]);

  const {
    incidentsByType,
    incidentsByZone,
    incidentsBySeverity,
    incidentsByStatus,
  } = useMemo(() => {
    const countBy = (key: keyof Incident) => filteredIncidents.reduce((acc, incident) => {
        const value = incident[key] as string;
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const formatForChart = (data: Record<string, number>) => Object.entries(data).map(([name, value], index) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, fill: `hsl(var(--chart-${(index % 5) + 1}))` }));

    return {
        incidentsByType: formatForChart(countBy('type')),
        incidentsByZone: formatForChart(countBy('zone_id')),
        incidentsBySeverity: formatForChart(countBy('severity')),
        incidentsByStatus: formatForChart(countBy('status')),
    }
  }, [filteredIncidents]);
  
  const checkAndPublish = useCallback(async (videoId: string, feed: VideoFeed, timestamp: Date) => {
    const tracker = uploadTrackerRef.current.get(videoId);
    if (!tracker) return;
    
    if (tracker.video_uri && tracker.image_uri) {
      try {
        if (feed.location_lat && feed.location_long) {
          await publishToRawVideoStream({
            video_id: videoId,
            camera_id: feed.camera_id,
            zone_id: feed.zone_id,
            location_lat: parseFloat(feed.location_lat),
            location_long: parseFloat(feed.location_long),
            timestamp: timestamp.toISOString(),
            image_uri: tracker.image_uri,
            video_uri: tracker.video_uri,
          });
        }
      } catch (e) {
        console.error(`Failed to publish for videoId: ${videoId}`, e);
      } finally {
        uploadTrackerRef.current.delete(videoId);
      }
    }
  }, []);

  const captureAndUploadFrame = useCallback(async (index: number, videoId: string, timestamp: Date) => {
    const video = videoRefs.current[index];
    const canvas = canvasRefs.current[index];
    const feed = localFeeds[index];

    if (!video || !canvas || !feed) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const fileName = `frame-${timestamp.toISOString().replace(/[:.]/g, '-')}.jpg`;

      const result = await uploadImageFrameToGcs({ imageDataUrl, fileName, zoneName: feed.zone_id });
      if (result.success && result.gcsUri) {
        const tracker = uploadTrackerRef.current.get(videoId) || {};
        tracker.image_uri = result.gcsUri;
        uploadTrackerRef.current.set(videoId, tracker);
        checkAndPublish(videoId, feed, timestamp);
      }
    }
  }, [localFeeds, checkAndPublish]);
  
   const startProcessingForFeed = useCallback((index: number) => {
    const videoElement = videoRefs.current[index];
    const feed = localFeeds[index];
    if (!videoElement || !feed) return;

    const stream = (videoElement as any).captureStream();
    if (!stream) return;

    const startNewChunk = () => {
      try {
        const mimeType = 'video/webm;codecs=vp9,opus';
        const videoId = crypto.randomUUID();
        uploadTrackerRef.current.set(videoId, {});

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRefs.current[index] = recorder;

        const frameTimestamp = new Date();
        captureAndUploadFrame(index, videoId, frameTimestamp);
        
        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data.size > 0) {
            const videoBlob = new Blob([event.data], { type: mimeType });
            const timestamp = new Date();
            const fileName = `patrol-video-${timestamp.toISOString().replace(/[:.]/g, '-')}.webm`;
            const reader = new FileReader();
            reader.readAsDataURL(videoBlob);
            reader.onloadend = () => {
              uploadVideoChunkToGcs({
                videoDataUrl: reader.result as string,
                fileName: fileName,
                zoneName: feed.zone_id,
              }).then(result => {
                if (result.success && result.gcsUri) {
                  const tracker = uploadTrackerRef.current.get(videoId) || {};
                  tracker.video_uri = result.gcsUri;
                  uploadTrackerRef.current.set(videoId, tracker);
                  checkAndPublish(videoId, feed, timestamp);
                }
              });
            };
          }
        };

        recorder.start();
        setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, 10000);
      } catch (e) {
        console.error(`Error starting recorder for ${feed.zone_id}:`, e);
      }
    };

    startNewChunk();
    const interval = setInterval(() => { if (isStreaming) startNewChunk() }, 10000);
    processingIntervals.current[index] = interval;
  }, [isStreaming, localFeeds, captureAndUploadFrame, checkAndPublish]);

  const stopProcessing = useCallback(() => {
    setIsStreaming(false);
    processingIntervals.current.forEach(clearInterval);
    mediaRecorderRefs.current.forEach(recorder => {
      if (recorder?.state === 'recording') recorder.stop();
    });
    processingIntervals.current = [];
    uploadTrackerRef.current.clear();
    const localVideoCount = videoFeeds.filter(f => f.source === 'local').length;
    mediaRecorderRefs.current = new Array(localVideoCount).fill(null);
    toast({ title: "Streaming and Archiving Stopped" });
  }, [videoFeeds, toast]);

  const handleStreamingToggle = () => {
    const nextIsStreaming = !isStreaming;
    
    videoRefs.current.forEach(video => {
        if (video) {
            if (nextIsStreaming) video.play().catch(e => console.error("Video play failed:", e));
            else {
                video.pause();
                video.currentTime = 0;
            }
        }
    });

    if (nextIsStreaming) {
        setIsStreaming(true);
        localFeeds.forEach((_, index) => startProcessingForFeed(index));
        toast({ title: "Streaming and Archiving Started", description: "Capturing 10-sec video chunks and frames for local feeds." });
    } else {
        stopProcessing();
    }
  };

  useEffect(() => {
    return () => stopProcessing();
  }, [stopProcessing]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Loading Dashboard Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Dashboard</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      {localFeeds.map((feed, index) => (
          <canvas 
              key={feed.camera_id} 
              ref={(el) => { canvasRefs.current[index] = el; }} 
              className="hidden" 
          />
      ))}

        <div>
            <Card>
              <CardHeader>
                <CardTitle className="font-headline text-xl flex items-center gap-2">
                  <Filter />
                  Filters
                </CardTitle>
                <CardDescription>
                  Refine the incidents and video feeds shown across the dashboard.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="severity-filter">Severity</Label>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger id="severity-filter">
                      <SelectValue placeholder="Filter by severity..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severities</SelectItem>
                      {uniqueSeverities.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="zone-filter">Zone</Label>
                  <Select value={zoneFilter} onValueChange={setZoneFilter}>
                    <SelectTrigger id="zone-filter">
                      <SelectValue placeholder="Filter by zone..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Zones</SelectItem>
                      {uniqueZones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="status-filter">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="status-filter">
                      <SelectValue placeholder="Filter by status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                       {uniqueStatuses.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
        </div>

        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-headline text-2xl font-bold">Live Video Feeds</h3>
                 <Button onClick={handleStreamingToggle} size="lg" disabled={isVideoLoading || videoFeeds.length === 0} variant={isStreaming ? "destructive" : "default"}>
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
            </div>

            {isVideoLoading && <p>Loading video feeds...</p>}
            {videoError && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Video Error</AlertTitle><AlertDescription>{videoError}</AlertDescription></Alert>}

            {!isVideoLoading && !videoError && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredVideos.length > 0 ? filteredVideos.map((feed) => {
                  if (feed.source === 'gcs') {
                    return <ZoneGcsVideoPlayer key={feed.camera_id} zoneName={feed.zone_id} isStreaming={isStreaming} />
                  }

                  const localIndex = localFeeds.findIndex(f => f.camera_id === feed.camera_id);
                  return (
                    <Card key={feed.camera_id} className="overflow-hidden relative group flex flex-col">
                        <CardContent className="p-0">
                            <div className="aspect-video w-full bg-muted">
                                <video
                                    ref={(el) => { if(localIndex !== -1) videoRefs.current[localIndex] = el; }}
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
                }) : (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                        <Video className="mx-auto h-12 w-12" />
                        <p className="mt-4">No video feeds available for the selected zone.</p>
                    </div>
                )}
              </div>
            )}
        </div>


        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
             <IncidentTypePieChart data={incidentsByType} />
             <IncidentSeverityPieChart data={incidentsBySeverity} />
             <IncidentZoneBarChart data={incidentsByZone} />
             <IncidentStatusBarChart data={incidentsByStatus} />
        </div>

        <div>
            <IncidentsTable 
                incidents={filteredIncidents} 
                isRefreshing={isRefreshing}
                lastRefreshed={lastRefreshed}
                onRefresh={() => fetchData(true)}
            />
        </div>

    </div>
  );
}
