
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video } from "lucide-react";
import type { VideoFile } from "@/app/actions";

interface ZoneVideoPlaylistProps {
    zoneName: string;
    videos: VideoFile[];
}

export function ZoneVideoPlaylist({ zoneName, videos }: ZoneVideoPlaylistProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentSrc, setCurrentSrc] = useState("");

    useEffect(() => {
        if (videos && videos.length > 0) {
            // Check if the current video source is still in the updated list
            const currentVideoStillExists = videos.some(v => v.url === currentSrc);
            
            // If the current video is gone (e.g., signed URL expired) or not set,
            // reset to the first video of the new list.
            if (!currentVideoStillExists) {
                setCurrentIndex(0);
                setCurrentSrc(videos[0].url);
            } else {
                // Otherwise, update the src of the currently playing index,
                // in case the URL expired and was refreshed.
                setCurrentSrc(videos[currentIndex]?.url || videos[0].url);
            }
        }
    }, [videos, currentIndex, currentSrc]);

    const handleVideoEnded = useCallback(() => {
        setCurrentIndex(prevIndex => (prevIndex + 1) % videos.length);
    }, [videos.length]);

    if (!videos || videos.length === 0) {
        return null;
    }
    
    const isLive = currentIndex === videos.length -1;

    return (
        <Card className="overflow-hidden relative group flex flex-col">
             <Badge className={`absolute top-2 left-2 z-10 ${isLive ? 'bg-green-600' : 'bg-secondary'}`}>
                {isLive ? (
                    <span className="relative flex h-2 w-2 mr-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                ) : null}
                {isLive ? 'LIVE' : 'Recorded'}
            </Badge>

            <CardContent className="p-0">
                <div className="aspect-video w-full bg-muted">
                    <video
                        key={currentSrc}
                        className="h-full w-full object-cover"
                        src={currentSrc}
                        autoPlay
                        muted
                        playsInline
                        onEnded={handleVideoEnded}
                    >
                        Your browser does not support the video tag.
                    </video>
                </div>
            </CardContent>
             <CardHeader className="p-4 flex-grow">
                <CardTitle className="font-headline text-lg flex items-center truncate">
                    <Video className="mr-2 h-5 w-5 flex-shrink-0" />
                    <span className="truncate" title={zoneName}>{zoneName}</span>
                </CardTitle>
                <CardDescription className="truncate" title={videos[currentIndex]?.name}>
                    Playing: {videos[currentIndex]?.name || 'N/A'} ({currentIndex + 1} of {videos.length})
                </CardDescription>
            </CardHeader>
        </Card>
    );
}

