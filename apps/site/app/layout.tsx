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
    <html lang="en" className="dark">
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
          window.tailwind.config = {
            darkMode: "class",
            theme: {
              extend: {
                colors: {
                  primary: "#135bec",
                  "background-light": "#f6f6f8",
                  "background-dark": "#101622"
                },
                fontFamily: {
                  display: ["Manrope", "sans-serif"]
                },
                borderRadius: {
                  DEFAULT: "0.25rem",
                  lg: "0.5rem",
                  xl: "0.75rem",
                  full: "9999px"
                }
              }
            }
          };
        `}</Script>
        <Script src="https://cdn.tailwindcss.com?plugins=forms,container-queries" strategy="beforeInteractive" />
      </head>
      <body className="lmnas-app-root">
        <ExitRuntimeBridge />
        {children}
      </body>
    </html>
  );
}
