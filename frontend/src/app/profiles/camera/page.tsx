
import { CameraOperatorRole } from '@/components/camera-operator-role';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CameraProfilePage() {
  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-8">
        <h1 className="font-headline text-4xl font-bold tracking-tight text-primary sm:text-5xl lg:text-6xl">
          Camera Operator Profile
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Manage live video feeds and patrol recordings from your assigned zone.
        </p>
      </header>
      <CameraOperatorRole />
    </div>
  );
}
