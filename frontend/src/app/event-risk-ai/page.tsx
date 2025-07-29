"use client";

import React, { useState, useTransition } from "react";
import Image from "next/image";
import { EventPlanningForm, FormValues } from "@/components/event-planning-form";
import { RiskReport } from "@/components/risk-report";
import { runEventSimulation } from "@/app/actions";
import type { GetEventRiskProfileOutput } from "@/ai/flows/get-event-risk-profile";
import type { FetchYoutubeCrazeScoreOutput } from "@/ai/flows/youtube-craze-analyzer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

type SimulationResult = GetEventRiskProfileOutput & {
  crazeScore: number;
  videos: FetchYoutubeCrazeScoreOutput['videos'];
  location: string;
};

export default function EventRiskAiPage() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SimulationResult | null>(null);
  const { toast } = useToast();

  const handleFormSubmit = (data: FormValues) => {
    startTransition(async () => {
      setResult(null);
      const simulationResult = await runEventSimulation(data);

      if (simulationResult && "error" in simulationResult) {
        toast({
          variant: "destructive",
          title: "An error occurred",
          description: simulationResult.error,
        });
      } else if (simulationResult) {
        setResult({
            ...simulationResult,
            location: data.location
        } as SimulationResult);
      }
    });
  };

  return (
    <div className="mx-auto max-w-7xl">
        <header className="mb-8 text-center">
          <h1 className="font-headline text-4xl font-bold tracking-tight text-primary sm:text-5xl lg:text-6xl">
            Event Risk AI
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Simulate crowd dynamics, estimate risk, and prepare resources before your event happens.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
          <div className="w-full">
            <EventPlanningForm onSubmit={handleFormSubmit} isPending={isPending} />
          </div>
          <div className="w-full space-y-8">
            {isPending ? (
              <LoadingState />
            ) : result ? (
              <RiskReport result={result} />
            ) : (
              <InitialState />
            )}
          </div>
        </div>
      </div>
  );
}

const LoadingState = () => (
  <>
    <Card>
      <CardHeader>
        <Skeleton className="h-7 w-2/5" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="h-5 w-4/6" />
        <Skeleton className="h-5 w-2/5" />
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-1/3" />
      </CardHeader>
      <CardContent className="space-y-4">
         <div className="flex space-x-4">
          <Skeleton className="h-16 w-16" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
        <div className="flex space-x-4">
          <Skeleton className="h-16 w-16" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </CardContent>
    </Card>
  </>
);

const InitialState = () => (
  <Card className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
    <CardHeader>
      <CardTitle className="font-headline text-2xl">Awaiting Simulation</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-muted-foreground">
        Fill out the form to start the risk analysis.
      </p>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mx-auto mt-6 h-24 w-24 text-primary/20"
      >
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" />
        <path d="M22 12h-4" />
        <path d="M6 12H2" />
        <path d="M12 6V2" />
        <path d="M12 22v-4" />
      </svg>
    </CardContent>
  </Card>
);
