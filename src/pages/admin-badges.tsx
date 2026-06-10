import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  LockKeyhole,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canManageBadges } from "@/lib/role-access";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function AdminBadgesPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const canManageBadgeRecords = canManageBadges(effectiveRole);
  const badgeAwards = useQuery(
    api.badges.listBadgeAwardsForAdmin,
    isAuthenticated && canManageBadgeRecords ? {} : "skip",
  );
  const users = useQuery(
    api.badges.listAwardableUsersForAdmin,
    isAuthenticated && canManageBadgeRecords ? {} : "skip",
  );
  const forceAwardBadge = useMutation(api.badges.forceAwardBadge);
  const removeBadgeAward = useMutation(api.badges.removeBadgeAward);
  const [selectedBadgeId, setSelectedBadgeId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const awardedBadges = useMemo(
    () =>
      badgeAwards?.flatMap(({ badge, awards }) =>
        awards.map((award) => ({
          ...award,
          badgeTitle: badge.title,
        })),
      ) ?? [],
    [badgeAwards],
  );

  async function handleForceAward() {
    if (!selectedBadgeId || !selectedUserId) {
      toast.error("Choose a badge and an account.");
      return;
    }

    setSavingAction("force-award");

    try {
      await forceAwardBadge({
        badgeId: selectedBadgeId as Id<"badges">,
        userId: selectedUserId as Id<"users">,
      });
      toast.success("Badge awarded");
      setSelectedBadgeId("");
      setSelectedUserId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to award badge");
    } finally {
      setSavingAction(null);
    }
  }

  async function handleRemoveAward(awardId: Id<"userBadges">) {
    setSavingAction(`remove:${awardId}`);

    try {
      await removeBadgeAward({ awardId });
      toast.success("Badge award removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove badge award");
    } finally {
      setSavingAction(null);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Admin"
          title="Badge management"
          description="Loading badge controls."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Admin"
        title="Badge management"
        description="Force-award badges to accounts, remove awards, and open badge records."
        actions={
          <Button asChild variant="outline">
            <Link to="/management">
              <ArrowLeft className="size-4" />
              Back to admin
            </Link>
          </Button>
        }
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <LockKeyhole className="size-5 text-primary" />
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Badge management requires an authenticated admin or mentor account.
            </CardDescription>
          </CardHeader>
        </Card>
      </Unauthenticated>

      <Authenticated>
        {!canManageBadgeRecords ? (
          <Card>
            <CardHeader>
              <LockKeyhole className="size-5 text-primary" />
              <CardTitle>Badge management access required</CardTitle>
              <CardDescription>
                Switch back to your actual role or sign in with an admin or mentor account.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <Award className="size-5 text-primary" />
                <CardTitle>Badge overrides</CardTitle>
                <CardDescription>
                  Force-award badges to accounts or remove awards when a record needs correction.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <Select
                    value={selectedBadgeId}
                    onValueChange={setSelectedBadgeId}
                    disabled={badgeAwards === undefined}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose badge" />
                    </SelectTrigger>
                    <SelectContent>
                      {badgeAwards?.map(({ badge }) => (
                        <SelectItem key={badge._id} value={badge._id}>
                          {badge.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                    disabled={users === undefined}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose account" />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.map((user) => (
                        <SelectItem key={user.userId} value={user.userId}>
                          {user.displayName ?? user.email ?? "Team member"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    onClick={() => void handleForceAward()}
                    disabled={!selectedBadgeId || !selectedUserId || savingAction === "force-award"}
                  >
                    <UserPlus className="size-4" />
                    Force award
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-medium">Current manual and earned awards</h2>
                    <Button asChild variant="outline" size="sm">
                      <Link to="/badges/awards">View roster</Link>
                    </Button>
                  </div>
                  {badgeAwards === undefined && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">
                      Loading badge awards.
                    </div>
                  )}
                  {badgeAwards !== undefined && awardedBadges.length === 0 && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">
                      No badge awards have been recorded yet.
                    </div>
                  )}
                  {awardedBadges.map((award) => (
                    <div
                      key={award._id}
                      className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            {award.displayName ?? award.email ?? "Team member"}
                          </p>
                          <Badge variant="outline">{award.badgeTitle}</Badge>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          <CheckCircle2 className="mr-1 inline size-3" />
                          Earned {formatDate(award.earnedAt)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleRemoveAward(award._id)}
                        disabled={savingAction === `remove:${award._id}`}
                        aria-label={`Remove ${award.displayName ?? award.email ?? "badge award"}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </Authenticated>
    </div>
  );
}

