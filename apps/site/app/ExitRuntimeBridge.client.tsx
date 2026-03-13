"use client";

import { useEffect } from "react";
import { track } from "@lmnas/analytics";

function readExitId(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const element = target.closest("[data-exit-id]");
  if (!element) {
    return null;
  }

  return element.getAttribute("data-exit-id");
}

export function ExitRuntimeBridge() {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const exitId = readExitId(event.target);
      if (!exitId) {
        return;
      }

      track("exit_triggered", {
        exitId,
        adapter: "frontend.redirect"
      });
    };

    document.addEventListener("click", handler);
    return () => {
      document.removeEventListener("click", handler);
    };
  }, []);

  return null;
}
