import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";

import { api } from "@convex/_generated/api";

export function EnsureProfile() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const ensureProfile = useMutation(api.profiles.ensureCurrentUserProfile);
  const hasRequestedProfile = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || hasRequestedProfile.current) {
      return;
    }

    hasRequestedProfile.current = true;
    void ensureProfile({});
  }, [ensureProfile, isAuthenticated, isLoading]);

  return null;
}
