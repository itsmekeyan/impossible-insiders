
"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, User, MapPin, AlertTriangle, ShieldCheck, Loader2, Bot, CornerDownLeft, MessageCircleQuestion, Image as ImageIcon, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { useGeolocation } from "@/hooks/use-geolocation";
import { reverseGeocode, getIncidents } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Incident } from "@/lib/firebase-admin";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useInterval } from "@/hooks/use-interval";


interface Commander {
  id: string;
  name: string;
  zone: string;
}

const commanders: Commander[] = [
  { id: "cmd-1", name: "Ravi Kumar", zone: "Zone A" },
  { id: "cmd-2", name: "Sunita Sharma", zone: "Zone B" },
  { id: "cmd-3", name: "Anil Gupta", zone: "Zone C" },
  { id: "cmd-4", name: "Priya Singh", zone: "Zone D" },
];

const cannedQueriesByZone: Record<string, string[]> = {
    "Zone A": [
        "What's the current crowd density in Zone A?",
        "Are there any active alerts for Zone A?",
        "Summarize the operational status of all units in Zone A.",
    ],
    "Zone B": [
        "Report on any medical emergencies in Zone B.",
        "What's the traffic flow like around the main stage?",
        "Check the status of security checkpoints in Zone B.",
    ],
    "Zone C": [
        "Are there any infrastructure issues in Zone C?",
        "Give me the latest update from patrol teams in Zone C.",
        "What is the overall sentiment in this zone?",
    ],
    "Zone D": [
        "Summarize fire safety status for Zone D.",
        "Any reports of unauthorized access in this zone?",
        "What are the pending tasks for the Zone D commander?",
    ],
};

const severityVariantMap: { [key: string]: "default" | "secondary" | "destructive" } = {
  low: "default",
  medium: "secondary",
  high: "destructive",
};


export function CommanderRole() {
  const [selectedCommanderId, setSelectedCommanderId] = useState<string | undefined>();
  const [address, setAddress] = useState<string | null>(null);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [allIncidents, setAllIncidents] = useState<Incident[]>([]);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [errorIncidents, setErrorIncidents] = useState<string | null>(null);
  const [showNotificationFlash, setShowNotificationFlash] = useState(false);


  const { toast } = useToast();

  const { coordinates, error: locationError, isLoading: isLocationLoading } = useGeolocation(!!selectedCommanderId);
  
  const selectedCommander = useMemo(() => 
    commanders.find(c => c.id === selectedCommanderId)
  , [selectedCommanderId]);

  const notifications = useMemo(() => {
    if (!selectedCommander) return [];
    return allIncidents.filter(incident => incident.zone_id === selectedCommander.zone)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [allIncidents, selectedCommander]);

  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);

    try {
        const result = await getIncidents();
        if (result.error) {
            setErrorIncidents(result.error);
        } else if (result.incidents) {
            setAllIncidents(prevIncidents => {
                const newIncident = result.incidents?.find(inc => 
                    !prevIncidents.some(pInc => pInc.id === inc.id) &&
                    inc.zone_id === selectedCommander?.zone &&
                    inc.severity === 'high'
                );

                if (newIncident) {
                    setShowNotificationFlash(true);
                    if ('vibrate' in navigator) {
                        navigator.vibrate([200, 100, 200]);
                    }
                    setTimeout(() => setShowNotificationFlash(false), 1000); // Flash for 1 second
                }
                return result.incidents ?? [];
            });
            setLastRefreshed(new Date());
        }
    } catch (err) {
        setErrorIncidents(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
        setIsLoadingIncidents(false);
        if (isManualRefresh) setIsRefreshing(false);
    }
  }, [selectedCommander?.zone]);

  useInterval(() => fetchData(), 5000); // Auto-refresh every 5 seconds

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const handleCommanderChange = (id: string) => {
    setSelectedCommanderId(id);
    setSummary(null); // Clear summary when commander changes
    setQuery(""); // Clear query
  }

  useEffect(() => {
    if (selectedCommander) {
        toast({
            title: "Commander Selected",
            description: `${selectedCommander.name} for ${selectedCommander.zone} is now active.`,
        });
    }
  }, [selectedCommander, toast]);

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

  const handleGenerateSummary = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) return;

    setIsGeneratingSummary(true);
    setSummary(null);

    // Simulate AI response
    setTimeout(() => {
        setSummary(`Summary for ${selectedCommander?.name} in ${selectedCommander?.zone}: ${query}`);
        setIsGeneratingSummary(false);
    }, 2000);
  }

  const currentCannedQueries = selectedCommander ? cannedQueriesByZone[selectedCommander.zone] || [] : [];

  return (
    <div className="relative">
       {showNotificationFlash && (
        <div className="fixed inset-0 z-50 bg-destructive/30 animate-ping pointer-events-none"></div>
       )}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="space-y-8">
            <Card>
                <CardHeader>
                <CardTitle className="font-headline text-2xl">Commander Control</CardTitle>
                <CardDescription>Select a commander to view their operational zone and notifications.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
                    <div className="flex-grow">
                    <label htmlFor="commander-select" className="text-sm font-medium">Select Commander</label>
                    <Select value={selectedCommanderId} onValueChange={handleCommanderChange}>
                        <SelectTrigger id="commander-select" className="mt-1">
                        <SelectValue placeholder="Select a commander..." />
                        </SelectTrigger>
                        <SelectContent>
                        {commanders.map(commander => (
                            <SelectItem key={commander.id} value={commander.id}>
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                <span>{commander.name} ({commander.zone})</span>
                            </div>
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    </div>
                </CardContent>
            </Card>
            {selectedCommander && (
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl flex items-center">
                            <MapPin className="mr-2" /> Location Status
                        </CardTitle>
                        <CardDescription>Your current GPS coordinates and address.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLocationLoading && (
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
                        {!coordinates && !isLocationLoading && !locationError && (
                            <p className="text-sm text-muted-foreground">Waiting for location...</p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>

        <div className="space-y-8">
            {selectedCommander ? (
                <>
                    <Card className="min-h-[400px]">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="font-headline text-2xl flex items-center gap-2">
                                        <Bell />
                                        Notifications
                                    </CardTitle>
                                    <CardDescription>
                                        Live alerts for {selectedCommander.name} in {selectedCommander.zone}
                                    </CardDescription>
                                </div>
                                <div className="flex flex-col items-end flex-shrink-0">
                                    <Button onClick={() => fetchData(true)} disabled={isRefreshing} size="sm" variant="outline">
                                        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                                        {isRefreshing ? "Refreshing..." : "Refresh"}
                                    </Button>
                                    {lastRefreshed && (
                                        <p className="text-xs text-muted-foreground mt-2">
                                            Last refreshed: {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoadingIncidents ? (
                                <div className="space-y-4">
                                    <NotificationItemSkeleton />
                                    <NotificationItemSkeleton />
                                    <NotificationItemSkeleton />
                                </div>
                            ) : errorIncidents ? (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Failed to Load Incidents</AlertTitle>
                                    <AlertDescription>{errorIncidents}</AlertDescription>
                                </Alert>
                            ) : (
                                <div className="space-y-4">
                                    {notifications.length > 0 ? (
                                        notifications.map(notification => (
                                            <NotificationItem key={notification.id} notification={notification} />
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                                        <ShieldCheck className="h-12 w-12 mb-4" />
                                        <p className="font-semibold">All Clear</p>
                                        <p className="text-sm">No incidents reported for this zone.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <form onSubmit={handleGenerateSummary}>
                            <CardHeader>
                                <CardTitle className="font-headline text-2xl flex items-center gap-2">
                                    <Bot /> Situation Summary
                                </CardTitle>
                                <CardDescription>
                                    Generate an AI-powered summary of the current situation.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="relative">
                                    <Textarea
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="e.g., Summarize recent alerts and any outstanding issues."
                                        className="pr-16"
                                        rows={3}
                                    />
                                    <Button type="submit" size="icon" className="absolute top-1/2 right-3 -translate-y-1/2" disabled={isGeneratingSummary || !query.trim()}>
                                        <CornerDownLeft className="h-4 w-4" />
                                        <span className="sr-only">Generate Summary</span>
                                    </Button>
                                </div>
                                
                                {currentCannedQueries.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2"><MessageCircleQuestion/> Suggestions</p>
                                        <div className="flex flex-wrap gap-2">
                                            {currentCannedQueries.map((q) => (
                                                <Button key={q} variant="outline" size="sm" type="button" onClick={() => setQuery(q)} className="text-xs h-auto py-1.5">
                                                    {q}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {isGeneratingSummary ? (
                                    <div className="flex items-center justify-center h-24">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    </div>
                                ) : summary ? (
                                    <div className="text-sm prose prose-sm dark:prose-invert max-w-full rounded-lg border bg-muted/30 p-4">
                                        <p>{summary}</p>
                                    </div>
                                ) : (
                                    <div className="text-sm text-center text-muted-foreground h-24 flex items-center justify-center border-2 border-dashed rounded-lg">
                                        <p>The AI-generated summary will appear here.</p>
                                    </div>
                                )}
                            </CardContent>
                        </form>
                    </Card>
                </>
            ) : (
                <Card className="min-h-[400px] flex items-center justify-center col-span-1">
                    <div className="text-center text-muted-foreground">
                        <User className="mx-auto h-12 w-12 mb-4" />
                        <p className="font-semibold">No Commander Selected</p>
                        <p className="text-sm">Please select a commander to view their details.</p>
                    </div>
                </Card>
            )}
        </div>
       </div>
    </div>
  );
}


interface NotificationItemProps {
    notification: Incident;
}

function NotificationItem({ notification }: NotificationItemProps) {
    const isAlert = notification.severity === 'high';
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${notification.location_lat},${notification.location_long}`;

    return (
        <div className={`flex items-start gap-4 p-4 rounded-lg border ${isAlert ? 'border-destructive/50 bg-destructive/5' : 'bg-muted/50'}`}>
            {notification.image_uri ? (
                <Image src={notification.image_uri} alt="Incident" width={80} height={45} className="rounded-md object-cover" />
            ) : (
                 <div className="flex items-center justify-center w-[80px] h-[45px] bg-muted rounded-md flex-shrink-0">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
            )}
            <div className="flex-grow">
                 <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold capitalize">{notification.type}</p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}</p>
                </div>

                <p className="text-sm text-muted-foreground my-1">{notification.details.explanation}</p>
                
                <div className="flex items-center gap-4 mt-2">
                     <Badge variant={severityVariantMap[notification.severity] || "default"} className="capitalize">
                        {notification.severity}
                    </Badge>
                     <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                        <MapPin className="h-3 w-3" />
                        <span>View Location</span>
                    </a>
                </div>
            </div>
        </div>
    )
}

function NotificationItemSkeleton() {
    return (
        <div className="flex items-start gap-4 p-4 rounded-lg border">
            <Skeleton className="h-[45px] w-[80px] rounded-md flex-shrink-0" />
            <div className="flex-grow space-y-2">
                <div className="flex justify-between">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/3" />
                </div>
                 <Skeleton className="h-4 w-full" />
                 <Skeleton className="h-4 w-5/6" />
                <div className="flex gap-4">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-24" />
                </div>
            </div>
        </div>
    );
}
