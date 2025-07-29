"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/event-risk-ai');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
        <p>Redirecting to Event Risk AI...</p>
    </div>
  );
}
