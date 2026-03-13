export type AnalyticsPayload = Record<string, unknown>;

const RUDDER_WRITE_KEY = process.env.NEXT_PUBLIC_RUDDER_WRITE_KEY || "";
const RUDDER_DATA_PLANE_URL = process.env.NEXT_PUBLIC_RUDDER_DATA_PLANE_URL || "";
const RUDDER_COOKIE_DOMAIN = process.env.RUDDER_COOKIE_DOMAIN || ".lmnas.com";

export const analyticsConfig = {
  writeKey: RUDDER_WRITE_KEY,
  dataPlaneUrl: RUDDER_DATA_PLANE_URL,
  cookieDomain: RUDDER_COOKIE_DOMAIN
};

export function track(eventName: string, payload: AnalyticsPayload = {}) {
  if (!analyticsConfig.writeKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[analytics:noop]", eventName, payload);
    }
    return;
  }

  // Rudder SDK wiring intentionally centralized in this package for cross-app consistency.
  if (process.env.NODE_ENV !== "production") {
    console.info("[analytics:track]", eventName, payload);
  }
}
