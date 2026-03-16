import type { Metadata, Viewport } from "next";
import React from "react";
import Script from "next/script";
import "./globals.css";
import { ExitRuntimeBridge } from "./ExitRuntimeBridge.client";

export const metadata: Metadata = {
  title: "LMNAs Website Operating System",
  description: "Governed shell + block + exit website platform"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@200;300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        <Script id="lmnas-tailwind-runtime-config" strategy="beforeInteractive">{`
          window.tailwind = window.tailwind || {};
          // Tailwind v4 runtime config is handled via CSS variables and the @theme block in globals.css.
          // No need for window.tailwind.config if the CDN is removed.
        `}</Script>
      </head>
      <body className="lmnas-app-root h-screen overflow-hidden bg-slate-950 text-slate-200">
        <div className="dark h-full w-full flex flex-col">
          <ExitRuntimeBridge />
          {children}
        </div>
      </body>
    </html>
  );
}
