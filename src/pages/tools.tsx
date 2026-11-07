import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Lock,
  MapPin,
  Plus,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { isAdminRole } from "@/lib/role-access";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";
import { ListSkeleton, PageSkeleton } from "@/components/ui/skeleton";

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

export function ToolsPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const equipment = useQuery(api.equipment.listEquipment, isAuthenticated ? {} : "skip");
  const createEquipment = useMutation(api.equipment.createEquipment);
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = isAdminRole(effectiveRole);

  const [search, setSearch] = useState("");

  const visibleEquipment = useMemo(() => {
    if (!equipment) {
      return undefined;
    }

    const term = search.trim().toLowerCase();

    return equipment
      .filter((item) => isAdmin || item.isActive)
      .filter(
        (item) =>
          !term ||
          item.name.toLowerCase().includes(term) ||
          item.category.toLowerCase().includes(term) ||
          (item.location ?? "").toLowerCase().includes(term),
      );
  }, [equipment, isAdmin, search]);

  async function handleCreateEquipment() {
    try {
      const equipmentId = await createEquipment({});
      toast.success("Tool added");
      navigate(`/tools/${equipmentId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add tool");
    }
  }

  const readyCount =
    visibleEquipment?.filter((item) => {
      const mySignOff = item.signOffs.find(
        (signOff) => signOff.userId === viewer?.user._id,
      );

      return mySignOff?.isCurrent ?? false;
    }).length ?? 0;
  const needsAckCount =
    visibleEquipment?.filter(
      (item) => item.sopStatus.isPublished && !item.sopStatus.hasAcknowledged,
    ).length ?? 0;

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        title="Get signed off on shop tools"
        description="Read the SOP, pass the safety test, then get your hands-on sign-off. Your badge only powers a tool once you are signed off."
        actions={
          <Authenticated>
            {isAdmin && (
              <Button onClick={() => void handleCreateEquipment()}>
                <Plus className="size-4" />
                Add tool
              </Button>
            )}
          </Authenticated>
        }
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <CardTitle>Sign in to load shop tools</CardTitle>
            <CardDescription>
              Sign in to read SOPs and see your sign-off status.
            </CardDescription>
          </CardHeader>
        </Card>
      </Unauthenticated>

      <Authenticated>
        <div className="space-y-5">
          {visibleEquipment !== undefined && visibleEquipment.length > 0 && (
            <p className="text-sm text-muted-foreground">
              You can run <span className="font-semibold text-foreground tabular-nums">{readyCount}</span> of{" "}
              <span className="tabular-nums">{visibleEquipment.length}</span> tools
              {needsAckCount > 0 && (
                <>
                  {" "}· <span className="font-semibold text-foreground tabular-nums">{needsAckCount}</span> SOPs to read
                </>
              )}
            </p>
          )}

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search tools"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleEquipment === undefined && (
              <ListSkeleton className="md:col-span-2 xl:col-span-3" label="Loading tools" />
            )}

            {visibleEquipment?.length === 0 && (
              <Card className="md:col-span-2 xl:col-span-3">
                <CardHeader>
                  <CardTitle>No tools found</CardTitle>
                  <CardDescription>
                    {search
                      ? `No tool matches “${search}”.`
                      : "Admins can add the first tool from the top of this page."}
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            {visibleEquipment?.map((item) => {
              const mySignOff = item.signOffs.find(
                (signOff) => signOff.userId === viewer?.user._id,
              );
              const hasPassedSafetyTest = item.latestQuizAttempt?.status === "passed";
              const hasCompletedVideo = item.videoProgress?.status === "completed";
              const isSignedOff = mySignOff?.isCurrent ?? false;
              const isExpired = mySignOff?.isExpired ?? false;

              return (
                <Link
                  key={item._id}
                  to={`/tools/${item._id}`}
                  className="group block rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Card className="h-full transition-colors group-hover:bg-accent">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle>{item.name}</CardTitle>
                            {item.isLockedOut && (
                              <Badge variant="destructive">
                                <Lock className="size-3" />
                                Locked out
                              </Badge>
                            )}
                          </div>
                          <CardDescription>
                            {item.description || item.category}
                          </CardDescription>
                        </div>
                        {isSignedOff ? (
                          <Badge className="shrink-0">
                            <CreditCard className="size-3" />
                            Badge works
                          </Badge>
                        ) : isExpired ? (
                          <Badge variant="secondary" className="shrink-0">
                            <AlertTriangle className="size-3" />
                            Expired
                          </Badge>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {item.location && (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="size-4" />
                          {item.location}
                        </p>
                      )}

                      <ul className="grid gap-1.5 text-sm">
                        {[
                          {
                            show: true,
                            done: item.sopStatus.hasAcknowledged,
                            label: !item.sopStatus.isPublished ? "SOP not written yet" : "Read the SOP",
                          },
                          { show: !!item.videoUrl, done: hasCompletedVideo, label: "Watch the training video" },
                          { show: !!item.quiz, done: hasPassedSafetyTest, label: "Pass the safety test" },
                          { show: item.instructorApprovalRequired, done: isSignedOff, label: "Hands-on check with a mentor" },
                        ]
                          .filter((step) => step.show)
                          .map((step) => (
                            <li key={step.label} className={step.done ? "flex items-center gap-2 text-muted-foreground" : "flex items-center gap-2"}>
                              {step.done ? (
                                <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Done" />
                              ) : (
                                <span className="mx-[3px] size-2.5 shrink-0 rounded-full border-2 border-muted-foreground/60" aria-label="To do" />
                              )}
                              {step.label}
                            </li>
                          ))}
                      </ul>
                      {!item.isActive && <Badge variant="secondary">Inactive</Badge>}

                      <p className="border-t pt-3 text-sm font-medium">
                        {isSignedOff
                          ? mySignOff?.expiresAt
                            ? `Signed off - expires ${formatDate(mySignOff.expiresAt)}`
                            : `Signed off ${formatDate(mySignOff?.approvedAt)}`
                          : isExpired
                            ? "Sign-off expired - see an instructor"
                            : "Not signed off yet"}
                      </p>
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
