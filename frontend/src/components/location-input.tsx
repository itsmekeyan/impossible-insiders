
"use client";

import React, { useRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

export interface LocationData {
  name: string;
  viewport?: {
    south: number;
    west: number;
    north: number;
    east: number;
  };
}

interface LocationInputProps {
  value: string;
  onLocationSelect: (data: LocationData) => void;
}

export function LocationInput({ value, onLocationSelect }: LocationInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (typeof window.google === "undefined" || !inputRef.current) {
      return;
    }

    if (!autocompleteRef.current) {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(
        inputRef.current,
        { fields: ["name", "formatted_address", "geometry.viewport"] }
      );

      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current.getPlace();
        if (place) {
          const locationName = (place.name && place.geometry) ? place.name : place.formatted_address;
          if (locationName) {
            const viewport = place.geometry?.viewport?.toJSON();
            onLocationSelect({ name: locationName, viewport });
          }
        }
      });
    }
  }, [onLocationSelect]);
  
  return (
    <Input
      ref={inputRef}
      placeholder="e.g., M. Chinnaswamy Stadium"
      value={inputValue}
      onChange={(e) => {
        setInputValue(e.target.value);
        // If user types manually, we don't have viewport data
        onLocationSelect({ name: e.target.value });
      }}
    />
  );
}
