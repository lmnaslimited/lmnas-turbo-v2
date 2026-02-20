import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "LMNAs Turbo v2",
  description: "Block-based platform scaffold"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: 24 }}>{children}</body>
    </html>
  );
}
