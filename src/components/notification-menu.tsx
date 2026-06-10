import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { Bell, ClipboardCheck, Clock, Wrench } from "lucide-react";
import { Link } from "react-router";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";

type NotificationKind = "lesson_review" | "hands_on_review" | "attendance_review";

const kindIcons: Record<NotificationKind, LucideIcon> = {
  lesson_review: ClipboardCheck,
  hands_on_review: Wrench,
  attendance_review: Clock,
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
          className="relative size-10 rounded-full"
          aria-label={`Open notifications${hasUnread ? `, ${countLabel(unreadCount)} unread` : ""}`}
        >
          <Bell className={cn("size-5", hasUnread && "fill-current")} />
          {hasUnread && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-5 text-white shadow-sm ring-2 ring-background">
              {countLabel(unreadCount)}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {hasUnread && (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-white">
              {countLabel(unreadCount)}
            </span>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        <div className="max-h-[28rem] overflow-y-auto p-1">
          {feed === undefined && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              Loading notifications...
            </div>
          )}
          {feed !== undefined && notifications.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing needs review right now.
            </div>
          )}
          {notifications.map((notification) => {
            const Icon = kindIcons[notification.kind];

            return (
              <DropdownMenuItem key={notification.id} asChild className="cursor-pointer p-0">
                <Link to={notification.href} className="flex items-start gap-3 rounded-sm px-3 py-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                    <Icon className="size-4" />
                  </span>
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
        {notifications.length > 0 && (
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
