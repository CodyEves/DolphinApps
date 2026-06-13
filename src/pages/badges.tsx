import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { Award, CheckCircle2, Pencil, Plus, Users } from "lucide-react";
import { useEffect } from "react";
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
import { canManageBadges } from "@/lib/role-access";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function BadgesPage() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const badges = useQuery(api.badges.listBadges, isAuthenticated ? {} : "skip");
  const awards = useQuery(api.badges.listMyBadgeAwards, isAuthenticated ? {} : "skip");
  const syncMyBadges = useMutation(api.badges.syncMyBadges);
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const canManageBadgeRecords = canManageBadges(effectiveRole);
  const earnedAwards = new Map(awards?.map((award) => [award.badgeId, award]));
  const activeBadgeCount = badges?.filter((badge) => badge?.isActive).length ?? 0;
  const earnedBadgeCount =
    badges?.filter((badge) => badge && earnedAwards.has(badge._id)).length ?? 0;

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void syncMyBadges({})
      .then((awardedBadgeIds) => {
        if (awardedBadgeIds.length > 0) {
          toast.success(
            awardedBadgeIds.length === 1
              ? "New badge awarded"
              : `${awardedBadgeIds.length} new badges awarded`,
          );
        }
      })
      .catch(() => undefined);
  }, [isAuthenticated, syncMyBadges]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Badges"
        title="Achievements and certifications"
        description="Badges are automatically awarded when assigned training and equipment requirements are complete."
        actions={
          <Authenticated>
            {canManageBadgeRecords && (
              <>
                <Button asChild variant="outline">
                  <Link to="/badges/awards">
                    <Users className="size-4" />
                    View awards
                  </Link>
                </Button>
                <Button asChild>
                  <Link to="/badges/new">
                    <Plus className="size-4" />
                    Create badge
                  </Link>
                </Button>
              </>
            )}
          </Authenticated>
        }
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <CardTitle>Sign in to load badges</CardTitle>
            <CardDescription>
              Badge progress is tied to your training and equipment records.
            </CardDescription>
          </CardHeader>
        </Card>
      </Unauthenticated>

      <Authenticated>
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Award className="size-4" />
                Available
              </div>
              <p className="mt-1 text-2xl font-semibold">
                {badges === undefined ? "..." : activeBadgeCount}
              </p>
            </div>
            <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4" />
                Earned
              </div>
              <p className="mt-1 text-2xl font-semibold">
                {badges === undefined || awards === undefined ? "..." : earnedBadgeCount}
              </p>
            </div>
            <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="size-4" />
                Managed
              </div>
              <p className="mt-1 text-2xl font-semibold">
                {canManageBadgeRecords ? "On" : "Off"}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {badges === undefined && (
            <Card className="md:col-span-2 xl:col-span-3">
              <CardHeader>
                <CardTitle>Loading badges</CardTitle>
                <CardDescription>Checking badge requirements.</CardDescription>
              </CardHeader>
            </Card>
          )}
          {badges?.length === 0 && (
            <Card className="md:col-span-2 xl:col-span-3">
              <CardHeader>
                <CardTitle>No badges yet</CardTitle>
                <CardDescription>
                  Admins and mentors can create the first badge to start awarding achievements.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
          {badges?.map((badge) => {
            if (!badge) {
              return null;
            }

            const award = earnedAwards.get(badge._id);

            return (
              <Card key={badge._id} className={award ? "border-primary/60" : undefined}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <Award className="size-5 text-primary" />
                      <CardTitle>{badge.title}</CardTitle>
                      <CardDescription>{badge.description}</CardDescription>
                    </div>
                    {canManageBadgeRecords && (
                      <Button asChild variant="ghost" size="icon" aria-label="Edit badge">
                        <Link to={`/badges/${badge._id}/edit`}>
                          <Pencil className="size-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {award ? (
                      <Badge>
                        <CheckCircle2 className="size-3" />
                        Earned {formatDate(award.earnedAt)}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not earned yet</Badge>
                    )}
                    {!badge.isActive && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {badge.criteriaSummary}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {badge.requiredTracks.map((track) => (
                      <Badge key={track._id} variant="outline">
                        {track.title}
                      </Badge>
                    ))}
                    {badge.requiredEquipment.map((equipment) => (
                      <Badge key={equipment._id} variant="outline">
                        {equipment.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
        </div>
      </Authenticated>
    </div>
  );
}
