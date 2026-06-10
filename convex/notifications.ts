import { getAuthUserId } from "@convex-dev/auth/server";

import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";

type NotificationItem = {
  id: string;
  kind: "lesson_review" | "hands_on_review" | "attendance_review";
  title: string;
  summary: string;
  detail: string;
  href: string;
  createdAt: number;
};

function isNotNull<T>(item: T | null): item is T {
  return item !== null;
}

async function currentProfile(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    return null;
  }

  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

function canReview(profile: Doc<"profiles"> | null) {
  return (
    profile?.status === "active" &&
    (profile.role === "admin" ||
      profile.role === "mentor" ||
      profile.role === "instructor")
  );
}

function displayNameFor(
  profile: Doc<"profiles"> | null,
  user: Doc<"users"> | null,
) {
  return profile?.displayName ?? user?.name ?? profile?.email ?? user?.email ?? "Team member";
}

async function lessonReviewNotifications(ctx: QueryCtx): Promise<NotificationItem[]> {
  const submissions = await ctx.db
    .query("exerciseSubmissions")
    .withIndex("by_status", (q) => q.eq("status", "submitted"))
    .collect();

  return (
    await Promise.all(
      submissions.map(async (submission) => {
        if (!submission.lessonId) {
          return null;
        }

        const lesson = await ctx.db.get(submission.lessonId);
        const user = await ctx.db.get(submission.userId);
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", submission.userId))
          .unique();

        if (!lesson || !user) {
          return null;
        }

        const unit = await ctx.db.get(lesson.unitId);
        const track = unit ? await ctx.db.get(unit.trackId) : null;
        const studentName = displayNameFor(profile, user);

        return {
          id: `lesson_review:${submission._id}`,
          kind: "lesson_review" as const,
          title: "Lesson submission needs review",
          summary: `${studentName} submitted ${lesson.title}.`,
          detail: track?.title ?? "Learning review",
          href: "/management/reviews",
          createdAt: submission.createdAt,
        };
      }),
    )
  ).filter(isNotNull);
}

async function handsOnReviewNotifications(ctx: QueryCtx): Promise<NotificationItem[]> {
  const equipment = await ctx.db.query("equipment").withIndex("by_active").collect();
  const notifications = await Promise.all(
    equipment
      .filter((item) => item.isActive && item.instructorApprovalRequired)
      .map(async (item) => {
        const quizzes = await ctx.db
          .query("quizzes")
          .withIndex("by_equipment", (q) => q.eq("linkedEquipmentId", item._id))
          .collect();
        const quiz = quizzes[0];

        if (!quiz) {
          return [];
        }

        const attempts = await ctx.db
          .query("quizAttempts")
          .withIndex("by_quiz", (q) => q.eq("quizId", quiz._id))
          .filter((q) => q.eq(q.field("status"), "passed"))
          .collect();
        const latestByUser = new Map<Id<"users">, (typeof attempts)[number]>();

        for (const attempt of attempts) {
          const existing = latestByUser.get(attempt.userId);

          if (!existing || (attempt.completedAt ?? 0) > (existing.completedAt ?? 0)) {
            latestByUser.set(attempt.userId, attempt);
          }
        }

        return await Promise.all(
          [...latestByUser.values()].map(async (attempt) => {
            const signOff = await ctx.db
              .query("equipmentSignOffs")
              .withIndex("by_user_equipment", (q) =>
                q.eq("userId", attempt.userId).eq("equipmentId", item._id),
              )
              .unique();

            if (signOff?.status === "approved") {
              return null;
            }

            const user = await ctx.db.get(attempt.userId);
            const profile = await ctx.db
              .query("profiles")
              .withIndex("by_user", (q) => q.eq("userId", attempt.userId))
              .unique();

            if (!user) {
              return null;
            }

            return {
              id: `hands_on_review:${item._id}:${attempt.userId}`,
              kind: "hands_on_review" as const,
              title: "Hands-on sign-off needs review",
              summary: `${displayNameFor(profile, user)} passed the safety test for ${item.name}.`,
              detail: signOff?.status ? signOff.status.replace("_", " ") : "Ready for sign-off",
              href: "/management/reviews",
              createdAt: attempt.completedAt ?? attempt.startedAt,
            };
          }),
        );
      }),
  );

  return notifications.flat().filter(isNotNull);
}

async function attendanceReviewNotifications(ctx: QueryCtx): Promise<NotificationItem[]> {
  const items = await ctx.db
    .query("attendanceSessions")
    .withIndex("by_status", (q) => q.eq("status", "needs_review"))
    .collect();

  return await Promise.all(
    items.map(async (item) => {
      const user = await ctx.db.get(item.userId);
      const profile =
        item.profileId
          ? await ctx.db.get(item.profileId)
          : await ctx.db
              .query("profiles")
              .withIndex("by_user", (q) => q.eq("userId", item.userId))
              .first();
      const shopSession = await ctx.db.get(item.shopSessionId);
      const minutes = item.signOutAt
        ? Math.max(0, Math.round((item.signOutAt - item.signInAt) / 60000))
        : 0;

      return {
        id: `attendance_review:${item._id}`,
        kind: "attendance_review" as const,
        title: "Attendance record needs review",
        summary: `${displayNameFor(profile, user)} has provisional shop time.`,
        detail: `${minutes} min${shopSession?.title ? ` in ${shopSession.title}` : ""}`,
        href: "/shop",
        createdAt: item.updatedAt,
      };
    }),
  );
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const profile = await currentProfile(ctx);

    if (!canReview(profile)) {
      return {
        unreadCount: 0,
        notifications: [],
      };
    }

    const notifications = (
      await Promise.all([
        lessonReviewNotifications(ctx),
        handsOnReviewNotifications(ctx),
        attendanceReviewNotifications(ctx),
      ])
    )
      .flat()
      .sort((a, b) => b.createdAt - a.createdAt);

    return {
      unreadCount: notifications.length,
      notifications: notifications.slice(0, 50),
    };
  },
});
