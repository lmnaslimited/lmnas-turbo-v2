export type PagePreviewAcceptanceMessage = {
  pageId: string;
  previewValid: boolean;
  seoJsonLdValid: boolean;
};

const CHANNEL_NAME = "lmnas-studio-page-preview";
const STORAGE_KEY = "lmnas-studio-page-preview:last";
const WINDOW_MESSAGE_TYPE = "lmnas-studio-page-preview:accepted";

export function publishPagePreviewAcceptance(message: PagePreviewAcceptanceMessage): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...message,
        timestamp: Date.now()
      })
    );
  } catch {
    // ignore storage write failures
  }

  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(message);
    channel.close();
  }

  try {
    if (window.opener && window.opener !== window) {
      window.opener.postMessage(
        {
          type: WINDOW_MESSAGE_TYPE,
          payload: message
        },
        window.location.origin
      );
    }
  } catch {
    // ignore opener messaging failures
  }
}

export function subscribePagePreviewAcceptance(
  callback: (message: PagePreviewAcceptanceMessage) => void
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleMessage = (message: PagePreviewAcceptanceMessage | null | undefined) => {
    if (!message || typeof message.pageId !== "string") {
      return;
    }
    callback(message);
  };

  let channel: BroadcastChannel | null = null;
  let handler: ((event: MessageEvent<PagePreviewAcceptanceMessage>) => void) | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL_NAME);
    handler = (event: MessageEvent<PagePreviewAcceptanceMessage>) => {
      handleMessage(event.data);
    };
    channel.addEventListener("message", handler as EventListener);
  }

  const storageHandler = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || typeof event.newValue !== "string") {
      return;
    }
    try {
      const parsed = JSON.parse(event.newValue) as PagePreviewAcceptanceMessage | null;
      handleMessage(parsed);
    } catch {
      // ignore malformed storage events
    }
  };
  window.addEventListener("storage", storageHandler);

  const windowMessageHandler = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) {
      return;
    }
    const payload =
      event.data && typeof event.data === "object" && "type" in event.data && "payload" in event.data
        ? (event.data as { type?: string; payload?: PagePreviewAcceptanceMessage })
        : null;
    if (payload?.type !== WINDOW_MESSAGE_TYPE) {
      return;
    }
    handleMessage(payload.payload);
  };
  window.addEventListener("message", windowMessageHandler);

  return () => {
    window.removeEventListener("storage", storageHandler);
    window.removeEventListener("message", windowMessageHandler);
    if (channel && handler) {
      channel.removeEventListener("message", handler as EventListener);
      channel.close();
    }
  };
}
