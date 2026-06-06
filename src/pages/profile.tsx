import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import {
  Award,
  Camera,
  CheckCircle2,
  Clock,
  GraduationCap,
  Save,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { PageHeading } from "@/components/page-heading";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

function initials(nameOrEmail?: string | null) {
  if (!nameOrEmail) {
    return "DA";
  }

  return nameOrEmail
    .split(/[ @.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function ProfilePage() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const tracks = useQuery(api.training.listTrainingTracks, isAuthenticated ? {} : "skip");
  const progress = useQuery(api.demo.myLessonProgress, isAuthenticated ? {} : "skip");
  const awards = useQuery(api.badges.listMyBadgeAwards, isAuthenticated ? {} : "skip");
  const generateProfileAvatarUploadUrl = useMutation(
    api.profiles.generateProfileAvatarUploadUrl,
  );
  const updateMyProfile = useMutation(api.profiles.updateMyProfile);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarStorageId, setAvatarStorageId] = useState<Id<"_storage"> | undefined>();
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | undefined>();
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (!viewer) {
      return;
    }

    // Hydrate editable profile fields after the viewer query loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayName(
      viewer.profile.displayName ?? viewer.user.name ?? viewer.user.email ?? "",
    );
    setBio("bio" in viewer.profile ? viewer.profile.bio ?? "" : "");
    setAvatarStorageId(undefined);
  }, [viewer]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  const completedLessonIds = useMemo(
    () => new Set(progress?.map((item) => item.lessonId) ?? []),
    [progress],
  );
  const trackStats = useMemo(
    () =>
      (tracks ?? []).map((track) => {
        const completedLessons = track.lessons.filter((lesson) =>
          completedLessonIds.has(lesson._id),
        ).length;
        const totalLessons = track.lessons.length;
        const percent =
          totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

        return {
          id: track._id,
          title: track.title,
          completedLessons,
          totalLessons,
          percent,
          isComplete: totalLessons > 0 && completedLessons === totalLessons,
        };
      }),
    [completedLessonIds, tracks],
  );
  const completedTrackCount = trackStats.filter((track) => track.isComplete).length;
  const totalLessonCount = trackStats.reduce(
    (total, track) => total + track.totalLessons,
    0,
  );
  const completedLessonCount = trackStats.reduce(
    (total, track) => total + track.completedLessons,
    0,
  );
  const overallProgress =
    totalLessonCount > 0 ? Math.round((completedLessonCount / totalLessonCount) * 100) : 0;
  const avatarUrl = avatarPreviewUrl ?? viewer?.avatarUrl ?? undefined;
  const profileName = displayName || viewer?.user.email || "Team member";

  async function handleAvatarUpload(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file for your profile picture.");
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const uploadUrl = await generateProfileAvatarUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error(`Unable to upload ${file.name}.`);
      }

      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };

      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }

      setAvatarStorageId(storageId);
      setAvatarPreviewUrl(URL.createObjectURL(file));
      toast.success("Profile picture ready to save");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload image");
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingProfile(true);

    try {
      await updateMyProfile({
        displayName,
        bio,
        ...(avatarStorageId ? { avatarStorageId } : {}),
      });
      toast.success("Profile saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save profile");
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Profile"
        title="My profile"
        description="Update your public profile and review your training achievements."
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <CardTitle>Sign in to view your profile</CardTitle>
            <CardDescription>
              Your profile is available after you sign in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </Unauthenticated>

      <Authenticated>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <Card className="overflow-hidden py-0">
              <CardHeader className="border-b bg-muted/25 px-5 py-4">
                <CardTitle>Profile details</CardTitle>
                <CardDescription>
                  This is the profile other team members will see around DolphinLMS.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 px-5 py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Avatar className="size-24 border">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                    <AvatarFallback className="text-xl">
                      {initials(profileName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <Label htmlFor="profile-avatar" className="flex items-center gap-2">
                      <Camera className="size-4 text-primary" />
                      Profile picture
                    </Label>
                    <Input
                      id="profile-avatar"
                      type="file"
                      accept="image/*"
                      disabled={isUploadingAvatar}
                      onChange={(event) =>
                        void handleAvatarUpload(event.currentTarget.files?.[0])
                      }
                    />
                    <p className="text-sm text-muted-foreground">
                      {isUploadingAvatar
                        ? "Uploading image..."
                        : "Choose an image, then save your profile."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profile-name">Display name</Label>
                    <Input
                      id="profile-name"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      placeholder="Your name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={viewer?.user.email ?? ""} disabled />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="profile-bio">Bio</Label>
                    <Textarea
                      id="profile-bio"
                      value={bio}
                      onChange={(event) => setBio(event.target.value.slice(0, 240))}
                      placeholder="A short note about your role, interests, or what you're working on."
                      className="min-h-28"
                    />
                    <p className="text-sm text-muted-foreground">
                      {bio.length}/240 characters
                    </p>
                  </div>
                </div>

                <Button type="submit" disabled={isSavingProfile || isUploadingAvatar}>
                  <Save className="size-4" />
                  {isSavingProfile ? "Saving..." : "Save profile"}
                </Button>
              </CardContent>
            </Card>

            <Card className="overflow-hidden py-0">
              <CardHeader className="border-b bg-muted/25 px-5 py-4">
                <CardTitle>Training progress</CardTitle>
                <CardDescription>
                  Track completion across learning paths and lessons.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-5 py-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border bg-background p-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <GraduationCap className="size-4" />
                      Lessons
                    </div>
                    <p className="mt-2 text-2xl font-semibold">
                      {completedLessonCount}/{totalLessonCount}
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="size-4" />
                      Tracks
                    </div>
                    <p className="mt-2 text-2xl font-semibold">
                      {completedTrackCount}/{trackStats.length}
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Award className="size-4" />
                      Badges
                    </div>
                    <p className="mt-2 text-2xl font-semibold">
                      {awards?.length ?? 0}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Overall lesson progress</span>
                    <span className="font-medium">{overallProgress}%</span>
                  </div>
                  <Progress value={overallProgress} />
                </div>
                <div className="space-y-2">
                  {trackStats.slice(0, 5).map((track) => (
                    <Link
                      key={track.id}
                      to={`/training/tracks/${track.id}`}
                      className="block rounded-md border bg-background p-3 text-sm transition-colors hover:bg-accent"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{track.title}</span>
                        <Badge variant={track.isComplete ? "default" : "outline"}>
                          {track.percent}%
                        </Badge>
                      </div>
                      <Progress value={track.percent} className="mt-2" />
                    </Link>
                  ))}
                  {trackStats.length === 0 && (
                    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      No learning tracks available yet.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </form>

          <aside className="space-y-5 lg:sticky lg:top-20">
            <Card className="py-0">
              <CardHeader className="border-b px-5 py-4">
                <CardTitle>Account</CardTitle>
                <CardDescription>Profile role and team context.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-5 py-5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Role</span>
                  <Badge>
                    <ShieldCheck className="size-3" />
                    {viewer?.profile.role ?? "guest"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium">{viewer?.profile.status ?? "inactive"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Group</span>
                  <span className="font-medium">
                    {viewer?.profile && "studentGroup" in viewer.profile
                      ? viewer.profile.studentGroup ?? "Team member"
                      : "Team member"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden py-0">
              <CardHeader className="border-b px-5 py-4">
                <CardTitle>Badges earned</CardTitle>
                <CardDescription>Recent achievements and certifications.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-5 py-5">
                {awards === undefined && (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    Loading badges...
                  </div>
                )}
                {awards?.length === 0 && (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No badges earned yet.
                  </div>
                )}
                {awards?.slice(0, 6).map((award) => (
                  <div key={award._id} className="rounded-md border bg-background p-3">
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                        <Award className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium">{award.badge?.title ?? "Badge"}</p>
                        <p className="text-xs text-muted-foreground">
                          Earned {formatDate(award.earnedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                <Button asChild variant="outline" className="w-full">
                  <Link to="/badges">
                    <Award className="size-4" />
                    View all badges
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="py-0">
              <CardContent className="space-y-3 px-5 py-5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Clock className="size-4 text-primary" />
                  Achievement summary
                </div>
                <p>
                  Keep completing lessons and equipment requirements to unlock more badges.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </Authenticated>
    </div>
  );
}
