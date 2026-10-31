import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { Toaster } from './Toaster';

export function AppShell({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-base-100 flex flex-col font-ui text-base-content antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-base-300 focus:font-bold focus:rounded-xl focus:shadow-lg"
      >
        Skip to main content
      </a>
      <Navbar />
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 focus:outline-none"
      >
        {children ?? <Outlet />}
      </main>
      <Toaster />
    </div>
  );
}

export default AppShell;
