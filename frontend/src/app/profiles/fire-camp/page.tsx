
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Bell, MapPin, Siren } from "lucide-react";

const notifications = [
    { id: "f-1", type: "alert", title: "Smoke detected near the main food court.", timestamp: "2 mins ago" },
    { id: "f-2", type: "info", title: "Fire extinguisher inspection completed for Zone B.", timestamp: "15 mins ago" },
    { id: "f-3", type: "alert", title: "Unauthorized bonfire reported in Sector D parking lot.", timestamp: "5 mins ago" },
];

export default function FireCampPage() {
  const latitude = 13.060686;
  const longitude = 77.474579;
  
  const mapSrc = `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${latitude},${longitude}&zoom=18&maptype=satellite`;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header>
        <h1 className="font-headline text-4xl font-bold tracking-tight text-primary sm:text-5xl lg:text-6xl">
          Fire Camp Location
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Designated location for the fire response team headquarters.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-xl flex items-center">
            <MapPin className="mr-2" />
            Live Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <iframe
              width="100%"
              height="450"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              src={mapSrc}>
            </iframe>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center gap-2">
                <Siren />
                Fire & Safety Alerts
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                {notifications.map(notification => {
                    const isAlert = notification.type === 'alert';
                    return (
                        <div key={notification.id} className={`flex items-start gap-4 p-4 rounded-lg border ${isAlert ? 'border-destructive/50 bg-destructive/5' : 'bg-muted/50'}`}>
                            <div className={`mt-1 ${isAlert ? 'text-destructive' : 'text-primary'}`}>
                                {isAlert ? <AlertTriangle className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                            </div>
                            <div className="flex-grow">
                                <p className={`font-semibold ${isAlert ? 'text-destructive' : 'text-foreground'}`}>{notification.title}</p>
                                <p className="text-sm text-muted-foreground">{notification.timestamp}</p>
                            </div>
                        </div>
                    )
                })}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
