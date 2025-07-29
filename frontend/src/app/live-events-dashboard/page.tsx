
import { IncidentsDashboard } from "@/components/incidents-dashboard";

export default function LiveEventsDashboardPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 text-center">
        <h1 className="font-headline text-4xl font-bold tracking-tight text-primary sm:text-5xl lg:text-6xl">
          Live Events Dashboard
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Real-time incident monitoring and analysis from aggregated sources.
        </p>
      </header>
      <IncidentsDashboard />
    </div>
  );
}
