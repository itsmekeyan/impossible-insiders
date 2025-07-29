

"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Incident } from "@/lib/firebase-admin";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, Video, Image as ImageIcon, MapPin, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
} from "@tanstack/react-table";
import { Button } from "./ui/button";

const severityVariantMap: { [key: string]: "default" | "secondary" | "destructive" } = {
  low: "default",
  medium: "secondary",
  high: "destructive",
};

// Function to get a signed URL for GCS resources
async function getSignedUrl(gsUrl: string): Promise<string> {
  try {
    if (!gsUrl?.startsWith('gs://')) return '';
    
    // Extract bucket and object path from gs:// URL
    const [, bucket, ...objectPathParts] = gsUrl.split('/');
    const objectPath = objectPathParts.join('/');
    
    // Call server action to get a signed URL
    const response = await fetch(`/api/get-signed-url?bucket=${bucket}&object=${encodeURIComponent(objectPath)}`);
    
    if (!response.ok) throw new Error('Failed to get signed URL');
    
    const data = await response.json();
    return data.signedUrl;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    return '';
  }
}

function VideoPlayerDialog({ videoUrl, title }: { videoUrl: string; title: string }) {
    const [signedUrl, setSignedUrl] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    useEffect(() => {
        // Fall back to direct URL conversion for backwards compatibility
        if (videoUrl?.startsWith('gs://')) {
            setSignedUrl(videoUrl.replace('gs://', 'https://storage.googleapis.com/'));
        } else if (videoUrl) {
            setSignedUrl(videoUrl);
        }
        setIsLoading(false);
    }, [videoUrl]);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" disabled={!videoUrl}>
                    {videoUrl ? <PlayCircle className="h-6 w-6" /> : <Video className="h-6 w-6 text-muted-foreground" />}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="aspect-video w-full">
                    {isLoading ? (
                        <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted">
                            <p>Loading video...</p>
                        </div>
                    ) : signedUrl ? (
                         <video
                            className="h-full w-full rounded-lg"
                            src={signedUrl}
                            controls
                            autoPlay
                            muted
                            playsInline
                            crossOrigin="anonymous"
                        >
                            Your browser does not support the video tag.
                        </video>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted">
                            <p>{error || 'Video not available.'}</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface IncidentsTableProps {
    incidents: Incident[];
    isRefreshing: boolean;
    lastRefreshed: Date | null;
    onRefresh: () => void;
}


export function IncidentsTable({ incidents, isRefreshing, lastRefreshed, onRefresh }: IncidentsTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "timestamp", desc: true }]);

  const columns: ColumnDef<Incident>[] = useMemo(() => [
    {
      accessorKey: "timestamp",
      header: ({ column }) => (
        <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
            Timestamp
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.original.timestamp);
        return <div title={date.toLocaleString()}>{formatDistanceToNow(date, { addSuffix: true })}</div>;
      },
    },
    {
      accessorKey: "image_uri",
      header: "Image",
      cell: ({ row }) => {
        const { image_uri, type, zone_id } = row.original;
        // Use direct URL from image_uri, which should be a properly signed URL
        // from the backend, or fall back to gs:// -> https:// conversion
        const imageUrl = image_uri?.startsWith('gs://') 
          ? image_uri.replace('gs://', 'https://storage.googleapis.com/') 
          : image_uri;

        return imageUrl ? (
          <Dialog>
            <DialogTrigger>
              <div className="relative w-[100px] h-[56px] rounded-md overflow-hidden bg-muted">
                <img 
                  src={imageUrl} 
                  alt={`Incident: ${type} in ${zone_id}`}
                  className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                  crossOrigin="anonymous"
                />
              </div>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
                 <DialogHeader>
                    <DialogTitle>Incident: {type} in {zone_id}</DialogTitle>
                </DialogHeader>
                <img 
                  src={imageUrl} 
                  alt={`Incident: ${type} in ${zone_id}`} 
                  className="max-w-full max-h-[80vh] mx-auto rounded-lg" 
                  crossOrigin="anonymous"
                />
            </DialogContent>
          </Dialog>
        ) : (
          <div className="flex items-center justify-center w-[100px] h-[56px] bg-muted rounded-md">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        );
      }
    },
    {
      accessorKey: "video_uri",
      header: "Video",
      cell: ({ row }) => {
          const { video_uri, type, zone_id } = row.original;
          // VideoPlayerDialog component handles gs:// to https:// conversion internally
          return <VideoPlayerDialog videoUrl={video_uri} title={`Incident Video: ${type} in ${zone_id}`} />;
      }
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <span className="font-medium capitalize">{row.original.type}</span>,
    },
    {
      accessorKey: "severity",
      header: "Severity",
      cell: ({ row }) => {
        const severity = row.original.severity.toLowerCase();
        return (
          <Badge variant={severityVariantMap[severity] || "default"} className="capitalize">
            {severity}
          </Badge>
        );
      },
    },
    {
      accessorKey: "zone_id",
      header: "Zone",
    },
    {
        accessorKey: "location",
        header: "Location",
        cell: ({ row }) => {
            const { location_lat, location_long } = row.original;
            if (!location_lat || !location_long) return <span className="text-muted-foreground">N/A</span>;
            
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${location_lat},${location_long}`;

            return (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                    <MapPin className="h-4 w-4" />
                    <span>View Map</span>
                </a>
            );
        }
    },
    {
      accessorKey: "details.explanation",
      header: "Explanation",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.details.explanation}</span>
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <Badge variant={row.original.status === 'active' ? 'destructive' : 'default'} className="capitalize">{row.original.status}</Badge>,
    },
  ], []);

  const table = useReactTable({
    data: incidents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  return (
     <Card>
        <CardHeader className="flex flex-row items-start justify-between">
            <div>
                <CardTitle>Live Incidents Feed</CardTitle>
                <CardDescription>A live feed of all incidents detected across all zones, sorted by most recent.</CardDescription>
            </div>
            <div className="flex flex-col items-end flex-shrink-0">
                <Button onClick={onRefresh} disabled={isRefreshing} size="sm" variant="outline">
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {isRefreshing ? "Refreshing..." : "Refresh"}
                </Button>
                {lastRefreshed && (
                    <p className="text-xs text-muted-foreground mt-2">
                        Last refreshed: {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
                    </p>
                )}
            </div>
        </CardHeader>
        <CardContent>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                            <TableHead key={header.id}>
                            {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                )}
                            </TableHead>
                        ))}
                        </TableRow>
                    ))}
                    </TableHeader>
                    <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                        <TableRow
                            key={row.id}
                            data-state={row.getIsSelected() && "selected"}
                        >
                            {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                            ))}
                        </TableRow>
                        ))
                    ) : (
                        <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                            No incidents found.
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
     </Card>
  );
}
