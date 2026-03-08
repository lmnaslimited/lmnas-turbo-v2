import type { Metadata, Viewport } from "next";
import React from "react";
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
      <body className="lmnas-app-root">
        <ExitRuntimeBridge />
        {children}
      </body>
    </html>
  );
}
