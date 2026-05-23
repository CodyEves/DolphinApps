import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { Pencil, Plus } from "lucide-react";
import { Link } from "react-router";

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

export function TrainingPage() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const tracks = useQuery(api.training.listTrainingTracks, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = effectiveRole === "admin";
  const visibleTracks = isAdmin
    ? tracks
    : tracks?.filter((track) => track.isPublished);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Training"
        title="Training tracks"
        description="Choose a learning track to view its units, lessons, videos, assignments, and progress."
        actions={
          <Authenticated>
            {isAdmin && (
              <Button asChild>
                <Link to="/training/tracks/new">
                  <Plus className="size-4" />
                  Create a new Learning Track
                </Link>
              </Button>
            )}
          </Authenticated>
        }
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <CardTitle>Sign in to load training data</CardTitle>
            <CardDescription>
              Sign in to view available training tracks.
            </CardDescription>
          </CardHeader>
        </Card>
      </Unauthenticated>

      <Authenticated>
        <Card>
          <CardHeader>
            <CardTitle>Learning tracks</CardTitle>
            <CardDescription>
              Open a track to see its units and lessons.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleTracks === undefined && (
              <p className="text-sm text-muted-foreground">Loading tracks...</p>
            )}
            {visibleTracks?.length === 0 && (
              <div className="rounded-md border p-4 text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
                No tracks yet. Admins can create a learning track to get started.
              </div>
            )}
            {visibleTracks?.map((track) => (
              <div
                key={track._id}
                className="flex min-h-44 flex-col justify-between gap-4 rounded-md border p-4 transition-colors hover:bg-accent"
              >
                <Link to={`/training/tracks/${track._id}`} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{track.title}</p>
                    {!track.isPublished && <Badge variant="secondary">Draft</Badge>}
                    <Badge variant="outline">{track.level}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {track.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {track.units.length} units · {track.lessons.length} lessons
                  </p>
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild variant="outline" className="flex-1">
                    <Link to={`/training/tracks/${track._id}`}>Open track</Link>
                  </Button>
                  {isAdmin && (
                    <Button asChild variant="ghost" size="icon" aria-label="Edit track">
                      <Link to={`/training/tracks/${track._id}/edit`}>
                        <Pencil className="size-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </Authenticated>
    </div>
  );
}
