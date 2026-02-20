export function track(eventName: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info("[analytics:noop]", eventName, payload);
  }
}
