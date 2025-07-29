
"use client";

import { useState, useEffect, useRef } from 'react';

interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface GeolocationState {
  isLoading: boolean;
  coordinates: Coordinates | null;
  error: string | null;
}

export const useGeolocation = (enabled: boolean = true): GeolocationState => {
  const [state, setState] = useState<GeolocationState>({
    isLoading: enabled,
    coordinates: null,
    error: null,
  });
  const watcherId = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (watcherId.current !== null) {
        navigator.geolocation.clearWatch(watcherId.current);
        watcherId.current = null;
      }
      setState({ isLoading: false, coordinates: null, error: null });
      return;
    }

    if (!navigator.geolocation) {
      setState({
        isLoading: false,
        coordinates: null,
        error: "Geolocation is not supported by your browser.",
      });
      return;
    }

    const onEvent = ({ coords }: GeolocationPosition) => {
      setState({
        isLoading: false,
        coordinates: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        },
        error: null,
      });
    };

    const onEventError = (error: GeolocationPositionError) => {
      // Only show an error if we're not already showing coordinates
      // This prevents the timeout error from getCurrentPosition from flashing
      // if watchPosition is about to succeed.
      setState(s => {
        if (s.coordinates) {
          return s; // If we already have a location, don't show a subsequent error
        }
        return {
          ...s,
          isLoading: false,
          error: error.message || "Could not retrieve location.",
        };
      });
    };
    
    // Set loading state true when we start
    setState({ isLoading: true, coordinates: null, error: null });

    // We only need watchPosition, as it will also trigger the permission prompt
    // and provide continuous updates.
    watcherId.current = navigator.geolocation.watchPosition(onEvent, onEventError, {
        enableHighAccuracy: true,
        timeout: 15000, // Increase timeout slightly for better results
        maximumAge: 0,
    });

    return () => {
      if (watcherId.current !== null) {
        navigator.geolocation.clearWatch(watcherId.current);
      }
    };
  }, [enabled]);

  return state;
};
