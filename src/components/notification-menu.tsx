import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { Bell, ClipboardCheck, Clock, LogOut, MessageSquare, UserCheck, Wrench } from "lucide-react";
import { Link } from "react-router";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@convex/_generated/api";

type NotificationKind =
  | "lesson_review"
  | "hands_on_review"
  | "attendance_review"
  | "my_attendance_review"
  | "skill_signoff"
  | "my_skill_feedback";

const kindIcons: Record<NotificationKind, LucideIcon> = {
  lesson_review: ClipboardCheck,
  hands_on_review: Wrench,
  attendance_review: Clock,
  my_attendance_review: LogOut,
  skill_signoff: UserCheck,
  my_skill_feedback: MessageSquare,
};

function countLabel(count: number) {
  return count > 100 ? "100+" : String(count);
}

function relativeTime(timestamp: number) {
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);

  return `${diffDays}d ago`;
}

export function NotificationMenu() {
  const { isAuthenticated } = useConvexAuth();
  const feed = useQuery(api.notifications.listMine, isAuthenticated ? {} : "skip");
  const unreadCount = feed?.unreadCount ?? 0;
  const notifications = feed?.notifications ?? [];
  const hasUnread = unreadCount > 0;

  if (!isAuthenticated) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Open notifications${hasUnread ? `, ${countLabel(unreadCount)} unread` : ""}`}
        >
          <Bell className="size-4" />
          {hasUnread && (
            <span key={unreadCount} className="absolute -right-0.5 -top-0.5 flex min-w-5 animate-pop items-center justify-center rounded-full bg-cta px-1.5 text-[11px] font-semibold leading-5 text-cta-foreground tabular-nums ring-2 ring-card">
              {countLabel(unreadCount)}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-[28rem] overflow-y-auto p-1">
          {feed === undefined && <ListSkeleton rows={3} className="p-2" label="Loading notifications" />}
          {feed !== undefined && notifications.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              You're all caught up.
            </div>
          )}
          {notifications.map((notification) => {
            const Icon = kindIcons[notification.kind];

            return (
              <DropdownMenuItem key={notification.id} asChild className="cursor-pointer p-0">
                <Link to={notification.href} className="flex items-start gap-3 rounded-md px-3 py-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-5">
                      {notification.title}
                    </span>
                    <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                      {notification.summary}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{notification.detail}</span>
                      <span>{relativeTime(notification.createdAt)}</span>
                    </span>
                  </span>
                </Link>
              </DropdownMenuItem>
            );
          })}
        </div>
        {feed?.canReview && notifications.length > 0 && (
          <>
            <DropdownMenuSeparator className="m-0" />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link to="/management/reviews" className="justify-center font-medium">
                Open review queue
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
