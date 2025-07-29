
import { ControlCentreRole } from "@/components/control-centre-role";

export default function ControlCentrePage() {
  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline text-4xl font-bold tracking-tight text-primary sm:text-5xl lg:text-6xl">
          Control Centre
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Monitor live video feeds from active zones.
        </p>
      </header>
      <ControlCentreRole />
    </div>
  );
}
