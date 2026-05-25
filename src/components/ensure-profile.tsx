import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";

import { api } from "@convex/_generated/api";

export function EnsureProfile() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const ensureProfile = useMutation(api.profiles.ensureCurrentUserProfile);
  const hasRequestedProfile = useRef(false);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      hasRequestedProfile.current = false;
      return;
    }

    if (hasRequestedProfile.current) return;

    hasRequestedProfile.current = true;
    ensureProfile({}).catch(() => {
      hasRequestedProfile.current = false;
    });
  }, [ensureProfile, isAuthenticated, isLoading]);

  return null;
}
