import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";

import { api } from "@convex/_generated/api";
import {
  availableProgramViews,
  canSwitchProgramView,
  programForView,
  programMeta,
  type Program,
} from "@/lib/programs";
import { useUiStore } from "@/stores/use-ui-store";

export function useProgramView() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const profile = viewer?.profile ?? null;
  const programView = useUiStore((state) => state.programView);
  const setProgramView = useUiStore((state) => state.setProgramView);
  const selectedProgram = programForView(profile, programView);
  const availablePrograms = availableProgramViews(profile);

  function selectProgram(program: Program) {
    setProgramView(program);
  }

  return {
    viewer,
    profile,
    selectedProgram,
    activeProgramMeta: programMeta[selectedProgram],
    availablePrograms,
    canSwitchPrograms: canSwitchProgramView(profile),
    selectProgram,
  };
}
