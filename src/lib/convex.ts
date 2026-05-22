import { ConvexReactClient } from "convex/react";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

export const hasConvexUrl = Boolean(convexUrl);
export const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;
