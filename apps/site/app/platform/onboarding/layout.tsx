import React from "react";
import { StudioSidebar } from "./_components/StudioSidebar";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen overflow-hidden bg-[#071226]">
            <StudioSidebar />
            <main className="flex-1 overflow-y-auto px-6 py-5">
                {children}
            </main>
        </div>
    );
}
