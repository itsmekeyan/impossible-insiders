
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Bell, MapPin, Stethoscope } from "lucide-react";

const notifications = [
    { id: "m-1", type: "alert", title: "Heatstroke reported in Zone A, near stage.", timestamp: "3 mins ago" },
    { id: "m-2", type: "alert", title: "Request for ambulance at Gate 3 for a fall injury.", timestamp: "5 mins ago" },
    { id: "m-3", type: "info", title: "First aid kits restocked in Zone C.", timestamp: "20 mins ago" },
];

export default function MedicalCampPage() {
  const latitude = 13.061268;
  const longitude = 77.476130;

  const mapSrc = `https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${latitude},${longitude}&zoom=18&maptype=satellite`;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header>
        <h1 className="font-headline text-4xl font-bold tracking-tight text-primary sm:text-5xl lg:text-6xl">
          Medical Camp Location
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Designated location for the medical response team headquarters.
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
                <Stethoscope />
                Medical Alerts
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
