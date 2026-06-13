import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Plus,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";

function formatDate(timestamp: number | undefined) {
  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function EquipmentPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const equipment = useQuery(
    api.equipment.listEquipment,
    isAuthenticated ? {} : "skip",
  );
  const createEquipment = useMutation(api.equipment.createEquipment);
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = effectiveRole === "admin";
  const visibleEquipment = isAdmin
    ? equipment
    : equipment?.filter((item) => item.isActive);
  const activeEquipmentCount =
    visibleEquipment?.filter((item) => item.isActive).length ?? 0;
  const completeEquipmentCount =
    visibleEquipment?.filter((item) => {
      const mySignOff = item.signOffs.find(
        (signOff) => signOff.userId === viewer?.user._id,
      );
      const hasPassedSafetyTest = item.latestQuizAttempt?.status === "passed";
      const hasCompletedVideo = item.videoProgress?.status === "completed";
      const videoRequirementComplete = !item.videoUrl || hasCompletedVideo;
      const safetyRequirementComplete = !item.quiz || hasPassedSafetyTest;
      const handsOnRequirementComplete =
        !item.instructorApprovalRequired || mySignOff?.status === "approved";

      return videoRequirementComplete && safetyRequirementComplete && handsOnRequirementComplete;
    }).length ?? 0;
  const handsOnRequiredCount =
    visibleEquipment?.filter((item) => item.instructorApprovalRequired).length ?? 0;

  async function handleCreateEquipment() {
    try {
      const equipmentId = await createEquipment({});
      toast.success("Equipment added");
      navigate(`/equipment/${equipmentId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add equipment");
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Equipment"
          title="Equipment sign-offs"
          description="Loading equipment records."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Equipment"
        title="Equipment sign-offs"
        description="Open a tool to review its training video, safety test, and hands-on demonstration status."
        actions={
          <Authenticated>
            {isAdmin && (
              <Button onClick={handleCreateEquipment}>
                <Plus className="size-4" />
                Add equipment
              </Button>
            )}
          </Authenticated>
        }
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <CardTitle>Sign in to load equipment</CardTitle>
            <CardDescription>
              Sign in to view equipment training and sign-offs.
            </CardDescription>
          </CardHeader>
        </Card>
      </Unauthenticated>

      <Authenticated>
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wrench className="size-4" />
                Active tools
              </div>
              <p className="mt-1 text-2xl font-semibold">
                {visibleEquipment === undefined ? "..." : activeEquipmentCount}
              </p>
            </div>
            <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4" />
                Ready
              </div>
              <p className="mt-1 text-2xl font-semibold">
                {visibleEquipment === undefined ? "..." : completeEquipmentCount}
              </p>
            </div>
            <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="size-4" />
                Hands-on
              </div>
              <p className="mt-1 text-2xl font-semibold">
                {visibleEquipment === undefined ? "..." : handsOnRequiredCount}
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleEquipment === undefined && (
            <Card className="md:col-span-2 xl:col-span-3">
              <CardHeader>
                <CardTitle>Loading equipment</CardTitle>
                <CardDescription>Fetching tool records and sign-offs.</CardDescription>
              </CardHeader>
            </Card>
          )}

          {visibleEquipment?.length === 0 && (
            <Card className="md:col-span-2 xl:col-span-3">
              <CardHeader>
                <CardTitle>No equipment yet</CardTitle>
                <CardDescription>
                  Admins can add the first tool from the top of this page.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          {visibleEquipment?.map((item) => {
            const mySignOff = item.signOffs.find(
              (signOff) => signOff.userId === viewer?.user._id,
            );
            const completedSignOffs = item.signOffs.filter(
              (signOff) => signOff.status === "approved",
            ).length;
            const hasPassedSafetyTest = item.latestQuizAttempt?.status === "passed";
            const hasCompletedVideo = item.videoProgress?.status === "completed";
            const hasCompletedHandsOn = mySignOff?.status === "approved";
            const videoRequirementComplete = !item.videoUrl || hasCompletedVideo;
            const safetyRequirementComplete = !item.quiz || hasPassedSafetyTest;
            const handsOnRequirementComplete =
              !item.instructorApprovalRequired || hasCompletedHandsOn;
            const isEquipmentComplete =
              !isAdmin &&
              videoRequirementComplete &&
              safetyRequirementComplete &&
              handsOnRequirementComplete;

            return (
              <Link
                key={item._id}
                to={`/equipment/${item._id}`}
                className="group block rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <Card className="h-full transition-colors group-hover:bg-accent">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Wrench className="size-5 text-primary" />
                          <CardTitle>{item.name}</CardTitle>
                          {isEquipmentComplete && (
                            <Badge>
                              <CheckCircle2 className="size-3" />
                              Complete
                            </Badge>
                          )}
                        </div>
                        <CardDescription>{item.description || item.category}</CardDescription>
                      </div>
                      <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={item.isActive ? "default" : "secondary"}>
                        {item.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {item.videoUrl && (
                        <Badge variant={hasCompletedVideo ? "default" : "outline"}>
                          {hasCompletedVideo && <CheckCircle2 className="size-3" />}
                          {hasCompletedVideo ? "Video complete" : "Video"}
                        </Badge>
                      )}
                      {item.quiz && (
                        <Badge variant={hasPassedSafetyTest ? "default" : "outline"}>
                          {hasPassedSafetyTest && <CheckCircle2 className="size-3" />}
                          {hasPassedSafetyTest
                            ? "Safety test complete"
                            : `${item.questions.length} test questions`}
                        </Badge>
                      )}
                      {item.instructorApprovalRequired && (
                        <Badge variant={hasCompletedHandsOn ? "default" : "outline"}>
                          {hasCompletedHandsOn && <CheckCircle2 className="size-3" />}
                          {hasCompletedHandsOn
                            ? "Hands-on complete"
                            : "Hands-on required"}
                        </Badge>
                      )}
                    </div>
                    {isAdmin ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ClipboardCheck className="size-4 text-primary" />
                        {completedSignOffs} completed demonstrations
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {item.videoUrl && hasCompletedVideo ? (
                          <>
                            <CheckCircle2 className="size-4 text-primary" />
                            Video checked off
                          </>
                        ) : item.videoUrl ? (
                          <>
                            <ExternalLink className="size-4 text-primary" />
                            Video pending
                          </>
                        ) : hasPassedSafetyTest ? (
                          <>
                            <CheckCircle2 className="size-4 text-primary" />
                            Safety test checked off
                          </>
                        ) : (
                          <>
                            <ClipboardCheck className="size-4 text-primary" />
                            Safety test pending
                          </>
                        )}
                      </div>
                    )}
                    {!isAdmin && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ShieldCheck className="size-4 text-primary" />
                        {hasCompletedHandsOn
                          ? `Hands-on completed ${formatDate(mySignOff.approvedAt)}`
                          : "Hands-on demonstration pending"}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          </div>
        </div>
      </Authenticated>
    </div>
  );
}
