
import { CommanderRole } from '@/components/commander-role';

export default function CommanderProfilePage() {
  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline text-4xl font-bold tracking-tight text-primary sm:text-5xl lg:text-6xl">
          Commander Profile
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Oversee operations and dispatch alerts to command centers.
        </p>
      </header>
      <CommanderRole />
    </div>
  );
}
