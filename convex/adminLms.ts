import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

async function currentProfile(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    return null;
  }

  return await ctx.db
    .query("profiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const profile = await currentProfile(ctx);

  if (profile?.role !== "admin") {
    throw new Error("Only admins can manage LMS progress.");
  }
}

async function requireReviewer(ctx: QueryCtx | MutationCtx) {
  const profile = await currentProfile(ctx);

  if (
    profile?.role !== "admin" &&
    profile?.role !== "mentor" &&
    profile?.role !== "instructor"
  ) {
    throw new Error("Only mentors and admins can review submissions.");
  }

  return profile;
}

function parseSubmissionResponse(response: string) {
  try {
    const parsed = JSON.parse(response) as {
      fileName?: unknown;
      storageId?: unknown;
    };

    if (typeof parsed.storageId === "string") {
      return {
        fileName: typeof parsed.fileName === "string" ? parsed.fileName : "Uploaded file",
        storageId: parsed.storageId as Id<"_storage">,
      };
    }
  } catch {
    // Older answers may be raw storage ids.
  }

  return {
    fileName: "Uploaded file",
    storageId: response as Id<"_storage">,
  };
}

async function collectTrackLessonIds(ctx: QueryCtx | MutationCtx, trackId: Id<"trainingTracks">) {
  const units = await ctx.db
    .query("units")
    .withIndex("by_track", (q) => q.eq("trackId", trackId))
    .collect();
  const lessons = (
    await Promise.all(
      units.map((unit) =>
        ctx.db
          .query("lessons")
          .withIndex("by_unit", (q) => q.eq("unitId", unit._id))
          .collect(),
      ),
    )
  ).flat();

  return lessons.map((lesson) => lesson._id);
}

async function hasCompletedTrack(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  trackId: Id<"trainingTracks">,
) {
  const lessonIds = await collectTrackLessonIds(ctx, trackId);

  if (lessonIds.length === 0) {
    return false;
  }

  const completed = await ctx.db
    .query("lessonProgress")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("status"), "completed"))
    .collect();
  const completedLessonIds = new Set(completed.map((item) => item.lessonId));

  return lessonIds.every((lessonId) => completedLessonIds.has(lessonId));
}

async function hasCompletedEquipment(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  equipmentId: Id<"equipment">,
) {
  const equipment = await ctx.db.get(equipmentId);

  if (!equipment) {
    return false;
  }

  const signOff = await ctx.db
    .query("equipmentSignOffs")
    .withIndex("by_user_equipment", (q) =>
      q.eq("userId", userId).eq("equipmentId", equipmentId),
    )
    .unique();

  return signOff?.status === "approved";
}

async function qualifiesForBadge(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  badge: {
    linkedTrackId?: Id<"trainingTracks">;
    linkedEquipmentId?: Id<"equipment">;
    requiredTrackIds?: Id<"trainingTracks">[];
    requiredEquipmentIds?: Id<"equipment">[];
  },
) {
  const requiredTrackIds = badge.requiredTrackIds ?? (badge.linkedTrackId ? [badge.linkedTrackId] : []);
  const requiredEquipmentIds =
    badge.requiredEquipmentIds ?? (badge.linkedEquipmentId ? [badge.linkedEquipmentId] : []);

  if (requiredTrackIds.length === 0 && requiredEquipmentIds.length === 0) {
    return false;
  }

  for (const trackId of requiredTrackIds) {
    if (!(await hasCompletedTrack(ctx, userId, trackId))) {
      return false;
    }
  }

  for (const equipmentId of requiredEquipmentIds) {
    if (!(await hasCompletedEquipment(ctx, userId, equipmentId))) {
      return false;
    }
  }

  return true;
}

async function revokeUnqualifiedAutomaticBadges(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const awards = await ctx.db
    .query("userBadges")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  let revokedCount = 0;

  for (const award of awards) {
    if (award.awardedBy !== undefined) {
      continue;
    }

    const badge = await ctx.db.get(award.badgeId);

    if (!badge || !badge.isActive || !(await qualifiesForBadge(ctx, userId, badge))) {
      await ctx.db.delete(award._id);
      revokedCount += 1;
    }
  }

  return revokedCount;
}

async function collectQuizIdsForTrack(ctx: QueryCtx | MutationCtx, trackId: Id<"trainingTracks">) {
  const units = await ctx.db
    .query("units")
    .withIndex("by_track", (q) => q.eq("trackId", trackId))
    .collect();
  const lessons = (
    await Promise.all(
      units.map((unit) =>
        ctx.db
          .query("lessons")
          .withIndex("by_unit", (q) => q.eq("unitId", unit._id))
          .collect(),
      ),
    )
  ).flat();
  const lessonQuizzes = (
    await Promise.all(
      lessons.map((lesson) =>
        ctx.db
          .query("quizzes")
          .withIndex("by_lesson", (q) => q.eq("linkedLessonId", lesson._id))
          .collect(),
      ),
    )
  ).flat();
  const unitQuizzes = (
    await Promise.all(
      units.map((unit) =>
        ctx.db
          .query("quizzes")
          .withIndex("by_unit", (q) => q.eq("linkedUnitId", unit._id))
          .collect(),
      ),
    )
  ).flat();

  return [...lessonQuizzes, ...unitQuizzes].map((quiz) => quiz._id);
}

async function deleteQuizAttemptsForUserQuiz(
  ctx: MutationCtx,
  userId: Id<"users">,
  quizId: Id<"quizzes">,
) {
  const attempts = await ctx.db
    .query("quizAttempts")
    .withIndex("by_user_quiz", (q) => q.eq("userId", userId).eq("quizId", quizId))
    .collect();

  for (const attempt of attempts) {
    await ctx.db.delete(attempt._id);
  }

  return attempts.length;
}

async function collectPublishedTrackOutlines(ctx: QueryCtx | MutationCtx) {
  const tracks = await ctx.db.query("trainingTracks").withIndex("by_order").collect();

  return await Promise.all(
    tracks
      .filter((track) => track.isPublished)
      .map(async (track) => {
        const units = await ctx.db
          .query("units")
          .withIndex("by_track_order", (q) => q.eq("trackId", track._id))
          .collect();
        const unitsWithLessons = await Promise.all(
          units.map(async (unit) => {
            const lessons = await ctx.db
              .query("lessons")
              .withIndex("by_unit_order", (q) => q.eq("unitId", unit._id))
              .collect();

            return { ...unit, lessons };
          }),
        );

        return {
          ...track,
          units: unitsWithLessons,
          lessons: unitsWithLessons.flatMap((unit) =>
            unit.lessons.map((lesson) => ({
              ...lesson,
              unitTitle: unit.title,
              unitRequired: unit.isRequired,
            })),
          ),
        };
      }),
  );
}

function recordKey(userId: Id<"users">, recordId: string) {
  return `${userId}:${recordId}`;
}

export const getUserProgressForAdmin = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!user) {
      throw new Error("User not found.");
    }

    const lessonProgress = await ctx.db
      .query("lessonProgress")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const lessonDetails = (
      await Promise.all(
        lessonProgress.map(async (progress) => {
          const lesson = await ctx.db.get(progress.lessonId);
          const unit = lesson ? await ctx.db.get(lesson.unitId) : null;
          const track = unit ? await ctx.db.get(unit.trackId) : null;

          if (!lesson || !unit || !track) {
            return null;
          }

          return {
            ...progress,
            lessonTitle: lesson.title,
            unitTitle: unit.title,
            trackId: track._id,
            trackTitle: track.title,
          };
        }),
      )
    )
      .filter((item) => item !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const tracks = await ctx.db.query("trainingTracks").withIndex("by_order").collect();
    const trackProgress = (
      await Promise.all(
        tracks.map(async (track) => {
          const lessonIds = await collectTrackLessonIds(ctx, track._id);
          const trackLessonIdSet = new Set(lessonIds);
          const progressItems = lessonProgress.filter((progress) =>
            trackLessonIdSet.has(progress.lessonId),
          );

          if (progressItems.length === 0) {
            return null;
          }

          const completedLessonCount = progressItems.filter(
            (progress) => progress.status === "completed",
          ).length;

          return {
            trackId: track._id,
            title: track.title,
            category: track.category,
            lessonCount: lessonIds.length,
            startedLessonCount: progressItems.length,
            completedLessonCount,
            isComplete: lessonIds.length > 0 && completedLessonCount === lessonIds.length,
          };
        }),
      )
    ).filter((item) => item !== null);

    const quizAttempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const quizAttemptDetails = (
      await Promise.all(
        quizAttempts.map(async (attempt) => {
          const quiz = await ctx.db.get(attempt.quizId);

          if (!quiz) {
            return null;
          }

          const lesson = quiz.linkedLessonId ? await ctx.db.get(quiz.linkedLessonId) : null;
          const lessonUnit = lesson ? await ctx.db.get(lesson.unitId) : null;
          const unit = quiz.linkedUnitId ? await ctx.db.get(quiz.linkedUnitId) : lessonUnit;
          const track = unit ? await ctx.db.get(unit.trackId) : null;
          const equipment = quiz.linkedEquipmentId
            ? await ctx.db.get(quiz.linkedEquipmentId)
            : null;

          return {
            ...attempt,
            quizTitle: quiz.title,
            contextTitle: equipment?.name ?? lesson?.title ?? unit?.title ?? track?.title,
            contextType: equipment
              ? "Equipment safety test"
              : lesson
                ? "Lesson test"
                : unit
                  ? "Unit test"
                  : "Test",
          };
        }),
      )
    )
      .filter((item) => item !== null)
      .sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt));

    const signOffs = await ctx.db
      .query("equipmentSignOffs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const signOffDetails = (
      await Promise.all(
        signOffs.map(async (signOff) => {
          const equipment = await ctx.db.get(signOff.equipmentId);

          if (!equipment) {
            return null;
          }

          return {
            ...signOff,
            equipmentName: equipment.name,
          };
        }),
      )
    )
      .filter((item) => item !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    return {
      user: {
        userId: args.userId,
        displayName: profile?.displayName ?? user.name,
        email: profile?.email ?? user.email,
        role: profile?.role ?? "student",
        studentGroup: profile?.studentGroup,
      },
      lessonProgress: lessonDetails,
      trackProgress,
      quizAttempts: quizAttemptDetails,
      equipmentSignOffs: signOffDetails,
    };
  },
});

export const listTeamLearningDashboard = query({
  args: {},
  handler: async (ctx) => {
    await requireReviewer(ctx);

    const students = await ctx.db
      .query("profiles")
      .withIndex("by_role_status", (q) => q.eq("role", "student").eq("status", "active"))
      .collect();
    const studentIds = new Set(students.map((student) => student.userId));
    const tracks = await collectPublishedTrackOutlines(ctx);
    const lessons = tracks.flatMap((track) => track.lessons);
    const lessonIds = new Set(lessons.map((lesson) => lesson._id));
    const lessonQuizzes = (
      await Promise.all(
        lessons.map(async (lesson) => {
          const quiz = await ctx.db
            .query("quizzes")
            .withIndex("by_lesson", (q) => q.eq("linkedLessonId", lesson._id))
            .first();

          if (!quiz) {
            return null;
          }

          const questions = await ctx.db
            .query("questions")
            .withIndex("by_quiz", (q) => q.eq("quizId", quiz._id))
            .collect();

          return {
            lessonId: lesson._id,
            quizId: quiz._id,
            questionCount: questions.length,
          };
        }),
      )
    ).filter((item) => item !== null);
    const quizByLesson = new Map(lessonQuizzes.map((item) => [item.lessonId, item]));
    const quizIds = new Set(lessonQuizzes.map((item) => item.quizId));
    const progress = (await ctx.db.query("lessonProgress").collect()).filter(
      (item) => studentIds.has(item.userId) && lessonIds.has(item.lessonId),
    );
    const completedLessonKeys = new Set(
      progress
        .filter((item) => item.status === "completed")
        .map((item) => recordKey(item.userId, item.lessonId)),
    );
    const startedLessonKeys = new Set(
      progress.map((item) => recordKey(item.userId, item.lessonId)),
    );
    const attempts = (await ctx.db.query("quizAttempts").collect()).filter(
      (attempt) => studentIds.has(attempt.userId) && quizIds.has(attempt.quizId),
    );
    const latestAttemptByUserQuiz = new Map<string, (typeof attempts)[number]>();

    for (const attempt of attempts) {
      const key = recordKey(attempt.userId, attempt.quizId);
      const existing = latestAttemptByUserQuiz.get(key);
      const attemptTime = attempt.completedAt ?? attempt.startedAt;
      const existingTime = existing ? existing.completedAt ?? existing.startedAt : 0;

      if (!existing || attemptTime > existingTime) {
        latestAttemptByUserQuiz.set(key, attempt);
      }
    }

    const submissions = (await ctx.db.query("exerciseSubmissions").collect()).filter(
      (submission) =>
        studentIds.has(submission.userId) &&
        submission.lessonId !== undefined &&
        lessonIds.has(submission.lessonId),
    );
    const latestSubmissionByUserLesson = new Map<string, (typeof submissions)[number]>();

    for (const submission of submissions) {
      if (!submission.lessonId) {
        continue;
      }

      const key = recordKey(submission.userId, submission.lessonId);
      const existing = latestSubmissionByUserLesson.get(key);

      if (!existing || submission.updatedAt > existing.updatedAt) {
        latestSubmissionByUserLesson.set(key, submission);
      }
    }

    const rows = await Promise.all(
      students.map(async (student) => {
        const user = await ctx.db.get(student.userId);
        const trackProgress = tracks.map((track) => {
          const requiredLessons = track.lessons.filter(
            (lesson) => lesson.unitRequired && lesson.required,
          );
          const completedRequired = requiredLessons.filter((lesson) =>
            completedLessonKeys.has(recordKey(student.userId, lesson._id)),
          );
          const startedLessons = track.lessons.filter((lesson) => {
            const key = recordKey(student.userId, lesson._id);
            const quiz = quizByLesson.get(lesson._id);
            const latestAttempt = quiz
              ? latestAttemptByUserQuiz.get(recordKey(student.userId, quiz.quizId))
              : null;
            const latestSubmission = latestSubmissionByUserLesson.get(key);

            return startedLessonKeys.has(key) || Boolean(latestAttempt || latestSubmission);
          });
          const latestSubmissions = track.lessons
            .map((lesson) =>
              latestSubmissionByUserLesson.get(recordKey(student.userId, lesson._id)),
            )
            .filter((submission) => submission !== undefined);
          const pendingReviews = latestSubmissions.filter(
            (submission) => submission.status === "submitted",
          ).length;
          const revisionsNeeded = latestSubmissions.filter(
            (submission) => submission.status === "needs_revision",
          ).length;
          const nextLesson = requiredLessons.find(
            (lesson) => !completedLessonKeys.has(recordKey(student.userId, lesson._id)),
          );
          const percent =
            requiredLessons.length === 0
              ? 100
              : Math.round((completedRequired.length / requiredLessons.length) * 100);
          const status =
            requiredLessons.length > 0 && completedRequired.length === requiredLessons.length
              ? "complete"
              : revisionsNeeded > 0
                ? "needs_revision"
                : pendingReviews > 0
                  ? "waiting_review"
                  : startedLessons.length > 0
                    ? "in_progress"
                    : "not_started";

          return {
            trackId: track._id,
            title: track.title,
            category: track.category,
            lessonCount: track.lessons.length,
            requiredLessonCount: requiredLessons.length,
            completedRequiredLessonCount: completedRequired.length,
            missingRequiredLessonCount: Math.max(
              0,
              requiredLessons.length - completedRequired.length,
            ),
            pendingReviewCount: pendingReviews,
            needsRevisionCount: revisionsNeeded,
            percent,
            status,
            nextLesson: nextLesson
              ? {
                  lessonId: nextLesson._id,
                  title: nextLesson.title,
                  unitTitle: nextLesson.unitTitle,
                  lessonType: nextLesson.lessonType,
                  hasQuestions: Boolean(quizByLesson.get(nextLesson._id)?.questionCount),
                }
              : null,
          };
        });
        const totals = trackProgress.reduce(
          (summary, track) => ({
            requiredLessons: summary.requiredLessons + track.requiredLessonCount,
            completedRequiredLessons:
              summary.completedRequiredLessons + track.completedRequiredLessonCount,
            missingRequiredLessons:
              summary.missingRequiredLessons + track.missingRequiredLessonCount,
            pendingReviews: summary.pendingReviews + track.pendingReviewCount,
            revisionsNeeded: summary.revisionsNeeded + track.needsRevisionCount,
            completeTracks: summary.completeTracks + (track.status === "complete" ? 1 : 0),
            activeTracks:
              summary.activeTracks +
              (track.status === "in_progress" ||
              track.status === "waiting_review" ||
              track.status === "needs_revision"
                ? 1
                : 0),
          }),
          {
            requiredLessons: 0,
            completedRequiredLessons: 0,
            missingRequiredLessons: 0,
            pendingReviews: 0,
            revisionsNeeded: 0,
            completeTracks: 0,
            activeTracks: 0,
          },
        );
        const priorityTrack =
          trackProgress.find((track) => track.needsRevisionCount > 0) ??
          trackProgress.find((track) => track.pendingReviewCount > 0) ??
          trackProgress.find((track) => track.nextLesson !== null) ??
          null;
        const percent =
          totals.requiredLessons === 0
            ? 100
            : Math.round((totals.completedRequiredLessons / totals.requiredLessons) * 100);
        const status =
          totals.requiredLessons > 0 && totals.completedRequiredLessons === totals.requiredLessons
            ? "complete"
            : totals.revisionsNeeded > 0
              ? "needs_revision"
              : totals.pendingReviews > 0
                ? "waiting_review"
                : totals.completedRequiredLessons > 0
                  ? "in_progress"
                  : "not_started";

        return {
          userId: student.userId,
          displayName: student.displayName ?? user?.name ?? user?.email ?? "Team member",
          email: student.email ?? user?.email,
          studentGroup: student.studentGroup,
          graduationYear: student.graduationYear,
          percent,
          status,
          totals,
          nextAction: priorityTrack
            ? {
                trackId: priorityTrack.trackId,
                trackTitle: priorityTrack.title,
                status: priorityTrack.status,
                pendingReviewCount: priorityTrack.pendingReviewCount,
                needsRevisionCount: priorityTrack.needsRevisionCount,
                nextLesson: priorityTrack.nextLesson,
              }
            : null,
          tracks: trackProgress,
        };
      }),
    );
    const summary = rows.reduce(
      (totals, row) => ({
        students: totals.students + 1,
        complete: totals.complete + (row.status === "complete" ? 1 : 0),
        inProgress:
          totals.inProgress +
          (row.status === "in_progress" ||
          row.status === "waiting_review" ||
          row.status === "needs_revision"
            ? 1
            : 0),
        notStarted: totals.notStarted + (row.status === "not_started" ? 1 : 0),
        pendingReviews: totals.pendingReviews + row.totals.pendingReviews,
        revisionsNeeded: totals.revisionsNeeded + row.totals.revisionsNeeded,
        missingRequiredLessons:
          totals.missingRequiredLessons + row.totals.missingRequiredLessons,
      }),
      {
        students: 0,
        complete: 0,
        inProgress: 0,
        notStarted: 0,
        pendingReviews: 0,
        revisionsNeeded: 0,
        missingRequiredLessons: 0,
      },
    );

    return {
      summary,
      tracks: tracks.map((track) => ({
        trackId: track._id,
        title: track.title,
        category: track.category,
        lessonCount: track.lessons.length,
        requiredLessonCount: track.lessons.filter(
          (lesson) => lesson.unitRequired && lesson.required,
        ).length,
      })),
      students: rows.sort((first, second) => {
        const statusPriority: Record<string, number> = {
          needs_revision: 0,
          waiting_review: 1,
          in_progress: 2,
          not_started: 3,
          complete: 4,
        };

        return (
          statusPriority[first.status] - statusPriority[second.status] ||
          first.percent - second.percent ||
          first.displayName.localeCompare(second.displayName)
        );
      }),
    };
  },
});

export const listReviewQueue = query({
  args: {},
  handler: async (ctx) => {
    await requireReviewer(ctx);

    const submittedFiles = await ctx.db
      .query("exerciseSubmissions")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .collect();
    const lessonSubmissions = (
      await Promise.all(
        submittedFiles.map(async (submission) => {
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
          const file = parseSubmissionResponse(submission.response);

          return {
            ...submission,
            fileName: file.fileName,
            fileUrl: await ctx.storage.getUrl(file.storageId),
            lessonTitle: lesson.title,
            trackTitle: track?.title,
            studentName: profile?.displayName ?? user.name ?? user.email ?? "Unknown student",
            studentEmail: profile?.email ?? user.email,
          };
        }),
      )
    )
      .filter((item) => item !== null)
      .sort((a, b) => b.createdAt - a.createdAt);

    const equipment = await ctx.db.query("equipment").withIndex("by_active").collect();
    const handsOnReviews = (
      await Promise.all(
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
                  equipmentId: item._id,
                  equipmentName: item.name,
                  signOffId: signOff?._id,
                  status: signOff?.status ?? "requested",
                  studentUserId: attempt.userId,
                  studentName:
                    profile?.displayName ?? user.name ?? user.email ?? "Unknown student",
                  studentEmail: profile?.email ?? user.email,
                  passedAt: attempt.completedAt ?? attempt.startedAt,
                  scorePercent: attempt.scorePercent,
                };
              }),
            );
          }),
      )
    )
      .flat()
      .filter((item) => item !== null)
      .sort((a, b) => b.passedAt - a.passedAt);

    return {
      lessonSubmissions,
      handsOnReviews,
    };
  },
});

export const reviewLessonSubmission = mutation({
  args: {
    submissionId: v.id("exerciseSubmissions"),
    approved: v.boolean(),
  },
  handler: async (ctx, args) => {
    const reviewer = await requireReviewer(ctx);
    const submission = await ctx.db.get(args.submissionId);

    if (!submission) {
      throw new Error("Submission not found.");
    }

    const now = Date.now();
    await ctx.db.patch(args.submissionId, {
      status: args.approved ? "approved" : "needs_revision",
      reviewedBy: reviewer.userId,
      reviewedAt: now,
      updatedAt: now,
    });

    if (args.approved && submission.lessonId) {
      const existingProgress = await ctx.db
        .query("lessonProgress")
        .withIndex("by_user_lesson", (q) =>
          q.eq("userId", submission.userId).eq("lessonId", submission.lessonId!),
        )
        .unique();

      if (existingProgress) {
        await ctx.db.patch(existingProgress._id, {
          status: "completed",
          completedAt: now,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert("lessonProgress", {
          userId: submission.userId,
          lessonId: submission.lessonId,
          status: "completed",
          startedAt: submission.createdAt,
          completedAt: now,
          updatedAt: now,
        });
      }
    }

    return args.submissionId;
  },
});

export const reviewHandsOnVerification = mutation({
  args: {
    equipmentId: v.id("equipment"),
    userId: v.id("users"),
    approved: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const reviewer = await requireReviewer(ctx);
    const equipment = await ctx.db.get(args.equipmentId);

    if (!equipment) {
      throw new Error("Equipment not found.");
    }

    const now = Date.now();
    const notes = args.notes?.trim();
    const existing = await ctx.db
      .query("equipmentSignOffs")
      .withIndex("by_user_equipment", (q) =>
        q.eq("userId", args.userId).eq("equipmentId", args.equipmentId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.approved ? "approved" : "rejected",
        approvedAt: args.approved ? now : undefined,
        approvedBy: args.approved ? reviewer.userId : undefined,
        notes: notes || undefined,
        updatedAt: now,
      });

      await ctx.db.insert("approvalEvents", {
        signOffId: existing._id,
        actorUserId: reviewer.userId,
        action: args.approved ? "approved" : "rejected",
        note: notes || (args.approved ? "Hands-on demonstration complete." : "Hands-on demonstration needs more practice."),
        createdAt: now,
      });

      return existing._id;
    }

    const signOffId = await ctx.db.insert("equipmentSignOffs", {
      equipmentId: args.equipmentId,
      userId: args.userId,
      status: args.approved ? "approved" : "rejected",
      requestedAt: now,
      approvedAt: args.approved ? now : undefined,
      approvedBy: args.approved ? reviewer.userId : undefined,
      notes: notes || undefined,
      updatedAt: now,
    });

    await ctx.db.insert("approvalEvents", {
      signOffId,
      actorUserId: reviewer.userId,
      action: args.approved ? "approved" : "rejected",
      note: notes || (args.approved ? "Hands-on demonstration complete." : "Hands-on demonstration needs more practice."),
      createdAt: now,
    });

    return signOffId;
  },
});

export const removeLessonProgressForAdmin = mutation({
  args: {
    progressId: v.id("lessonProgress"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const progress = await ctx.db.get(args.progressId);

    if (!progress) {
      return args.progressId;
    }

    await ctx.db.delete(args.progressId);
    await revokeUnqualifiedAutomaticBadges(ctx, progress.userId);

    return args.progressId;
  },
});

export const resetTrackProgressForAdmin = mutation({
  args: {
    userId: v.id("users"),
    trackId: v.id("trainingTracks"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const lessonIds = await collectTrackLessonIds(ctx, args.trackId);
    const quizIds = await collectQuizIdsForTrack(ctx, args.trackId);
    let removedCount = 0;

    for (const lessonId of lessonIds) {
      const progress = await ctx.db
        .query("lessonProgress")
        .withIndex("by_user_lesson", (q) =>
          q.eq("userId", args.userId).eq("lessonId", lessonId),
        )
        .unique();

      if (progress) {
        await ctx.db.delete(progress._id);
        removedCount += 1;
      }
    }

    for (const quizId of quizIds) {
      removedCount += await deleteQuizAttemptsForUserQuiz(ctx, args.userId, quizId);
    }

    await revokeUnqualifiedAutomaticBadges(ctx, args.userId);

    return removedCount;
  },
});

export const removeQuizAttemptForAdmin = mutation({
  args: {
    attemptId: v.id("quizAttempts"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const attempt = await ctx.db.get(args.attemptId);

    if (!attempt) {
      return args.attemptId;
    }

    await ctx.db.delete(args.attemptId);
    await revokeUnqualifiedAutomaticBadges(ctx, attempt.userId);

    return args.attemptId;
  },
});

export const removeEquipmentSignOffForAdmin = mutation({
  args: {
    signOffId: v.id("equipmentSignOffs"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const signOff = await ctx.db.get(args.signOffId);

    if (!signOff) {
      return args.signOffId;
    }

    await ctx.db.delete(args.signOffId);
    await revokeUnqualifiedAutomaticBadges(ctx, signOff.userId);

    return args.signOffId;
  },
});
