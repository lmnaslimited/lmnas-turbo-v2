import React from "react";
import { StudioSidebar } from "./_components/StudioSidebar";
import { StudioShellFrame } from "./_components/StudioShellFrame.client";
import { StudioGuidedFlowBanner } from "./_components/StudioGuidedFlowBanner";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen overflow-hidden bg-[#0b1120]">
            <StudioSidebar />
            <main className="flex-1 overflow-y-auto px-6 py-5">
                <StudioShellFrame>
                    <StudioGuidedFlowBanner />
                    {children}
                </StudioShellFrame>
            </main>
        </div>
    );
}
