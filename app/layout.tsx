import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Global Conflict Cost Tracker — Live Military Spending Estimates",
  description:
    "Real-time estimates of military spending across all major active conflicts worldwide. " +
    "Data-driven, source-cited, non-partisan. Covers Ukraine, Iran, Gaza, Sudan, Myanmar and more.",
  keywords: [
    "conflict cost tracker", "war spending", "military cost", "Iran war cost",
    "Ukraine war cost", "Gaza war cost", "global conflict", "Operation Epic Fury",
    "defense spending", "war tracker 2026",
  ],
  openGraph: {
    title: "Global Conflict Cost Tracker",
    description: "Live estimates of military spending across all major active conflicts.",
    type: "website",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ConflictCost",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@300;400;600;700;800&display=swap"
          rel="stylesheet"
        />
        <meta name="theme-color" content="#0c0f14" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js');
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
