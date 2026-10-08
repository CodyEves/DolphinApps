import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  CreditCard,
  Lock,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Wrench,
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
  const sopCount = visibleEquipment?.filter((item) => item.sopStatus.isPublished).length ?? 0;
  const needsAckCount =
    visibleEquipment?.filter(
      (item) => item.sopStatus.isPublished && !item.sopStatus.hasAcknowledged,
    ).length ?? 0;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Shop Tools"
          title="Shop tools"
          description="Loading tool records."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Shop Tools"
        title="Shop tools"
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
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="size-4" />
                Tools you can run
              </div>
              <p className="mt-1 text-2xl font-semibold">
                {visibleEquipment === undefined ? "..." : readyCount}
              </p>
            </div>
            <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <BookOpenCheck className="size-4" />
                Published SOPs
              </div>
              <p className="mt-1 text-2xl font-semibold">
                {visibleEquipment === undefined ? "..." : sopCount}
              </p>
            </div>
            <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="size-4" />
                SOPs to read
              </div>
              <p className="mt-1 text-2xl font-semibold">
                {visibleEquipment === undefined ? "..." : needsAckCount}
              </p>
            </div>
          </div>

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
              <Card className="md:col-span-2 xl:col-span-3">
                <CardHeader>
                  <CardTitle>Loading tools</CardTitle>
                  <CardDescription>Fetching SOPs and sign-offs.</CardDescription>
                </CardHeader>
              </Card>
            )}

            {visibleEquipment?.length === 0 && (
              <Card className="md:col-span-2 xl:col-span-3">
                <CardHeader>
                  <CardTitle>No tools found</CardTitle>
                  <CardDescription>
                    {search
                      ? "No tool matches that search."
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
                  className="group block rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Card className="h-full transition-colors group-hover:bg-accent">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Wrench className="size-5 text-primary" />
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

                      <div className="flex flex-wrap gap-2">
                        {!item.isActive && <Badge variant="secondary">Inactive</Badge>}
                        <Badge
                          variant={
                            !item.sopStatus.isPublished
                              ? "outline"
                              : item.sopStatus.hasAcknowledged
                                ? "default"
                                : "secondary"
                          }
                        >
                          {item.sopStatus.hasAcknowledged && <CheckCircle2 className="size-3" />}
                          {!item.sopStatus.isPublished
                            ? "No SOP yet"
                            : item.sopStatus.hasAcknowledged
                              ? "SOP read"
                              : "SOP to read"}
                        </Badge>
                        {item.videoUrl && (
                          <Badge variant={hasCompletedVideo ? "default" : "outline"}>
                            {hasCompletedVideo && <CheckCircle2 className="size-3" />}
                            {hasCompletedVideo ? "Video done" : "Video"}
                          </Badge>
                        )}
                        {item.quiz && (
                          <Badge variant={hasPassedSafetyTest ? "default" : "outline"}>
                            {hasPassedSafetyTest && <CheckCircle2 className="size-3" />}
                            {hasPassedSafetyTest ? "Test passed" : "Safety test"}
                          </Badge>
                        )}
                        {item.instructorApprovalRequired && (
                          <Badge variant={isSignedOff ? "default" : "outline"}>
                            {isSignedOff && <CheckCircle2 className="size-3" />}
                            {isSignedOff ? "Signed off" : "Hands-on needed"}
                          </Badge>
                        )}
                      </div>

                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ShieldCheck className="size-4 text-primary" />
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
