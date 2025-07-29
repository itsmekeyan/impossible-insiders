
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RolesPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to a default profile or the first one in the list
    router.replace('/profiles/camera');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
        <p>Redirecting to Profiles...</p>
    </div>
  );
}
