
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { getZoneVideoPlaylist } from "@/app/actions";
import type { VideoFile } from "@/app/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Video, AlertTriangle, Loader2 } from "lucide-react";

interface ZoneGcsVideoPlayerProps {
    zoneName: string;
    isStreaming: boolean;
}

export function ZoneGcsVideoPlayer({ zoneName, isStreaming }: ZoneGcsVideoPlayerProps) {
    const [playlist, setPlaylist] = useState<VideoFile[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const retryCountRef = useRef(0);

    const fetchPlaylist = useCallback(async () => {
        if (!isStreaming) return;
        try {
            const result = await getZoneVideoPlaylist(zoneName);
            if (result.error) {
                setError(result.error);
                setPlaylist([]);
            } else if (result.videos) {
                // The new playlist is sorted by name (timestamp) from the server
                const newPlaylist = result.videos;
                setPlaylist(prevPlaylist => {
                    // If the playlists are identical, do nothing.
                    if (JSON.stringify(prevPlaylist) === JSON.stringify(newPlaylist)) {
                        return prevPlaylist;
                    }
                    // Reset retry count when we get a new playlist
                    retryCountRef.current = 0;
                    return newPlaylist;
                });
                setError(null);
            }
        } catch(err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred while fetching playlist.");
        } finally {
            setIsLoading(false);
        }
    }, [zoneName, isStreaming]);

    useEffect(() => {
        if (isStreaming) {
            fetchPlaylist(); // Initial fetch
            const interval = setInterval(fetchPlaylist, 10000); // Poll every 10 seconds
            return () => clearInterval(interval);
        } else {
            setIsLoading(true); // Reset loading state when streaming stops
            setPlaylist([]);
        }
    }, [isStreaming, fetchPlaylist]);

    useEffect(() => {
        if (playlist.length > 0) {
            const currentVideoUrl = playlist[currentIndex]?.url;
            const latestVideoUrl = playlist[playlist.length - 1]?.url;

            // If a newer video is available than the one currently selected, switch to it.
            if (latestVideoUrl && latestVideoUrl !== currentVideoUrl) {
                setCurrentIndex(playlist.length - 1);
            }
        }
    }, [playlist, currentIndex]);

    const handleVideoEnded = useCallback(() => {
        if (playlist.length > 0) {
            // When a video ends, loop back to the start of the playlist.
            // The useEffect hook will then check if there's a newer video.
            setCurrentIndex((prevIndex) => (prevIndex + 1) % playlist.length);
        }
    }, [playlist.length]);

    const handleVideoError = useCallback(() => {
        console.error('Video playback error:', videoRef.current?.error);
        
        // If we get an error playing this video, try the next one
        // but limit retry attempts to avoid infinite loops
        if (retryCountRef.current < 3 && playlist.length > 1) {
            retryCountRef.current++;
            setCurrentIndex((prevIndex) => (prevIndex + 1) % playlist.length);
        }
    }, [playlist.length]);

    const currentVideo = playlist[currentIndex];

    // UI Rendering Logic
    if (!isStreaming) {
        return (
            <Card className="overflow-hidden relative group flex flex-col">
                 <Badge className="absolute top-2 left-2 z-10 bg-gray-500">OFFLINE</Badge>
                 <CardContent className="p-0">
                    <div className="aspect-video w-full bg-muted flex items-center justify-center">
                       <Video className="h-16 w-16 text-muted-foreground" />
                    </div>
                </CardContent>
                <CardHeader className="p-4 flex-grow">
                    <CardTitle className="font-headline text-lg flex items-center truncate">
                        <Video className="mr-2 h-5 w-5 flex-shrink-0" />
                        <span className="truncate" title={zoneName}>{zoneName}</span>
                    </CardTitle>
                </CardHeader>
            </Card>
        );
    }
    
    if (isLoading) {
        return (
             <Card className="overflow-hidden relative group flex flex-col">
                <CardContent className="p-0">
                    <Skeleton className="aspect-video w-full" />
                </CardContent>
                <CardHeader className="p-4 flex-grow">
                     <Skeleton className="h-5 w-3/4" />
                </CardHeader>
            </Card>
        );
    }

    if (error) {
         return (
             <Card className="overflow-hidden relative group flex flex-col items-center justify-center p-4">
                 <AlertTriangle className="h-8 w-8 text-destructive" />
                 <CardHeader>
                    <CardTitle className="text-destructive text-base">{zoneName} Error</CardTitle>
                 </CardHeader>
                 <CardContent>
                    <p className="text-xs text-muted-foreground text-center">{error}</p>
                 </CardContent>
            </Card>
        );
    }
    
    if (playlist.length === 0) {
        return (
            <Card className="overflow-hidden relative group flex flex-col">
                 <Badge className="absolute top-2 left-2 z-10 bg-green-600">
                    <span className="relative flex h-2 w-2 mr-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                    LIVE
                 </Badge>
                 <div className="aspect-video w-full bg-muted flex flex-col items-center justify-center text-center p-4">
                   <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                   <p className="mt-4 text-sm font-medium text-muted-foreground">Awaiting first video chunk...</p>
                </div>
                <CardHeader className="p-4 flex-grow">
                    <CardTitle className="font-headline text-lg flex items-center truncate">
                        <Video className="mr-2 h-5 w-5 flex-shrink-0" />
                        <span className="truncate" title={zoneName}>{zoneName}</span>
                    </CardTitle>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className="overflow-hidden relative group flex flex-col">
            <Badge className="absolute top-2 left-2 z-10 bg-green-600">
                <span className="relative flex h-2 w-2 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                LIVE
            </Badge>

            <CardContent className="p-0">
                <div className="aspect-video w-full bg-muted">
                    {currentVideo?.url && (
                         <video
                            ref={videoRef}
                            key={currentVideo.url}
                            className="h-full w-full object-cover"
                            src={currentVideo.url}
                            autoPlay
                            muted
                            playsInline
                            crossOrigin="anonymous"
                            onEnded={handleVideoEnded}
                            onError={handleVideoError}
                        >
                            Your browser does not support the video tag.
                        </video>
                    )}
                </div>
            </CardContent>
             <CardHeader className="p-4 flex-grow">
                <CardTitle className="font-headline text-lg flex items-center truncate">
                    <Video className="mr-2 h-5 w-5 flex-shrink-0" />
                    <span className="truncate" title={zoneName}>{zoneName}</span>
                </CardTitle>
                 <CardDescription className="truncate text-xs" title={currentVideo?.name}>
                    Playing: {currentVideo?.name || 'N/A'} ({currentIndex + 1} of {playlist.length})
                </CardDescription>
            </CardHeader>
        </Card>
    );
}

