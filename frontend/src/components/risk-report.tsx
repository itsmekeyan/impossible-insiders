
"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { GetEventRiskProfileOutput } from "@/ai/flows/get-event-risk-profile";
import type { FetchYoutubeCrazeScoreOutput } from "@/ai/flows/youtube-craze-analyzer";
import { ActionChecklist } from "@/components/action-checklist";
import {
  ShieldCheck,
  Flame,
  DoorOpen,
  Users,
  HeartPulse,
  RadioTower,
  BrickWall,
  Maximize,
  Youtube,
  RectangleHorizontal,
  ThumbsUp,
  MessageSquare,
  Eye,
  CalendarDays,
} from "lucide-react";

type SimulationResult = GetEventRiskProfileOutput & {
  crazeScore: number;
  videos: FetchYoutubeCrazeScoreOutput['videos'];
  location: string;
};

interface RiskReportProps {
  result: SimulationResult;
}

const riskColorMap: { [key: string]: "default" | "secondary" | "destructive" } = {
  Low: "default",
  Medium: "secondary",
  High: "destructive",
};

export function RiskReport({ result }: RiskReportProps) {
  const riskVariant = riskColorMap[result.predictedRiskScore] || "default";

  const mapSrc = `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(
    result.location
  )}`;

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Simulation Report</CardTitle>
          <CardDescription>AI-powered risk assessment and resource plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center justify-center space-y-4 rounded-lg border bg-card p-6 text-center shadow-sm">
            <h3 className="text-md font-semibold text-muted-foreground">Predicted Risk Score</h3>
            <Badge variant={riskVariant} className="px-6 py-2 text-2xl font-bold">
              <ShieldCheck className="mr-2 h-6 w-6" />
              {result.predictedRiskScore}
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoCard
              icon={<Flame className="h-6 w-6 text-accent" />}
              title="YouTube Craze Score"
              value={result.crazeScore.toFixed(2)}
              description="Public interest level (0-10)"
            />
            <InfoCard
              icon={<Maximize className="h-6 w-6 text-primary" />}
              title="Maximum Capacity"
              value={result.maximumCapacity.toLocaleString()}
              description="Est. people for the venue"
            />
             <InfoCard
              icon={<RectangleHorizontal className="h-6 w-6 text-primary" />}
              title="Area (sq ft)"
              value={result.areaSquareFeet.toLocaleString()}
              description="Est. area of the venue"
            />
            <InfoCard
              icon={<DoorOpen className="h-6 w-6 text-primary" />}
              title="Entry Points"
              value={result.recommendedEntryPoints}
            />
            <InfoCard
              icon={<Users className="h-6 w-6 text-primary" />}
              title="Security Personnel"
              value={result.suggestedSecurityPersonnel}
            />
            <InfoCard
              icon={<HeartPulse className="h-6 w-6 text-primary" />}
              title="Medical Personnel"
              value={result.suggestedMedicalPersonnel}
            />
            <InfoCard
              icon={<RadioTower className="h-6 w-6 text-primary" />}
              title="Drones"
              value={result.suggestedDrones}
            />
            <InfoCard
              icon={<BrickWall className="h-6 w-6 text-primary" />}
              title="Infrastructure"
              value={result.requiredInfrastructure}
            />
          </div>
        </CardContent>
      </Card>
      
      {result.actionChecklist && result.actionChecklist.length > 0 && (
        <Card>
           <CardHeader>
            <CardTitle className="font-headline text-xl">Action Checklist</CardTitle>
            <CardDescription>Recommended actions to ensure event safety.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionChecklist items={result.actionChecklist} />
          </CardContent>
        </Card>
      )}

      {result.videos && result.videos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-xl flex items-center">
              <Youtube className="mr-2 h-6 w-6 text-red-600" />
              Top YouTube Videos
            </CardTitle>
            <CardDescription>Videos analyzed for the craze score.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.videos.map((video) => (
              <Link key={video.id} href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-lg hover:bg-muted transition-colors border">
                <div className="flex items-start space-x-4">
                  <Image
                    src={video.thumbnailUrl}
                    alt={video.title}
                    width={120}
                    height={90}
                    className="rounded-md object-cover"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground line-clamp-2">{video.title}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                       <Stat icon={<CalendarDays />} value={format(new Date(video.publishedAt), "PP")} />
                       <Stat icon={<Eye />} value={video.viewCount.toLocaleString()} />
                       <Stat icon={<ThumbsUp />} value={video.likeCount.toLocaleString()} />
                       <Stat icon={<MessageSquare />} value={video.commentCount.toLocaleString()} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl">Event Location</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <iframe
              width="100%"
              height="400"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              src={mapSrc}>
            </iframe>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface InfoCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  description?: string;
}

const InfoCard = ({ icon, title, value, description }: InfoCardProps) => (
  <div className="flex items-start space-x-4 rounded-lg border bg-card p-4">
    <div className="flex-shrink-0">{icon}</div>
    <div className="flex-grow">
      <p className="font-semibold">{title}</p>
      <p className="text-2xl font-bold text-primary">{value}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  </div>
);


const Stat = ({ icon, value }: { icon: React.ReactNode; value: string | number }) => (
  <div className="flex items-center space-x-1">
    {React.cloneElement(icon as React.ReactElement, { className: "h-3.5 w-3.5" })}
    <span>{value}</span>
  </div>
);
