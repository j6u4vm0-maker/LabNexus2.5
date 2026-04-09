import type { Metadata } from 'next';
import './globals.css';
import { AppLayout } from '@/components/layout/app-layout';
import { Toaster } from '@/components/ui/toaster';
import { ColorThemeManager } from '@/components/common/ColorThemeManager';
import { PLMSyncConsoleReporter } from '@/components/common/PLMSyncConsoleReporter';

export const metadata: Metadata = {
  title: 'LabNexus',
  description: 'Lab Operations Management Platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
          <ColorThemeManager />
          <AppLayout>{children}</AppLayout>
          <Toaster />
          <PLMSyncConsoleReporter />
      </body>
    </html>
  );
}
