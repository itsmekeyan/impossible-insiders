
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { LocationInput, LocationData } from "@/components/location-input";
import { TagInput } from "@/components/tag-input";

const viewportSchema = z.object({
  south: z.number(),
  west: z.number(),
  north: z.number(),
  east: z.number(),
});

const formSchema = z.object({
  eventDate: z.date({ required_error: "Event date is required." }),
  location: z.string().min(3, "Location must be at least 3 characters."),
  attendees: z.coerce.number().int().positive("Attendees must be a positive number."),
  eventType: z.string({ required_error: "Please select an event type." }),
  otherEventType: z.string().optional(),
  keyword: z.string().min(2, "Tags must be at least 2 characters."),
  viewport: viewportSchema.optional(),
}).refine(data => {
    if (data.eventType === 'Other') {
        return !!data.otherEventType && data.otherEventType.length > 0;
    }
    return true;
}, {
    message: "Please specify the event type.",
    path: ["otherEventType"],
});


export type FormValues = z.infer<typeof formSchema>;

interface EventPlanningFormProps {
  onSubmit: (data: FormValues) => void;
  isPending: boolean;
}

export function EventPlanningForm({ onSubmit, isPending }: EventPlanningFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      location: "",
      attendees: 1000,
      keyword: "",
      eventType: "",
      otherEventType: "",
    },
  });

  const eventType = form.watch("eventType");

  const handleFormSubmit = (data: FormValues) => {
    const submissionData = { ...data };
    if (data.eventType === 'Other') {
      submissionData.eventType = data.otherEventType || 'Other';
    }
    onSubmit(submissionData);
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Event Planning</CardTitle>
        <CardDescription>Enter the details of your event to start the simulation.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <LocationInput
                        onLocationSelect={(data: LocationData) => {
                          field.onChange(data.name);
                          form.setValue('viewport', data.viewport);
                        }}
                        value={field.value}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="eventDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Date</FormLabel>
                    <FormControl>
                      <DatePicker 
                        value={field.value} 
                        onChange={field.onChange}
                        disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="attendees"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected Attendees</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 50000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an event type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Concert">Concert</SelectItem>
                      <SelectItem value="Protest">Protest</SelectItem>
                      <SelectItem value="Religious">Religious Gathering</SelectItem>
                      <SelectItem value="Sports">Sporting Event</SelectItem>
                      <SelectItem value="Festival">Festival</SelectItem>
                      <SelectItem value="Conference">Conference</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {eventType === 'Other' && (
                <FormField
                control={form.control}
                name="otherEventType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Please Specify Event Type</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Charity Gala" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="keyword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Information tags about the event</FormLabel>
                  <FormControl>
                    <TagInput 
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Enter a tag and press Enter..."
                    />
                  </FormControl>
                   <FormDescription>
                    Provide tags like event name, main performers, or topics.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Simulating...
                </>
              ) : (
                "Run Simulation"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
