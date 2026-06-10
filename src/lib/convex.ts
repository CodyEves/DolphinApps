import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

function backendConfigError(url: string | undefined) {
  if (!url) {
    return "VITE_CONVEX_URL is not set.";
  }

  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return "VITE_CONVEX_URL is not a valid URL.";
  }

  const isLocalBackend =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1";
  const isLocalApp =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "::1");

  if (isLocalBackend && !isLocalApp) {
    return "VITE_CONVEX_URL points to localhost, which cannot work from a deployed site.";
  }

  return null;
}

export const configuredConvexUrl = convexUrl;
export const convexConfigError = backendConfigError(convexUrl);
export const hasConvexUrl = Boolean(convexUrl) && !convexConfigError;
export const convex = hasConvexUrl && convexUrl ? new ConvexReactClient(convexUrl) : null;
