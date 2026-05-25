import { useMutation, useQuery } from "convex/react";
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
  const viewer = useQuery(api.profiles.viewer, {});
  const badges = useQuery(api.badges.listBadges, {});
  const awards = useQuery(api.badges.listMyBadgeAwards, {});
  const syncMyBadges = useMutation(api.badges.syncMyBadges);
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = effectiveRole === "admin";
  const earnedAwards = new Map(awards?.map((award) => [award.badgeId, award]));

  useEffect(() => {
    if (!viewer) return;

    syncMyBadges({})
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
  }, [syncMyBadges, viewer]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Badges"
        title="Achievements and certifications"
        description="Badges are automatically awarded when assigned training and equipment requirements are complete."
        actions={
          isAdmin && (
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
          )
        }
      />

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
                  Admins can create the first badge to start awarding achievements.
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
                    {isAdmin && (
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
  );
}
