
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldAlert, Video, Users, ChevronDown } from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navLinks = [
  { href: '/event-risk-ai', label: 'Event Risk AI', icon: ShieldAlert },
  { href: '/live-events-dashboard', label: 'Live Events', icon: Video },
];

const profileLinks = [
  { href: '/profiles/camera', label: 'Camera' },
  { href: '/profiles/control-centre', label: 'Control Centre' },
  { href: '/profiles/commander', label: 'Commander' },
  { href: '/profiles/medical-camp', label: 'Medical Camp' },
  { href: '/profiles/fire-camp', label: 'Fire Camp' },
]

export function Header() {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);


  return (
    <>
      {/* Desktop Header */}
      <header className="sticky top-0 z-50 hidden w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:block">
        <div className="container flex h-14 max-w-screen-2xl items-center">
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <ShieldAlert className="h-6 w-6 text-primary" />
              <span className="font-bold sm:inline-block">
                Project Dhrishti
              </span>
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'transition-colors hover:text-foreground/80',
                    isClient && pathname === link.href ? 'text-foreground' : 'text-foreground/60'
                  )}
                >
                  {link.label}
                </Link>
              ))}
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className={cn(
                    'gap-1 transition-colors hover:text-foreground/80',
                     isClient && pathname.startsWith('/profiles') ? 'text-foreground' : 'text-foreground/60'
                  )}>
                    Profiles
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Select a Profile</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                   {profileLinks.map((link) => (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link href={link.href}>{link.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Nav */}
      <footer className="fixed bottom-0 z-50 block w-full border-t bg-background/95 p-2 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
        <nav className="flex items-center justify-around text-xs">
          {navLinks.map((link) => (
            <Link
              key={`mobile-${link.href}`}
              href={link.href}
              className={cn(
                'flex flex-col items-center gap-1 p-2 transition-colors hover:text-primary',
                isClient && pathname === link.href ? 'text-primary' : 'text-foreground/60'
              )}
            >
              <link.icon className="h-5 w-5" />
              <span>{link.label}</span>
            </Link>
          ))}
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex flex-col items-center gap-1 p-2 transition-colors hover:text-primary',
                  isClient && pathname.startsWith('/profiles') ? 'text-primary' : 'text-foreground/60'
                )}
              >
                <Users className="h-5 w-5" />
                <span>Profiles</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end">
               <DropdownMenuLabel>Select a Profile</DropdownMenuLabel>
               <DropdownMenuSeparator />
               {profileLinks.map((link) => (
                <DropdownMenuItem key={`mobile-${link.href}`} asChild>
                  <Link href={link.href}>{link.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </footer>
    </>
  );
}
