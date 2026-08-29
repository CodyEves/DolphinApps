import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useAction, useMutation, useQuery } from "convex/react";
import QRCode from "qrcode";
import {
  ArrowLeftRight,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Camera,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  KeyRound,
  Link as LinkIcon,
  Loader2,
  LockKeyhole,
  LogOut,
  Maximize2,
  Monitor,
  PictureInPicture,
  Plus,
  QrCode,
  ShieldCheck,
  Save,
  Square,
  Trash2,
  TimerReset,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { canManageAttendanceEvents } from "@/lib/role-access";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type AttendanceStatus = "open" | "complete" | "needs_review" | "void";
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};
type CanvasWithCaptureStream = HTMLCanvasElement & {
  captureStream?: (frameRate?: number) => MediaStream;
};
type CanvasCaptureTrack = MediaStreamTrack & {
  requestFrame?: () => void;
};
type PictureInPictureVideo = HTMLVideoElement & {
  requestPictureInPicture?: () => Promise<unknown>;
};
type ShopScheduleEntry = {
  dayOfWeek: number;
  isActive: boolean;
  startMinutes: number;
};

const SHOP_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function defaultWeeklySchedule(): ShopScheduleEntry[] {
  return SHOP_DAYS.map((_, dayOfWeek) => ({
    dayOfWeek,
    isActive: false,
    startMinutes: 15 * 60,
  }));
}

function formatTime(value?: number) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "-";
}

function formatDateTime(value?: number) {
  return value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "-";
}

function formatHours(minutes: number) {
  const hours = minutes / 60;

  return `${hours.toFixed(2)} hr`;
}

function formatLiveDuration(startedAt: number, now: number) {
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function minutesBetween(start: number, end?: number) {
  return end ? Math.max(0, Math.round((end - start) / 60000)) : 0;
}

function toDateTimeLocal(value?: number) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  return new Date(value).getTime();
}

function minutesToTimeInput(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function timeInputToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");

  return Number(hours) * 60 + Number(minutes);
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value.trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomShopCode() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);

  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

function normalizeAttendanceCode(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function shopCodeLink(code: string) {
  return `${window.location.origin}/shop?code=${encodeURIComponent(code)}`;
}

function parseScannedShopCode(value: string) {
  const trimmed = value.trim();

  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("code");

    if (code) {
      return code.trim().toUpperCase();
    }
  } catch {
    // Plain QR payloads are also valid.
  }

  return trimmed.toUpperCase();
}

function barcodeDetector() {
  if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
    return null;
  }

  return (window as Window & { BarcodeDetector: BarcodeDetectorConstructor }).BarcodeDetector;
}

function supportsPictureInPicture() {
  return (
    typeof document !== "undefined" &&
    "pictureInPictureEnabled" in document &&
    document.pictureInPictureEnabled &&
    typeof HTMLCanvasElement !== "undefined" &&
    "captureStream" in HTMLCanvasElement.prototype
  );
}

function shopNavActive(pathname: string, href: string) {
  return href === "/shop" ? pathname === href : pathname.startsWith(href);
}

function ShopSectionNav({
  pathname,
  canManage,
  canDisplayRole,
  reviewCount,
}: {
  pathname: string;
  canManage: boolean;
  canDisplayRole: boolean;
  reviewCount: number;
}) {
  const items: Array<{
    href: string;
    label: string;
    icon: LucideIcon;
    badge?: number;
  }> = [
    { href: "/shop", label: "Overview", icon: Clock },
    ...(canDisplayRole ? [{ href: "/shop/display", label: "Display", icon: Monitor }] : []),
    ...(canManage
      ? [
          { href: "/shop/records", label: "Records", icon: ClipboardList },
          { href: "/shop/review", label: "Review", icon: ShieldCheck, badge: reviewCount },
          { href: "/shop/reports", label: "Reports", icon: Download },
        ]
      : []),
  ];

  return (
    <nav
      className="mb-5 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
      aria-label="Shop Attendance navigation"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = shopNavActive(pathname, item.href);

        return (
          <Button
            key={item.href}
            asChild
            variant={isActive ? "secondary" : "outline"}
            className={cn(
              "h-10 shrink-0 justify-start gap-2",
              isActive && "border-primary/20 bg-primary/10 text-primary hover:bg-primary/15",
            )}
          >
            <Link to={item.href}>
              <Icon className="size-4" />
              <span>{item.label}</span>
              {item.badge ? (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[11px]">
                  {item.badge}
                </Badge>
              ) : null}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}

function EventDateTimeField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [datePart = "", timePart = ""] = value.split("T");

  function updateDate(nextDate: string) {
    onChange(nextDate ? `${nextDate}T${timePart || "09:00"}` : "");
  }

  function updateTime(nextTime: string) {
    const fallbackDate = toDateTimeLocal(Date.now()).slice(0, 10);

    onChange(nextTime ? `${datePart || fallbackDate}T${nextTime}` : datePart ? `${datePart}T00:00` : "");
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          id={`${id}Date`}
          type="date"
          value={datePart}
          onChange={(event) => updateDate(event.target.value)}
          aria-label={`${label} date`}
        />
        <Input
          id={`${id}Time`}
          type="time"
          value={timePart}
          onChange={(event) => updateTime(event.target.value)}
          aria-label={`${label} time`}
        />
      </div>
    </div>
  );
}

function downloadCsv(fileName: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${cell.replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function ReviewRecord({
  record,
  onReview,
  isBusy,
}: {
  record: {
    _id: Id<"attendanceSessions">;
    studentName: string;
    status: AttendanceStatus;
    signInAt: number;
    signOutAt?: number;
    reviewNote?: string;
  };
  isBusy: boolean;
  onReview: (args: {
    attendanceSessionId: Id<"attendanceSessions">;
    status: AttendanceStatus;
    signInAt?: number;
    signOutAt?: number;
    note?: string;
  }) => void;
}) {
  const [signInAt, setSignInAt] = useState(toDateTimeLocal(record.signInAt));
  const [signOutAt, setSignOutAt] = useState(toDateTimeLocal(record.signOutAt));
  const [note, setNote] = useState(record.reviewNote ?? "");

  return (
    <div className="grid gap-3 rounded-md border bg-card p-4 lg:grid-cols-[1fr_180px_180px_1.2fr_auto] lg:items-end">
      <div className="min-w-0">
        <p className="truncate font-medium">{record.studentName}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">Needs review</Badge>
          <span>{formatHours(minutesBetween(record.signInAt, record.signOutAt))}</span>
        </div>
      </div>
      <div className="space-y-2">
        <Label>In</Label>
        <Input type="datetime-local" value={signInAt} onChange={(event) => setSignInAt(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Out</Label>
        <Input type="datetime-local" value={signOutAt} onChange={(event) => setSignOutAt(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Note</Label>
        <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Correction note" />
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Button
          type="button"
          size="sm"
          disabled={isBusy || !signInAt || !signOutAt}
          onClick={() =>
            onReview({
              attendanceSessionId: record._id,
              status: "complete",
              signInAt: fromDateTimeLocal(signInAt),
              signOutAt: fromDateTimeLocal(signOutAt),
              note,
            })
          }
        >
          <Check className="size-4" />
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() =>
            onReview({
              attendanceSessionId: record._id,
              status: "void",
              note,
            })
          }
        >
          <X className="size-4" />
          Void
        </Button>
      </div>
    </div>
  );
}

function EditableAttendanceRecord({
  record,
  onSave,
  onDelete,
  isBusy,
}: {
  record: {
    _id: Id<"attendanceSessions">;
    studentName: string;
    status: AttendanceStatus;
    source: string;
    signInAt: number;
    signOutAt?: number;
    reviewNote?: string;
    shopTitle?: string;
  };
  isBusy: boolean;
  onSave: (args: {
    attendanceSessionId: Id<"attendanceSessions">;
    status: AttendanceStatus;
    signInAt?: number;
    signOutAt?: number;
    note?: string;
  }) => void;
  onDelete: (attendanceSessionId: Id<"attendanceSessions">) => void;
}) {
  const [status, setStatus] = useState<AttendanceStatus>(record.status);
  const [signInAt, setSignInAt] = useState(toDateTimeLocal(record.signInAt));
  const [signOutAt, setSignOutAt] = useState(toDateTimeLocal(record.signOutAt));
  const [note, setNote] = useState(record.reviewNote ?? "");
  const needsOutTime = status === "complete" || status === "needs_review";

  return (
    <div className="grid gap-3 rounded-md border bg-card p-4 xl:grid-cols-[minmax(180px,1fr)_150px_190px_190px_minmax(180px,1fr)_auto] xl:items-end">
      <div className="min-w-0">
        <p className="truncate font-medium">{record.studentName}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant={record.status === "needs_review" ? "secondary" : "outline"}>
            {record.status.replace("_", " ")}
          </Badge>
          <span>{record.source}</span>
          <span>{formatHours(minutesBetween(record.signInAt, record.signOutAt))}</span>
        </div>
        {record.shopTitle && (
          <p className="mt-1 truncate text-xs text-muted-foreground">{record.shopTitle}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={(value) => setStatus(value as AttendanceStatus)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="needs_review">Needs review</SelectItem>
            <SelectItem value="void">Void</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>In</Label>
        <Input type="datetime-local" value={signInAt} onChange={(event) => setSignInAt(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Out</Label>
        <Input type="datetime-local" value={signOutAt} onChange={(event) => setSignOutAt(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Note</Label>
        <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Correction note" />
      </div>
      <div className="flex flex-wrap gap-2 xl:justify-end">
        <Button
          type="button"
          size="sm"
          disabled={isBusy || !signInAt || (needsOutTime && !signOutAt)}
          onClick={() =>
            onSave({
              attendanceSessionId: record._id,
              status,
              signInAt: fromDateTimeLocal(signInAt),
              signOutAt: signOutAt ? fromDateTimeLocal(signOutAt) : undefined,
              note,
            })
          }
        >
          {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isBusy}
          onClick={() => onDelete(record._id)}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
      </div>
    </div>
  );
}

export function ShopAttendancePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { studentUserId: studentUserIdParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const canManage =
    effectiveRole === "admin" || effectiveRole === "mentor" || effectiveRole === "instructor";
  const canManageEvents = canManageAttendanceEvents(effectiveRole);
  const canDisplayRole = canManage || effectiveRole === "kiosk";
  const canUseStudentCheckIn = effectiveRole !== "kiosk";
  const managementTabCount =
    (canDisplayRole ? 1 : 0) + (canManage ? 3 : 0) + (canManageEvents ? 1 : 0);
  const hasAnyManagementTab = managementTabCount > 0;
  const hasMultipleShopTabs = hasAnyManagementTab && managementTabCount > 1;
  const showRecordsRoute = location.pathname.startsWith("/shop/records");
  const showReviewRoute = location.pathname.startsWith("/shop/review");
  const showReportsRoute = location.pathname.startsWith("/shop/reports");
  const showStudentRosterRoute = showRecordsRoute || showReviewRoute || showReportsRoute;
  const selectedStudentUserId = studentUserIdParam as Id<"users"> | undefined;
  const current = useQuery(api.shopAttendance.currentShopSession, isAuthenticated ? {} : "skip");
  const displayStats = useQuery(
    api.shopAttendance.shopDisplayStats,
    isAuthenticated && canDisplayRole ? {} : "skip",
  );
  const myAttendance = useQuery(
    api.shopAttendance.myCurrentAttendance,
    isAuthenticated && canUseStudentCheckIn ? {} : "skip",
  );
  const liveAttendance = useQuery(
    api.shopAttendance.listCurrentAttendance,
    isAuthenticated && canManage ? {} : "skip",
  );
  const reviewQueue = useQuery(
    api.shopAttendance.listReviewQueue,
    isAuthenticated && canManage ? {} : "skip",
  );
  const people = useQuery(
    api.shopAttendance.listPeopleForManualAttendance,
    isAuthenticated && canManage ? {} : "skip",
  );
  const scheduleSettings = useQuery(
    api.shopAttendance.getShopScheduleSettings,
    isAuthenticated && canManage ? {} : "skip",
  );
  const attendanceEvents = useQuery(
    api.shopAttendance.listAttendanceEvents,
    isAuthenticated && canManageEvents ? { includeClosed: true } : "skip",
  );
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [isStudentSearchOpen, setIsStudentSearchOpen] = useState(false);
  const [recordFromDate, setRecordFromDate] = useState("");
  const [recordToDate, setRecordToDate] = useState("");
  const [studentTableSearch, setStudentTableSearch] = useState("");
  const [maxHoursFilter, setMaxHoursFilter] = useState("");
  const [studentTableSortBy, setStudentTableSortBy] = useState<
    "name" | "hours" | "needsReview" | "events" | "lastAttendance"
  >("name");
  const [studentTableSortDir, setStudentTableSortDir] = useState<"asc" | "desc">("asc");
  const [studentTablePageIndex, setStudentTablePageIndex] = useState(0);
  const [studentTablePageSize, setStudentTablePageSize] = useState("25");
  const report = useQuery(
    api.shopAttendance.listHoursReport,
    isAuthenticated && canManage && (!showReportsRoute || !!selectedStudentUserId)
      ? {
          userId: showReportsRoute ? selectedStudentUserId : undefined,
          from: fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : undefined,
          to: toDate ? new Date(`${toDate}T23:59:59`).getTime() : undefined,
        }
      : "skip",
  );
  const studentEventAttendance = useQuery(
    api.shopAttendance.listStudentEventAttendance,
    isAuthenticated && canManage && showReportsRoute && selectedStudentUserId
      ? { userId: selectedStudentUserId }
      : "skip",
  );
  const overviewReport = useQuery(
    api.shopAttendance.attendanceOverviewReport,
    isAuthenticated && canManage
      ? {
          from: fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : undefined,
          to: toDate ? new Date(`${toDate}T23:59:59`).getTime() : undefined,
        }
      : "skip",
  );
  const recordPeople = useQuery(
    api.shopAttendance.listAttendanceRecordPeople,
    isAuthenticated && canManage && showStudentRosterRoute ? {} : "skip",
  );
  const recordRows = useQuery(
    api.shopAttendance.listAttendanceRecords,
    isAuthenticated && canManage && showRecordsRoute && selectedStudentUserId
      ? {
          userId: selectedStudentUserId,
          from: recordFromDate ? new Date(`${recordFromDate}T00:00:00`).getTime() : undefined,
          to: recordToDate ? new Date(`${recordToDate}T23:59:59`).getTime() : undefined,
        }
      : "skip",
  );
  const startShopSession = useMutation(api.shopAttendance.startShopSession);
  const startShopSessionFromDisplay = useMutation(api.shopAttendance.startShopSessionFromDisplay);
  const endShopSession = useMutation(api.shopAttendance.endShopSession);
  const generateCode = useMutation(api.shopAttendance.generateOrReadCurrentCode);
  const submitAttendanceCode = useMutation(api.shopAttendance.useAttendanceCode);
  const signOutOfShop = useMutation(api.shopAttendance.signOutOfShop);
  const reviewAttendance = useMutation(api.shopAttendance.reviewAttendanceSession);
  const deleteAttendance = useMutation(api.shopAttendance.deleteAttendanceSession);
  const createManualAttendance = useMutation(api.shopAttendance.createManualAttendanceSession);
  const adminSignInPerson = useMutation(api.shopAttendance.adminSignInPerson);
  const adminSignOutPerson = useMutation(api.shopAttendance.adminSignOutPerson);
  const updateScheduleSettings = useMutation(api.shopAttendance.updateShopScheduleSettings);
  const createAttendanceEvent = useMutation(api.shopAttendance.createAttendanceEvent);
  const updateAttendanceEvent = useMutation(api.shopAttendance.updateAttendanceEvent);
  const setAttendanceEventCode = useMutation(api.shopAttendance.setAttendanceEventCode);
  const deleteEventAttendanceRecord = useMutation(api.shopAttendance.deleteEventAttendanceRecord);
  const adminCheckInToEvent = useMutation(api.shopAttendance.adminCheckInToEvent);
  const notifyClosed = useAction(api.shopSlack.notifyShopSessionClosed);
  const [shopTitle, setShopTitle] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [displayCode, setDisplayCode] = useState("");
  const [displayCodeExpiresAt, setDisplayCodeExpiresAt] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [busyRecordId, setBusyRecordId] = useState<string | null>(null);
  const [manualUserId, setManualUserId] = useState("");
  const [liveSignInUserId, setLiveSignInUserId] = useState("");
  const [liveSignInSearch, setLiveSignInSearch] = useState("");
  const [isLiveSignInSearchOpen, setIsLiveSignInSearchOpen] = useState(false);
  const [isLiveSignInBusy, setIsLiveSignInBusy] = useState(false);
  const [manualIn, setManualIn] = useState("");
  const [manualOut, setManualOut] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [scheduleEnabledDraft, setScheduleEnabledDraft] = useState<boolean | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<ShopScheduleEntry[] | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventEndsAt, setEventEndsAt] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventCodeDraft, setEventCodeDraft] = useState(randomShopCode());
  const [selectedEventCodeDraft, setSelectedEventCodeDraft] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<Id<"attendanceEvents"> | "">("");
  const [isEventBusy, setIsEventBusy] = useState(false);
  const [eventCheckInUserId, setEventCheckInUserId] = useState("");
  const [eventCheckInSearch, setEventCheckInSearch] = useState("");
  const [isEventCheckInSearchOpen, setIsEventCheckInSearchOpen] = useState(false);
  const [isEventCheckInBusy, setIsEventCheckInBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [attendanceCode, setAttendanceCode] = useState(
    searchParams.get("code")?.trim().toUpperCase() ?? "",
  );
  const selectedEventAttendance = useQuery(
    api.shopAttendance.listEventAttendance,
    isAuthenticated && canManageEvents && selectedEventId ? { eventId: selectedEventId } : "skip",
  );
  const eventCheckInPeople = useQuery(
    api.shopAttendance.listPeopleForEventCheckIn,
    isAuthenticated && canManageEvents && selectedEventId ? {} : "skip",
  );
  const [isAttendanceBusy, setIsAttendanceBusy] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [canUsePictureInPicture] = useState(() => supportsPictureInPicture());
  const [isPipActive, setIsPipActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const pipCanvasRef = useRef<CanvasWithCaptureStream | null>(null);
  const pipVideoRef = useRef<PictureInPictureVideo | null>(null);
  const pipStreamRef = useRef<MediaStream | null>(null);
  const pipQrImageRef = useRef<HTMLImageElement | null>(null);
  const pipQrSrcRef = useRef("");
  const pipIntervalRef = useRef<number | null>(null);
  const pipFrameDataRef = useRef({ code: "", secondsRemaining: 0, hasSession: false });
  const activeDisplayCode = current?.session ? displayCode : "";
  const activeQrDataUrl = current?.session ? qrDataUrl : "";
  const codeSecondsRemaining = Math.max(0, Math.ceil((displayCodeExpiresAt - now) / 1000));
  const showDisplayRoute = location.pathname.endsWith("/display") && canDisplayRole;
  const displayCurrentCount = displayStats?.currentCount ?? current?.openCount ?? 0;
  const displayPeakToday = displayStats?.peakToday ?? displayCurrentCount;
  const scheduleForm = scheduleDraft ?? scheduleSettings?.schedule ?? defaultWeeklySchedule();
  const scheduleEnabled = scheduleEnabledDraft ?? scheduleSettings?.isEnabled ?? false;
  const scheduleHasChanges = scheduleDraft !== null || scheduleEnabledDraft !== null;
  pipFrameDataRef.current = {
    code: activeDisplayCode,
    secondsRemaining: codeSecondsRemaining,
    hasSession: !!current?.session,
  };

  async function refreshCode() {
    if (!current?.session || !current.canDisplay) {
      return;
    }

    setIsGeneratingCode(true);
    const code = randomShopCode();
    const expiresAt = Date.now() + 75 * 1000;

    try {
      await generateCode({
        codeHash: await sha256Hex(code),
        expiresAt,
      });
      setDisplayCode(code);
      setDisplayCodeExpiresAt(expiresAt);
      setQrDataUrl(await QRCode.toDataURL(shopCodeLink(code), { margin: 2, width: 256 }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate shop code");
    } finally {
      setIsGeneratingCode(false);
    }
  }

  useEffect(() => {
    if (!current?.session || !current.canDisplay) {
      return;
    }

    let isCancelled = false;
    const generateDisplayCode = async () => {
      setIsGeneratingCode(true);
      const code = randomShopCode();
      const expiresAt = Date.now() + 75 * 1000;

      try {
        await generateCode({
          codeHash: await sha256Hex(code),
          expiresAt,
        });

        if (!isCancelled) {
          setDisplayCode(code);
          setDisplayCodeExpiresAt(expiresAt);
          setQrDataUrl(await QRCode.toDataURL(shopCodeLink(code), { margin: 2, width: 256 }));
        }
      } catch (error) {
        if (!isCancelled) {
          toast.error(error instanceof Error ? error.message : "Could not generate shop code");
        }
      } finally {
        if (!isCancelled) {
          setIsGeneratingCode(false);
        }
      }
    };
    const timeout = window.setTimeout(() => void generateDisplayCode(), 0);
    const interval = window.setInterval(() => void generateDisplayCode(), 60 * 1000);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
    // Only restart the rotation timer when the active session or display
    // permission changes, not on every reactive update of `current` (e.g.
    // every sign-in/out), which previously forced a new code on every use.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.session?._id, current?.canDisplay, generateCode]);

  useEffect(() => {
    if (!isScanning) {
      return;
    }

    let isCancelled = false;
    let animationId = 0;

    async function startScanner() {
      const Detector = barcodeDetector();

      if (!Detector || !navigator.mediaDevices?.getUserMedia) {
        toast.error("Camera QR scanning is not supported in this browser.");
        window.setTimeout(() => setIsScanning(false), 0);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        const detector = new Detector({ formats: ["qr_code"] });
        scanStreamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const scanFrame = async () => {
          if (isCancelled || !videoRef.current) {
            return;
          }

          try {
            const results = await detector.detect(videoRef.current);
            const rawValue = results[0]?.rawValue;

            if (rawValue) {
              setAttendanceCode(parseScannedShopCode(rawValue));
              setIsScanning(false);
              toast.success("Shop code scanned");
              return;
            }
          } catch {
            // Keep scanning; some frames are not readable.
          }

          animationId = window.requestAnimationFrame(() => void scanFrame());
        };

        animationId = window.requestAnimationFrame(() => void scanFrame());
      } catch (error) {
        if (!isCancelled) {
          toast.error(error instanceof Error ? error.message : "Could not start the camera.");
          setIsScanning(false);
        }
      }
    }

    void startScanner();

    return () => {
      isCancelled = true;
      window.cancelAnimationFrame(animationId);
      scanStreamRef.current?.getTracks().forEach((track) => track.stop());
      scanStreamRef.current = null;
    };
  }, [isScanning]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeQrDataUrl) {
      pipQrImageRef.current = null;
      pipQrSrcRef.current = "";
      return;
    }

    if (pipQrSrcRef.current === activeQrDataUrl) {
      return;
    }

    const image = new Image();
    pipQrSrcRef.current = activeQrDataUrl;
    image.onload = () => {
      pipQrImageRef.current = image;
    };
    image.onerror = () => {
      pipQrImageRef.current = null;
    };
    image.src = activeQrDataUrl;
  }, [activeQrDataUrl]);

  useEffect(() => {
    return () => {
      stopPictureInPictureStream();
    };
  }, []);

  async function handleStartSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await startShopSession({ title: shopTitle.trim() || undefined });
      setShopTitle("");
      toast.success("Shop session started");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start shop session");
    }
  }

  async function handleDisplayStartSession() {
    try {
      await startShopSessionFromDisplay({});
      toast.success("Shop session started");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start shop session");
    }
  }

  async function handleEndSession() {
    try {
      const result = await endShopSession({ note: closingNote.trim() || undefined });
      setClosingNote("");
      void notifyClosed(result);
      toast.success(
        result.flaggedCount > 0
          ? `Shop closed. Forgot to sign out: ${result.flaggedStudentNames.join(", ")}.`
          : "Shop session closed",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not close shop session");
    }
  }

  async function handleReview(args: Parameters<typeof reviewAttendance>[0]) {
    setBusyRecordId(args.attendanceSessionId);

    try {
      await reviewAttendance(args);
      toast.success(args.status === "void" ? "Attendance voided" : "Attendance approved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not review attendance");
    } finally {
      setBusyRecordId(null);
    }
  }

  async function handleDeleteAttendance(attendanceSessionId: Id<"attendanceSessions">) {
    if (!window.confirm("Delete this attendance record? This cannot be undone.")) {
      return;
    }

    setBusyRecordId(attendanceSessionId);

    try {
      await deleteAttendance({ attendanceSessionId });
      toast.success("Attendance record deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete attendance");
    } finally {
      setBusyRecordId(null);
    }
  }

  async function handleManualCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!manualUserId || !manualIn || !manualOut) {
      toast.error("Choose a person and both times.");
      return;
    }

    try {
      await createManualAttendance({
        userId: manualUserId as Id<"users">,
        signInAt: fromDateTimeLocal(manualIn),
        signOutAt: fromDateTimeLocal(manualOut),
        note: manualNote.trim() || undefined,
      });
      setManualUserId("");
      setManualIn("");
      setManualOut("");
      setManualNote("");
      toast.success("Manual attendance added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add attendance");
    }
  }

  async function handleLiveSignIn() {
    if (!liveSignInUserId) {
      toast.error("Choose a person to sign in.");
      return;
    }

    setIsLiveSignInBusy(true);

    try {
      await adminSignInPerson({ userId: liveSignInUserId as Id<"users"> });
      setLiveSignInUserId("");
      setLiveSignInSearch("");
      toast.success("Signed in to the shop");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign in this person");
    } finally {
      setIsLiveSignInBusy(false);
    }
  }

  async function handleLiveSignOut(attendanceSessionId: Id<"attendanceSessions">) {
    setBusyRecordId(attendanceSessionId);

    try {
      await adminSignOutPerson({ attendanceSessionId });
      toast.success("Signed out of the shop");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out this person");
    } finally {
      setBusyRecordId(null);
    }
  }

  async function handleSaveSchedule() {
    const schedule = scheduleDraft ?? scheduleSettings?.schedule ?? defaultWeeklySchedule();
    const isEnabled = scheduleEnabledDraft ?? scheduleSettings?.isEnabled ?? false;

    setIsSavingSchedule(true);

    try {
      await updateScheduleSettings({ isEnabled, schedule });
      setScheduleDraft(null);
      setScheduleEnabledDraft(null);
      toast.success("Shop schedule saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save shop schedule");
    } finally {
      setIsSavingSchedule(false);
    }
  }

  function updateScheduleDay(dayOfWeek: number, patch: Partial<ShopScheduleEntry>) {
    const base = scheduleDraft ?? scheduleSettings?.schedule ?? defaultWeeklySchedule();

    setScheduleDraft(
      defaultWeeklySchedule().map((fallback) => {
        const existing = base.find((entry) => entry.dayOfWeek === fallback.dayOfWeek) ?? fallback;

        return existing.dayOfWeek === dayOfWeek ? { ...existing, ...patch } : existing;
      }),
    );
  }

  async function handleStudentAttendance() {
    const code = normalizeAttendanceCode(attendanceCode);

    if (!code) {
      toast.error("Enter the attendance code.");
      return;
    }

    setIsAttendanceBusy(true);

    try {
      const result = await submitAttendanceCode({ code });

      setAttendanceCode("");

      if (result.kind === "event") {
        toast.success(`Checked in for ${result.eventTitle}`);
      } else {
        toast.success("Signed in to the shop");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update attendance");
    } finally {
      setIsAttendanceBusy(false);
    }
  }

  async function handleSignOutOfShop() {
    setIsAttendanceBusy(true);

    try {
      await signOutOfShop({});
      toast.success("Signed out of the shop");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out");
    } finally {
      setIsAttendanceBusy(false);
    }
  }

  async function handleCreateAttendanceEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = normalizeAttendanceCode(eventCodeDraft || randomShopCode());

    setIsEventBusy(true);

    try {
      const eventId = await createAttendanceEvent({
        title: eventTitle,
        location: eventLocation || undefined,
        description: eventDescription || undefined,
        startsAt: eventStartsAt ? fromDateTimeLocal(eventStartsAt) : undefined,
        endsAt: eventEndsAt ? fromDateTimeLocal(eventEndsAt) : undefined,
        code,
      });

      setSelectedEventId(eventId);
      setEventTitle("");
      setEventLocation("");
      setEventStartsAt("");
      setEventEndsAt("");
      setEventDescription("");
      setEventCodeDraft(randomShopCode());
      toast.success("Attendance event created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create attendance event");
    } finally {
      setIsEventBusy(false);
    }
  }

  async function handleGenerateEventCode(eventId: Id<"attendanceEvents">) {
    const code = randomShopCode();

    setIsEventBusy(true);

    try {
      await setAttendanceEventCode({
        eventId,
        code,
      });
      toast.success("Event code generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate event code");
    } finally {
      setIsEventBusy(false);
    }
  }

  async function handleSetSelectedEventCode(eventId: Id<"attendanceEvents">) {
    const code = normalizeAttendanceCode(selectedEventCodeDraft);

    if (!code) {
      toast.error("Enter an event code.");
      return;
    }

    setIsEventBusy(true);

    try {
      await setAttendanceEventCode({
        eventId,
        code,
      });
      setSelectedEventCodeDraft("");
      toast.success("Event code saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save event code");
    } finally {
      setIsEventBusy(false);
    }
  }

  async function handleEventStatus(
    event: NonNullable<typeof attendanceEvents>[number],
    status: "active" | "closed",
  ) {
    setIsEventBusy(true);

    try {
      await updateAttendanceEvent({
        eventId: event._id,
        title: event.title,
        location: event.location,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        status,
      });
      toast.success(status === "active" ? "Event reopened" : "Event closed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update event");
    } finally {
      setIsEventBusy(false);
    }
  }

  async function handleDeleteEventRecord(recordId: Id<"eventAttendanceRecords">) {
    setIsEventBusy(true);

    try {
      await deleteEventAttendanceRecord({ recordId });
      toast.success("Event attendance record deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete event attendance");
    } finally {
      setIsEventBusy(false);
    }
  }

  async function handleEventCheckIn(eventId: Id<"attendanceEvents">) {
    if (!eventCheckInUserId) {
      toast.error("Choose a person to check in.");
      return;
    }

    setIsEventCheckInBusy(true);

    try {
      await adminCheckInToEvent({ eventId, userId: eventCheckInUserId as Id<"users"> });
      setEventCheckInUserId("");
      setEventCheckInSearch("");
      toast.success("Checked in to the event");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check in this person");
    } finally {
      setIsEventCheckInBusy(false);
    }
  }

  async function handleBrowserFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not enter full screen");
    }
  }

  function stopPictureInPictureStream() {
    if (pipIntervalRef.current !== null) {
      window.clearInterval(pipIntervalRef.current);
      pipIntervalRef.current = null;
    }

    pipStreamRef.current?.getTracks().forEach((track) => track.stop());
    pipStreamRef.current = null;

    if (pipVideoRef.current) {
      pipVideoRef.current.pause();
      pipVideoRef.current.srcObject = null;
      pipVideoRef.current.remove();
      pipVideoRef.current = null;
    }

    setIsPipActive(false);
  }

  function pictureInPictureCanvas() {
    const canvas = pipCanvasRef.current ?? document.createElement("canvas");

    if (!pipCanvasRef.current) {
      canvas.width = 640;
      canvas.height = 360;
    }

    pipCanvasRef.current = canvas;

    return canvas;
  }

  function drawPictureInPictureFrame() {
    const canvas = pictureInPictureCanvas();
    const context = canvas.getContext("2d");
    const frame = pipFrameDataRef.current;

    if (!context) {
      return;
    }

    context.fillStyle = "#0f172a";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(28, 28, 304, 304);

    if (pipQrImageRef.current) {
      context.drawImage(pipQrImageRef.current, 44, 44, 272, 272);
    } else {
      context.fillStyle = "#475569";
      context.font = "28px sans-serif";
      context.textAlign = "center";
      context.fillText("QR", 180, 190);
    }

    context.textAlign = "left";
    context.fillStyle = "#94a3b8";
    context.font = "24px sans-serif";
    context.fillText("Shop code", 364, 74);
    context.fillStyle = "#ffffff";
    context.font = "700 56px monospace";
    context.fillText(frame.code || "------", 364, 142);
    context.fillStyle = "#cbd5e1";
    context.font = "24px sans-serif";
    context.fillText(
      frame.hasSession ? `${frame.secondsRemaining}s remaining` : "No active session",
      364,
      200,
    );
    context.fillStyle = "#38bdf8";
    context.fillRect(364, 236, 206, 4);
    context.fillStyle = "#cbd5e1";
    context.font = "20px sans-serif";
    context.fillText("/shop in CODE", 364, 282);
    context.fillText("/shop out CODE", 364, 316);

    const [track] = pipStreamRef.current?.getVideoTracks() ?? [];
    (track as CanvasCaptureTrack | undefined)?.requestFrame?.();
  }

  async function handlePictureInPicture() {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      stopPictureInPictureStream();
      return;
    }

    if (!current?.session || !activeDisplayCode || !activeQrDataUrl) {
      toast.error("Start a shop session and wait for a code before opening picture in picture.");
      return;
    }

    if (!supportsPictureInPicture()) {
      toast.error("Picture in picture is not supported in this browser.");
      return;
    }

    try {
      drawPictureInPictureFrame();

      const canvas = pictureInPictureCanvas();
      const stream = canvas.captureStream?.(0);

      if (!canvas || !stream) {
        throw new Error("Could not create picture in picture stream.");
      }

      const video = document.createElement("video") as PictureInPictureVideo;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      video.style.position = "fixed";
      video.style.left = "-10000px";
      video.style.top = "0";
      video.style.width = "1px";
      video.style.height = "1px";
      video.addEventListener("leavepictureinpicture", stopPictureInPictureStream);
      document.body.appendChild(video);

      pipStreamRef.current = stream;
      pipVideoRef.current = video;

      await video.play();
      await video.requestPictureInPicture?.();
      setIsPipActive(true);
      drawPictureInPictureFrame();
      pipIntervalRef.current = window.setInterval(drawPictureInPictureFrame, 1000);
    } catch (error) {
      stopPictureInPictureStream();
      toast.error(error instanceof Error ? error.message : "Could not open picture in picture.");
    }
  }

  const reportRows = useMemo(() => report?.rows ?? [], [report?.rows]);
  const reportTotals = useMemo(() => report?.totals ?? [], [report?.totals]);
  const studentEventRows = useMemo(() => studentEventAttendance ?? [], [studentEventAttendance]);
  const attendanceEventRows = useMemo(() => attendanceEvents ?? [], [attendanceEvents]);
  const selectedAttendanceEvent = attendanceEventRows.find((event) => event._id === selectedEventId);
  const selectedEventRecords = useMemo(
    () => selectedEventAttendance ?? [],
    [selectedEventAttendance],
  );
  const eventCheckInEligiblePeople = useMemo(() => {
    const checkedInUserIds = new Set(selectedEventRecords.map((record) => record.userId));

    return (eventCheckInPeople ?? []).filter((person) => !checkedInUserIds.has(person.userId));
  }, [eventCheckInPeople, selectedEventRecords]);
  const eventCheckInSelected = eventCheckInEligiblePeople.find(
    (person) => person.userId === eventCheckInUserId,
  );
  const eventCheckInResults = useMemo(() => {
    const term = eventCheckInSearch.trim().toLowerCase();

    if (!term) {
      return eventCheckInEligiblePeople;
    }

    return eventCheckInEligiblePeople.filter((person) =>
      [
        person.name,
        person.studentGroup,
        person.graduationYear ? String(person.graduationYear) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [eventCheckInEligiblePeople, eventCheckInSearch]);
  const overviewSummary = overviewReport?.summary;
  const overviewStudents = useMemo(() => overviewReport?.students ?? [], [overviewReport?.students]);
  const studentTableRows = useMemo(() => {
    const term = studentTableSearch.trim().toLowerCase();
    const maxHours = maxHoursFilter.trim() ? Number(maxHoursFilter) : null;
    const direction = studentTableSortDir === "asc" ? 1 : -1;

    return overviewStudents
      .filter((student) => {
        if (term) {
          const searchable = [
            student.studentName,
            student.studentGroup,
            student.primaryProgram,
            student.graduationYear ? String(student.graduationYear) : "",
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          if (!searchable.includes(term)) {
            return false;
          }
        }

        if (maxHours !== null && !Number.isNaN(maxHours) && student.shopMinutes / 60 >= maxHours) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (studentTableSortBy === "name") {
          return direction * a.studentName.localeCompare(b.studentName);
        }

        if (studentTableSortBy === "hours") {
          return direction * (a.shopMinutes - b.shopMinutes);
        }

        if (studentTableSortBy === "needsReview") {
          return direction * (a.needsReviewMinutes - b.needsReviewMinutes);
        }

        if (studentTableSortBy === "events") {
          return direction * (a.eventCount - b.eventCount);
        }

        return direction * (a.lastAttendanceAt - b.lastAttendanceAt);
      });
  }, [overviewStudents, studentTableSearch, maxHoursFilter, studentTableSortBy, studentTableSortDir]);
  const studentTableNumericPageSize = Number(studentTablePageSize);
  const studentTablePageCount = Math.max(
    1,
    Math.ceil(studentTableRows.length / studentTableNumericPageSize),
  );
  const studentTableSafePageIndex = Math.min(studentTablePageIndex, studentTablePageCount - 1);
  const paginatedStudentTableRows = studentTableRows.slice(
    studentTableSafePageIndex * studentTableNumericPageSize,
    studentTableSafePageIndex * studentTableNumericPageSize + studentTableNumericPageSize,
  );

  function toggleStudentTableSort(column: typeof studentTableSortBy) {
    setStudentTablePageIndex(0);

    if (studentTableSortBy === column) {
      setStudentTableSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }

    setStudentTableSortBy(column);
    setStudentTableSortDir("asc");
  }

  function studentTableSortIcon(column: typeof studentTableSortBy) {
    if (studentTableSortBy !== column) {
      return <ArrowUpDown className="size-3.5 text-muted-foreground/60" />;
    }

    return studentTableSortDir === "asc" ? (
      <ArrowUp className="size-3.5" />
    ) : (
      <ArrowDown className="size-3.5" />
    );
  }
  const overviewEvents = useMemo(() => overviewReport?.events ?? [], [overviewReport?.events]);
  const overviewGroups = useMemo(() => overviewReport?.groups ?? [], [overviewReport?.groups]);
  const attendanceRecords = useMemo(() => recordRows ?? [], [recordRows]);
  const recordPeopleRows = useMemo(() => recordPeople ?? [], [recordPeople]);
  const selectedStudentPerson = recordPeopleRows.find((person) => person.userId === selectedStudentUserId);
  const studentSearchResults = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();

    if (!term) {
      return recordPeopleRows;
    }

    return recordPeopleRows.filter((person) =>
      [
        person.name,
        person.studentGroup,
        person.primaryProgram,
        person.graduationYear ? String(person.graduationYear) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [recordPeopleRows, studentSearch]);
  const openRows = useMemo(() => liveAttendance ?? [], [liveAttendance]);
  const peopleNotSignedIn = useMemo(() => {
    const openUserIds = new Set(
      openRows.filter((row) => row.status === "open").map((row) => row.userId),
    );

    return (people ?? []).filter((person) => !openUserIds.has(person.userId));
  }, [people, openRows]);
  const liveSignInSelected = peopleNotSignedIn.find((person) => person.userId === liveSignInUserId);
  const liveSignInResults = useMemo(() => {
    const term = liveSignInSearch.trim().toLowerCase();

    if (!term) {
      return peopleNotSignedIn;
    }

    return peopleNotSignedIn.filter((person) =>
      [
        person.name,
        person.studentGroup,
        person.graduationYear ? String(person.graduationYear) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [peopleNotSignedIn, liveSignInSearch]);
  const reviewRows = useMemo(() => reviewQueue ?? [], [reviewQueue]);
  const filteredReviewRows = useMemo(
    () =>
      selectedStudentUserId
        ? reviewRows.filter((record) => record.userId === selectedStudentUserId)
        : reviewRows,
    [reviewRows, selectedStudentUserId],
  );
  const reviewCountsByUser = useMemo(() => {
    const counts = new Map<Id<"users">, number>();

    for (const record of reviewRows) {
      counts.set(record.userId, (counts.get(record.userId) ?? 0) + 1);
    }

    return counts;
  }, [reviewRows]);
  const routeBase = showReportsRoute ? "/shop/reports" : showReviewRoute ? "/shop/review" : "/shop/records";
  const routeLabel = showReportsRoute ? "reports" : showReviewRoute ? "review queue" : "attendance records";
  const totalReportMinutes = useMemo(
    () => reportTotals.reduce((total, row) => total + row.minutes, 0),
    [reportTotals],
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading eyebrow="Shop Attendance" title="Loading" description="Checking your account." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        eyebrow="Dolphin Apps"
        title="Shop Attendance"
        description="Track student shop sessions, Slack check-ins, and reviewed hours."
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <LockKeyhole className="size-5 text-primary" />
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>Use your Dolphin Apps account before linking Slack or viewing attendance.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to={`/auth?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`}>
                <KeyRound className="size-4" />
                Sign in
              </Link>
            </Button>
          </CardContent>
        </Card>
      </Unauthenticated>

      <Authenticated>
        {!showDisplayRoute && (
          <ShopSectionNav
            pathname={location.pathname}
            canManage={canManage}
            canDisplayRole={canDisplayRole}
            reviewCount={reviewRows.length}
          />
        )}
        {showStudentRosterRoute ? (
          canManage ? (
            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <ClipboardList className="size-5 text-primary" />
                  <CardTitle>
                    {selectedStudentPerson
                      ? selectedStudentPerson.name
                      : showReportsRoute
                      ? "Student reports"
                      : showReviewRoute
                      ? "Student review"
                      : "Student attendance records"}
                  </CardTitle>
                  <CardDescription>
                    {selectedStudentPerson
                      ? `Viewing ${routeLabel} for this student.`
                      : `Search or pick a student to view their ${routeLabel}.`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)] lg:items-end">
                    <div className="relative space-y-2">
                      <Label htmlFor="studentSearch">Find student</Label>
                      <Input
                        id="studentSearch"
                        value={studentSearch}
                        onChange={(event) => {
                          setStudentSearch(event.target.value);
                          setIsStudentSearchOpen(true);
                        }}
                        onFocus={() => setIsStudentSearchOpen(true)}
                        onBlur={() => window.setTimeout(() => setIsStudentSearchOpen(false), 120)}
                        placeholder="Search by name, team, program, or graduation year"
                      />
                      {isStudentSearchOpen && (
                        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
                          {studentSearchResults.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">No students found.</div>
                          ) : (
                            studentSearchResults.map((person) => (
                              <button
                                key={person.userId}
                                type="button"
                                className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setStudentSearch(person.name);
                                  setIsStudentSearchOpen(false);
                                  navigate(`${routeBase}/${person.userId}`);
                                }}
                              >
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">{person.name}</span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {person.studentGroup ?? person.role}
                                    {person.graduationYear ? ` - ${person.graduationYear}` : ""}
                                  </span>
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {showReviewRoute && reviewCountsByUser.get(person.userId)
                                    ? `${reviewCountsByUser.get(person.userId)} review`
                                    : "View"}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {((selectedStudentUserId && (showRecordsRoute || showReportsRoute)) ||
                    (showReportsRoute && !selectedStudentUserId)) && (
                    <>
                      <div className="grid gap-3 lg:grid-cols-[160px_160px_auto_auto] lg:items-end">
                        <div className="space-y-2">
                          <Label>From</Label>
                          <Input
                            type="date"
                            value={showReportsRoute ? fromDate : recordFromDate}
                            onChange={(event) =>
                              showReportsRoute
                                ? setFromDate(event.target.value)
                                : setRecordFromDate(event.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>To</Label>
                          <Input
                            type="date"
                            value={showReportsRoute ? toDate : recordToDate}
                            onChange={(event) =>
                              showReportsRoute
                                ? setToDate(event.target.value)
                                : setRecordToDate(event.target.value)
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (showReportsRoute) {
                              setFromDate("");
                              setToDate("");
                            } else {
                              setRecordFromDate("");
                              setRecordToDate("");
                            }
                          }}
                        >
                          Clear dates
                        </Button>
                        {selectedStudentUserId && (
                          <Button asChild variant="outline">
                            <Link to={routeBase}>
                              <Users className="size-4" />
                              All students
                            </Link>
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                  {selectedStudentUserId && showRecordsRoute && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-md border p-4">
                        <p className="text-sm text-muted-foreground">Records</p>
                        <p className="mt-1 text-2xl font-semibold">{attendanceRecords.length}</p>
                      </div>
                      <div className="rounded-md border p-4">
                        <p className="text-sm text-muted-foreground">Complete</p>
                        <p className="mt-1 text-2xl font-semibold">
                          {attendanceRecords.filter((record) => record.status === "complete").length}
                        </p>
                      </div>
                      <div className="rounded-md border p-4">
                        <p className="text-sm text-muted-foreground">Needs review</p>
                        <p className="mt-1 text-2xl font-semibold">
                          {attendanceRecords.filter((record) => record.status === "needs_review").length}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedStudentUserId && showReviewRoute && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border p-4">
                        <p className="text-sm text-muted-foreground">Needs review</p>
                        <p className="mt-1 text-2xl font-semibold">{filteredReviewRows.length}</p>
                      </div>
                      <div className="rounded-md border p-4">
                        <p className="text-sm text-muted-foreground">Total queue</p>
                        <p className="mt-1 text-2xl font-semibold">{reviewRows.length}</p>
                      </div>
                    </div>
                  )}
                  {selectedStudentUserId && showReportsRoute && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-md border p-4">
                        <p className="text-sm text-muted-foreground">Records</p>
                        <p className="mt-1 text-2xl font-semibold">{reportRows.length}</p>
                      </div>
                      <div className="rounded-md border p-4">
                        <p className="text-sm text-muted-foreground">Total hours</p>
                        <p className="mt-1 text-2xl font-semibold">{formatHours(totalReportMinutes)}</p>
                      </div>
                      <div className="rounded-md border p-4">
                        <p className="text-sm text-muted-foreground">Provisional hours</p>
                        <p className="mt-1 text-2xl font-semibold">
                          {formatHours(reportTotals.reduce((total, row) => total + row.needsReviewMinutes, 0))}
                        </p>
                      </div>
                      <div className="rounded-md border p-4">
                        <p className="text-sm text-muted-foreground">Events attended</p>
                        <p className="mt-1 text-2xl font-semibold">{studentEventRows.length}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              {selectedStudentUserId && showRecordsRoute ? (
                <div className="space-y-3">
                  {recordPeople && !selectedStudentPerson && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">Student not found.</div>
                  )}
                  {recordRows === undefined && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading records...</div>
                  )}
                  {recordRows && attendanceRecords.length === 0 && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">No attendance records match these filters.</div>
                  )}
                  {attendanceRecords.map((record) => (
                    <EditableAttendanceRecord
                      key={record._id}
                      record={record}
                      isBusy={busyRecordId === record._id}
                      onSave={(args) => void handleReview(args)}
                      onDelete={(attendanceSessionId) => void handleDeleteAttendance(attendanceSessionId)}
                    />
                  ))}
                </div>
              ) : selectedStudentUserId && showReviewRoute ? (
                <div className="space-y-3">
                  {recordPeople && !selectedStudentPerson && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">Student not found.</div>
                  )}
                  {reviewQueue === undefined && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading review queue...</div>
                  )}
                  {reviewQueue && filteredReviewRows.length === 0 && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">No attendance records need review for this student.</div>
                  )}
                  {filteredReviewRows.map((record) => (
                    <ReviewRecord
                      key={record._id}
                      record={record}
                      isBusy={busyRecordId === record._id}
                      onReview={(args) => void handleReview(args)}
                    />
                  ))}
                </div>
              ) : selectedStudentUserId && showReportsRoute ? (
                <div className="space-y-5">
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">Shop hours</h3>
                    {report === undefined && (
                      <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading report...</div>
                    )}
                    {report && reportRows.length === 0 && (
                      <div className="rounded-md border p-4 text-sm text-muted-foreground">No report records match these filters.</div>
                    )}
                    {reportRows.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          downloadCsv("shop-student-hours.csv", [
                            ["Student", "Status", "Source", "Sign in", "Sign out", "Minutes", "Hours"],
                            ...reportRows.map((row) => {
                              const minutes = minutesBetween(row.signInAt, row.signOutAt);

                              return [
                                row.studentName,
                                row.status,
                                row.source,
                                formatDateTime(row.signInAt),
                                formatDateTime(row.signOutAt),
                                String(minutes),
                                (minutes / 60).toFixed(2),
                              ];
                            }),
                          ])
                        }
                      >
                        <Download className="size-4" />
                        Export CSV
                      </Button>
                    )}
                    {reportRows.map((row) => {
                      const minutes = minutesBetween(row.signInAt, row.signOutAt);

                      return (
                        <div key={row._id} className="grid gap-2 rounded-md border bg-card p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{formatDateTime(row.signInAt)}</p>
                            <p className="text-sm text-muted-foreground">{formatDateTime(row.signOutAt)}</p>
                          </div>
                          <Badge variant={row.status === "needs_review" ? "secondary" : "outline"}>
                            {row.status.replace("_", " ")}
                          </Badge>
                          <p className="text-sm font-medium">{formatHours(minutes)}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">Events attended</h3>
                    {studentEventAttendance === undefined && (
                      <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading events...</div>
                    )}
                    {studentEventAttendance && studentEventRows.length === 0 && (
                      <div className="rounded-md border p-4 text-sm text-muted-foreground">No events attended yet.</div>
                    )}
                    {studentEventRows.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          downloadCsv("student-event-attendance.csv", [
                            ["Event", "Location", "Event date", "Checked in"],
                            ...studentEventRows.map((row) => [
                              row.eventTitle,
                              row.eventLocation ?? "",
                              row.eventStartsAt ? formatDateTime(row.eventStartsAt) : "",
                              formatDateTime(row.checkedInAt),
                            ]),
                          ])
                        }
                      >
                        <Download className="size-4" />
                        Export CSV
                      </Button>
                    )}
                    {studentEventRows.map((row) => (
                      <div
                        key={row.recordId}
                        className="grid gap-2 rounded-md border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{row.eventTitle}</p>
                          <p className="text-sm text-muted-foreground">
                            {row.eventLocation || "No location"}
                            {row.eventStartsAt ? ` · ${formatDateTime(row.eventStartsAt)}` : ""}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Checked in {formatDateTime(row.checkedInAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : showReportsRoute ? (
                <div className="space-y-5">
                  {overviewReport === undefined && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading attendance report...</div>
                  )}
                  {overviewSummary && (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                        <div className="rounded-md border bg-card p-4">
                          <p className="text-sm text-muted-foreground">Students</p>
                          <p className="mt-1 text-2xl font-semibold">{overviewSummary.studentCount}</p>
                        </div>
                        <div className="rounded-md border bg-card p-4">
                          <p className="text-sm text-muted-foreground">Shop hours</p>
                          <p className="mt-1 text-2xl font-semibold">{formatHours(overviewSummary.shopMinutes)}</p>
                        </div>
                        <div className="rounded-md border bg-card p-4">
                          <p className="text-sm text-muted-foreground">Shop records</p>
                          <p className="mt-1 text-2xl font-semibold">{overviewSummary.shopRecordCount}</p>
                        </div>
                        <div className="rounded-md border bg-card p-4">
                          <p className="text-sm text-muted-foreground">Events</p>
                          <p className="mt-1 text-2xl font-semibold">{overviewSummary.eventCount}</p>
                        </div>
                        <div className="rounded-md border bg-card p-4">
                          <p className="text-sm text-muted-foreground">Event attendance</p>
                          <p className="mt-1 text-2xl font-semibold">{overviewSummary.eventAttendanceCount}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            downloadCsv("attendance-overview.csv", [
                              [
                                "Student",
                                "Shop Hours",
                                "Shop Records",
                                "Needs Review Hours",
                                "Events Attended",
                                "Group",
                                "Program",
                                "Graduation Year",
                                "Last Attendance",
                              ],
                              ...overviewStudents.map((row) => [
                                row.studentName,
                                (row.shopMinutes / 60).toFixed(2),
                                String(row.shopRecordCount),
                                (row.needsReviewMinutes / 60).toFixed(2),
                                String(row.eventCount),
                                row.studentGroup ?? "",
                                row.primaryProgram ?? "",
                                row.graduationYear ? String(row.graduationYear) : "",
                                row.lastAttendanceAt ? formatDateTime(row.lastAttendanceAt) : "",
                              ]),
                            ])
                          }
                        >
                          <Download className="size-4" />
                          Export overview CSV
                        </Button>
                      </div>
                    </>
                  )}

                  <div className="grid gap-5 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle>Event attendance</CardTitle>
                        <CardDescription>Events with attendance in the selected date range.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {overviewEvents.length === 0 && (
                          <div className="rounded-md border p-4 text-sm text-muted-foreground">No event attendance in this range.</div>
                        )}
                        {overviewEvents.map((event) => (
                          <div key={event._id} className="grid gap-2 rounded-md border p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{event.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {event.location || "No location"}
                                {event.startsAt ? ` - ${formatDateTime(event.startsAt)}` : ""}
                              </p>
                            </div>
                            <Badge variant="outline">{event.attendanceCount} attending</Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Group breakdown</CardTitle>
                        <CardDescription>Shop hours and event attendance by team/program group.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {overviewGroups.length === 0 && (
                          <div className="rounded-md border p-4 text-sm text-muted-foreground">No attendance in this range.</div>
                        )}
                        {overviewGroups.map((group) => (
                          <div key={group.label} className="grid gap-2 rounded-md border p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                            <p className="font-medium">{group.label}</p>
                            <Badge variant="outline">{group.studentCount} students</Badge>
                            <p className="text-sm font-medium">
                              {formatHours(group.shopMinutes)} / {group.eventCount} events
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Student attendance</CardTitle>
                      <CardDescription>
                        {studentTableRows.length} of {overviewStudents.length} students shown.
                        Click a column to sort, or a row to open that student's report.
                      </CardDescription>
                      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
                        <div className="space-y-2">
                          <Label htmlFor="studentTableSearch">Search</Label>
                          <Input
                            id="studentTableSearch"
                            value={studentTableSearch}
                            onChange={(event) => {
                              setStudentTableSearch(event.target.value);
                              setStudentTablePageIndex(0);
                            }}
                            placeholder="Name, team, program, or graduation year"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="maxHoursFilter">Below hours</Label>
                          <Input
                            id="maxHoursFilter"
                            type="number"
                            min={0}
                            value={maxHoursFilter}
                            onChange={(event) => {
                              setMaxHoursFilter(event.target.value);
                              setStudentTablePageIndex(0);
                            }}
                            placeholder="e.g. 10"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            downloadCsv("student-attendance-filtered.csv", [
                              [
                                "Student",
                                "Shop Hours",
                                "Shop Records",
                                "Needs Review Hours",
                                "Events Attended",
                                "Group",
                                "Program",
                                "Graduation Year",
                                "Last Attendance",
                              ],
                              ...studentTableRows.map((row) => [
                                row.studentName,
                                (row.shopMinutes / 60).toFixed(2),
                                String(row.shopRecordCount),
                                (row.needsReviewMinutes / 60).toFixed(2),
                                String(row.eventCount),
                                row.studentGroup ?? "",
                                row.primaryProgram ?? "",
                                row.graduationYear ? String(row.graduationYear) : "",
                                row.lastAttendanceAt ? formatDateTime(row.lastAttendanceAt) : "",
                              ]),
                            ])
                          }
                        >
                          <Download className="size-4" />
                          Export this view
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {overviewStudents.length === 0 ? (
                        <div className="m-5 rounded-md border p-4 text-sm text-muted-foreground">
                          No student attendance in this range.
                        </div>
                      ) : studentTableRows.length === 0 ? (
                        <div className="m-5 rounded-md border p-4 text-sm text-muted-foreground">
                          No students match the current filters.
                        </div>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                                <tr>
                                  <th className="px-4 py-3 font-medium">
                                    <button
                                      type="button"
                                      className="flex items-center gap-1"
                                      onClick={() => toggleStudentTableSort("name")}
                                    >
                                      Student {studentTableSortIcon("name")}
                                    </button>
                                  </th>
                                  <th className="px-4 py-3 font-medium">Group</th>
                                  <th className="px-4 py-3 font-medium">
                                    <button
                                      type="button"
                                      className="flex items-center gap-1"
                                      onClick={() => toggleStudentTableSort("hours")}
                                    >
                                      Shop hours {studentTableSortIcon("hours")}
                                    </button>
                                  </th>
                                  <th className="px-4 py-3 font-medium">
                                    <button
                                      type="button"
                                      className="flex items-center gap-1"
                                      onClick={() => toggleStudentTableSort("needsReview")}
                                    >
                                      Needs review {studentTableSortIcon("needsReview")}
                                    </button>
                                  </th>
                                  <th className="px-4 py-3 font-medium">
                                    <button
                                      type="button"
                                      className="flex items-center gap-1"
                                      onClick={() => toggleStudentTableSort("events")}
                                    >
                                      Events {studentTableSortIcon("events")}
                                    </button>
                                  </th>
                                  <th className="px-4 py-3 font-medium">
                                    <button
                                      type="button"
                                      className="flex items-center gap-1"
                                      onClick={() => toggleStudentTableSort("lastAttendance")}
                                    >
                                      Last attendance {studentTableSortIcon("lastAttendance")}
                                    </button>
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {paginatedStudentTableRows.map((student) => (
                                  <tr
                                    key={student.userId}
                                    className="cursor-pointer transition-colors hover:bg-muted/35"
                                    onClick={() => navigate(`${routeBase}/${student.userId}`)}
                                  >
                                    <td className="px-4 py-3 font-medium">{student.studentName}</td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                      {student.studentGroup ?? "Student"}
                                      {student.graduationYear ? ` · ${student.graduationYear}` : ""}
                                    </td>
                                    <td className="px-4 py-3">{formatHours(student.shopMinutes)}</td>
                                    <td className="px-4 py-3">
                                      {student.needsReviewMinutes > 0 ? (
                                        <Badge variant="secondary">{formatHours(student.needsReviewMinutes)}</Badge>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">{student.eventCount}</td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                      {student.lastAttendanceAt ? formatDateTime(student.lastAttendanceAt) : "-"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="flex flex-col gap-3 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-muted-foreground">
                              Page {studentTableSafePageIndex + 1} of {studentTablePageCount}
                            </p>
                            <div className="flex items-center gap-2">
                              <Label htmlFor="studentTablePageSize" className="sr-only">Rows per page</Label>
                              <Select
                                value={studentTablePageSize}
                                onValueChange={(value) => {
                                  setStudentTablePageSize(value);
                                  setStudentTablePageIndex(0);
                                }}
                              >
                                <SelectTrigger id="studentTablePageSize" className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="25">25 rows</SelectItem>
                                  <SelectItem value="50">50 rows</SelectItem>
                                  <SelectItem value="100">100 rows</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setStudentTablePageIndex(Math.max(0, studentTableSafePageIndex - 1))}
                                disabled={studentTableSafePageIndex === 0}
                              >
                                <ChevronLeft className="size-4" />
                                Previous
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setStudentTablePageIndex(
                                    Math.min(studentTablePageCount - 1, studentTableSafePageIndex + 1),
                                  )
                                }
                                disabled={studentTableSafePageIndex >= studentTablePageCount - 1}
                              >
                                Next
                                <ChevronRight className="size-4" />
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="space-y-3">
                  {recordPeople === undefined && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading students...</div>
                  )}
                  {recordPeople && recordPeopleRows.length === 0 && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">No active students found.</div>
                  )}
                  {recordPeopleRows.map((person) => (
                    <Link
                      key={person.userId}
                      to={`${routeBase}/${person.userId}`}
                      className="grid gap-2 rounded-md border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground sm:grid-cols-[1fr_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{person.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span>{person.studentGroup ?? person.role}</span>
                          {person.graduationYear && <span>{person.graduationYear}</span>}
                        </div>
                      </div>
                      <Badge variant="outline">
                        {showReviewRoute && reviewCountsByUser.get(person.userId)
                          ? `${reviewCountsByUser.get(person.userId)} to review`
                          : showReportsRoute
                          ? "View report"
                          : "View records"}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <LockKeyhole className="size-5 text-primary" />
                <CardTitle>Records are restricted</CardTitle>
                <CardDescription>Only mentors, instructors, and admins can view attendance records.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link to="/shop/display">Return to display</Link>
                </Button>
              </CardContent>
            </Card>
          )
        ) : showDisplayRoute ? (
          <div className="fixed inset-0 z-[100] grid bg-background p-4 text-foreground sm:p-8">
            <div className="grid min-h-0 gap-6 lg:grid-cols-[1fr_42vw] lg:items-center">
              <section className="grid content-center gap-6">
                <div>
                  <Badge variant="secondary" className="mb-4 w-fit">
                    Shop Attendance
                  </Badge>
                  <h1 className="text-4xl font-semibold tracking-normal sm:text-6xl">
                    {current?.session ? "Scan or enter the shop code" : "No active shop session"}
                  </h1>
                  <p className="mt-4 max-w-2xl text-lg text-muted-foreground sm:text-2xl">
                    {current?.session
                      ? `Code rotates automatically. ${codeSecondsRemaining}s remaining.`
                      : "A mentor needs to start a shop session before students can sign in."}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border bg-card p-5 font-mono text-xl">/shop in {activeDisplayCode || "CODE"}</div>
                  <div className="rounded-md border bg-card p-5 font-mono text-xl">/shop out {activeDisplayCode || "CODE"}</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border bg-card p-5">
                    <p className="text-sm text-muted-foreground">Signed in now</p>
                    <p className="mt-2 text-5xl font-semibold">{displayCurrentCount}</p>
                  </div>
                  <div className="rounded-md border bg-card p-5">
                    <p className="text-sm text-muted-foreground">Peak today</p>
                    <p className="mt-2 text-5xl font-semibold">{displayPeakToday}</p>
                  </div>
                </div>
                <div className="rounded-md border bg-card p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Trophy className="size-5 text-primary" />
                    <p className="font-medium">Top hours this week</p>
                  </div>
                  <div className="space-y-2">
                    {(displayStats?.leaderboard ?? []).length === 0 && (
                      <p className="text-sm text-muted-foreground">No hours recorded yet this week.</p>
                    )}
                    {(displayStats?.leaderboard ?? []).map((row, index) => (
                      <div key={row.userId} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className="min-w-0 truncate">{row.studentName}</span>
                        <span className="font-medium">{formatHours(row.minutes)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {!current?.session && canDisplayRole && (
                    <Button type="button" onClick={() => void handleDisplayStartSession()}>
                      <Clock className="size-4" />
                      Start session
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void refreshCode()}
                    disabled={!current?.session || isGeneratingCode}
                  >
                    {isGeneratingCode ? <Loader2 className="size-4 animate-spin" /> : <TimerReset className="size-4" />}
                    Refresh
                  </Button>
                  {canManage && (
                    <Button asChild variant="outline">
                      <Link to="/shop">
                        <ClipboardList className="size-4" />
                        Manage
                      </Link>
                    </Button>
                  )}
                </div>
              </section>
              <section className="grid min-h-0 place-items-center gap-6">
                <div className="group relative grid aspect-square w-full max-w-[min(72vh,42vw)] place-items-center rounded-md border bg-white p-6">
                  <div className="absolute right-3 top-3 z-10 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="shadow-md"
                      onClick={() => void handleBrowserFullscreen()}
                      aria-label="Open browser full screen"
                      title="Open browser full screen"
                    >
                      <Maximize2 className="size-4" />
                    </Button>
                    {canUsePictureInPicture && (isPipActive || (current?.session && activeDisplayCode && activeQrDataUrl)) && (
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="shadow-md"
                        onClick={() => void handlePictureInPicture()}
                        aria-label={isPipActive ? "Close picture in picture code display" : "Open picture in picture code display"}
                        title={isPipActive ? "Close picture in picture" : "Open picture in picture"}
                      >
                        <PictureInPicture className="size-4" />
                      </Button>
                    )}
                  </div>
                  {current?.session && activeQrDataUrl ? (
                    <img src={activeQrDataUrl} alt="Current shop attendance QR code" className="h-full w-full" />
                  ) : (
                    <QrCode className="size-32 text-muted-foreground" />
                  )}
                </div>
                <div className="w-full rounded-md border bg-card p-6 text-center">
                  <p className="font-mono text-6xl font-semibold tracking-normal sm:text-8xl">
                    {activeDisplayCode || "------"}
                  </p>
                </div>
              </section>
            </div>
          </div>
        ) : (
        <Tabs
          key={`${searchParams.get("tab") ?? "default"}-${viewer === undefined ? "loading" : "ready"}`}
          defaultValue={
            searchParams.get("tab") ??
            (canDisplayRole ? "display" : canManageEvents ? "events" : "checkin")
          }
          className="space-y-5"
          onValueChange={() => {
            if (searchParams.get("tab")) {
              setSearchParams(
                (previous) => {
                  const next = new URLSearchParams(previous);
                  next.delete("tab");
                  return next;
                },
                { replace: true },
              );
            }
          }}
        >
          {hasMultipleShopTabs && (
          <TabsList className="flex h-auto w-full flex-nowrap items-center justify-start overflow-x-auto sm:flex-wrap sm:overflow-visible">
            {canDisplayRole && (
              <TabsTrigger value="display" className="shrink-0">
                <Monitor className="size-4" />
                Code
              </TabsTrigger>
            )}
            {canManage && (
              <TabsTrigger value="live" className="shrink-0">
                <Users className="size-4" />
                Live
              </TabsTrigger>
            )}
            {canManage && (
              <span
                className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block"
                aria-hidden="true"
              />
            )}
            {canManage && (
              <TabsTrigger value="schedule" className="shrink-0">
                <Clock className="size-4" />
                Schedule
              </TabsTrigger>
            )}
            {canManageEvents && (
              <TabsTrigger value="events" className="shrink-0">
                <CalendarDays className="size-4" />
                Events
              </TabsTrigger>
            )}
            {canManage && (
              <>
                <span
                  className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block"
                  aria-hidden="true"
                />
                <TabsTrigger value="review" className="shrink-0">
                  <ShieldCheck className="size-4" />
                  Review queue
                  {reviewRows.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[11px]">
                      {reviewRows.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </>
            )}
            {!hasAnyManagementTab && canUseStudentCheckIn && (
              <TabsTrigger value="checkin" className="shrink-0">
                <QrCode className="size-4" />
                Check in/out
              </TabsTrigger>
            )}
          </TabsList>
          )}

          {canDisplayRole && (
            <TabsContent value="display" className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
                <section className="space-y-5">
                  <Card>
                    <CardHeader>
                      <Clock className="size-5 text-primary" />
                      <CardTitle>Shop session</CardTitle>
                      <CardDescription>
                        {current?.session
                          ? `Opened ${formatDateTime(current.session.openedAt)}. Auto-closes ${formatDateTime(current.autoClosesAt)}.`
                          : "No active shop session."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!current?.session ? (
                        canManage ? (
                          <form onSubmit={handleStartSession} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                            <div className="flex-1 space-y-2">
                              <Label htmlFor="shopSessionTitle">Session title</Label>
                              <Input
                                id="shopSessionTitle"
                                value={shopTitle}
                                onChange={(event) => setShopTitle(event.target.value)}
                                placeholder="Optional session title"
                              />
                            </div>
                            <Button type="submit">
                              <Clock className="size-4" />
                              Start session
                            </Button>
                          </form>
                        ) : (
                          <Button type="button" onClick={() => void handleDisplayStartSession()}>
                            <Clock className="size-4" />
                            Start session
                          </Button>
                        )
                      ) : current?.session && canManage ? (
                        <div className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-md border p-4">
                              <p className="text-sm text-muted-foreground">Signed in</p>
                              <p className="mt-1 text-2xl font-semibold">{displayCurrentCount}</p>
                            </div>
                            <div className="rounded-md border p-4">
                              <p className="text-sm text-muted-foreground">Needs review</p>
                              <p className="mt-1 text-2xl font-semibold">{current.needsReviewCount}</p>
                            </div>
                            <div className="rounded-md border p-4">
                              <p className="text-sm text-muted-foreground">Peak today</p>
                              <p className="mt-1 text-2xl font-semibold">{displayPeakToday}</p>
                            </div>
                          </div>
                          <Textarea
                            value={closingNote}
                            onChange={(event) => setClosingNote(event.target.value)}
                            placeholder="Closing note"
                          />
                          <Button type="button" variant="destructive" onClick={() => void handleEndSession()}>
                            <Square className="size-4" />
                            End session
                          </Button>
                        </div>
                      ) : (
                        <div className="rounded-md border p-4 text-sm text-muted-foreground">
                          This kiosk can display the code, but only mentors and admins can close or review sessions.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                </section>

                <Card>
                  <CardHeader>
                    <QrCode className="size-5 text-primary" />
                    <CardTitle>Current code</CardTitle>
                    <CardDescription>
                      {current?.session
                        ? `Rotates automatically. ${codeSecondsRemaining}s remaining.`
                        : "Start a session to show a code."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid place-items-center gap-5 text-center">
                    <div className="group relative grid size-72 place-items-center rounded-md border bg-white p-4">
                      <div className="absolute right-2 top-2 z-10 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Button asChild size="icon" variant="secondary" className="shadow-md">
                          <Link to="/shop/display" aria-label="Open full screen display" title="Open full screen display">
                            <Maximize2 className="size-4" />
                          </Link>
                        </Button>
                        {canUsePictureInPicture && (isPipActive || (current?.session && activeDisplayCode && activeQrDataUrl)) && (
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="shadow-md"
                            onClick={() => void handlePictureInPicture()}
                            aria-label={isPipActive ? "Close picture in picture code display" : "Open picture in picture code display"}
                            title={isPipActive ? "Close picture in picture" : "Open picture in picture"}
                          >
                            <PictureInPicture className="size-4" />
                          </Button>
                        )}
                      </div>
                      {current?.session && activeQrDataUrl ? (
                        <img src={activeQrDataUrl} alt="Current shop attendance QR code" className="size-60" />
                      ) : (
                        <QrCode className="size-24 text-muted-foreground" />
                      )}
                    </div>
                    <div className="w-full rounded-md border bg-muted/40 p-5">
                      <p className="font-mono text-5xl font-semibold tracking-normal">{activeDisplayCode || "------"}</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void refreshCode()}
                        disabled={!current?.session || isGeneratingCode || !current.canDisplay}
                      >
                        {isGeneratingCode ? <Loader2 className="size-4 animate-spin" /> : <TimerReset className="size-4" />}
                        Refresh
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {canManage && (
            <TabsContent value="schedule">
              <Card>
                <CardHeader>
                  <Clock className="size-5 text-primary" />
                  <CardTitle>Scheduled starts</CardTitle>
                  <CardDescription>Automatically start shop sessions from a weekly schedule.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="flex items-center gap-3 rounded-md border p-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={scheduleEnabled}
                      onChange={(event) => setScheduleEnabledDraft(event.target.checked)}
                    />
                    <span className="font-medium">Enable scheduled starts</span>
                  </label>
                  <div className="grid gap-2">
                    {scheduleForm.map((entry) => (
                      <div
                        key={entry.dayOfWeek}
                        className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_130px] sm:items-center"
                      >
                        <label className="flex items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={entry.isActive}
                            onChange={(event) =>
                              updateScheduleDay(entry.dayOfWeek, { isActive: event.target.checked })
                            }
                          />
                          <span className="font-medium">{SHOP_DAYS[entry.dayOfWeek]}</span>
                        </label>
                        <Input
                          type="time"
                          value={minutesToTimeInput(entry.startMinutes)}
                          disabled={!entry.isActive}
                          onChange={(event) =>
                            updateScheduleDay(entry.dayOfWeek, {
                              startMinutes: timeInputToMinutes(event.target.value),
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void handleSaveSchedule()}
                      disabled={isSavingSchedule || !scheduleHasChanges}
                    >
                      {isSavingSchedule ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      Save schedule
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!scheduleHasChanges}
                      onClick={() => {
                        setScheduleDraft(null);
                        setScheduleEnabledDraft(null);
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canManageEvents && (
            <TabsContent value="events" className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
                  <Card>
                    <CardHeader>
                      <Plus className="size-5 text-primary" />
                      <CardTitle>Create event</CardTitle>
                      <CardDescription>Create a simple attendance event with a shareable code.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleCreateAttendanceEvent} className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="eventTitle">Event name</Label>
                          <Input
                            id="eventTitle"
                            value={eventTitle}
                            onChange={(event) => setEventTitle(event.target.value)}
                            placeholder="School demo"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="eventLocation">Location</Label>
                          <Input
                            id="eventLocation"
                            value={eventLocation}
                            onChange={(event) => setEventLocation(event.target.value)}
                            placeholder="School or venue"
                          />
                        </div>
                        <div className="grid gap-3">
                          <EventDateTimeField
                            id="eventStartsAt"
                            label="Starts"
                            value={eventStartsAt}
                            onChange={setEventStartsAt}
                          />
                          <EventDateTimeField
                            id="eventEndsAt"
                            label="Ends"
                            value={eventEndsAt}
                            onChange={setEventEndsAt}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="eventCodeDraft">Code</Label>
                          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                            <Input
                              id="eventCodeDraft"
                              value={eventCodeDraft}
                              onChange={(event) => setEventCodeDraft(normalizeAttendanceCode(event.target.value))}
                              className="font-mono"
                            />
                            <Button type="button" variant="outline" onClick={() => setEventCodeDraft(randomShopCode())}>
                              Generate
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="eventDescription">Notes</Label>
                          <Textarea
                            id="eventDescription"
                            value={eventDescription}
                            onChange={(event) => setEventDescription(event.target.value)}
                            placeholder="Optional event notes"
                          />
                        </div>
                        <Button type="submit" disabled={isEventBusy}>
                          {isEventBusy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                          Create event
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  <div className="space-y-5">
                    <Card>
                      <CardHeader>
                        <CalendarDays className="size-5 text-primary" />
                        <CardTitle>Events</CardTitle>
                        <CardDescription>Pick an event to view attendees or regenerate its code.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {attendanceEvents === undefined && (
                          <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading events...</div>
                        )}
                        {attendanceEvents && attendanceEventRows.length === 0 && (
                          <div className="rounded-md border p-4 text-sm text-muted-foreground">No attendance events yet.</div>
                        )}
                        {attendanceEventRows.map((event) => (
                          <button
                            key={event._id}
                            type="button"
                            onClick={() => {
                              setSelectedEventId(event._id);
                              setEventCheckInUserId("");
                              setEventCheckInSearch("");
                            }}
                            className={cn(
                              "grid w-full gap-2 rounded-md border p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground sm:grid-cols-[1fr_auto] sm:items-center",
                              selectedEventId === event._id && "border-primary/30 bg-primary/10",
                            )}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">{event.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {event.location || "No location"}
                                {event.startsAt ? ` - ${formatDateTime(event.startsAt)}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                              <Badge variant={event.status === "active" ? "default" : "outline"}>{event.status}</Badge>
                              <Badge variant="outline">{event.attendanceCount} attending</Badge>
                            </div>
                          </button>
                        ))}
                      </CardContent>
                    </Card>

                    {selectedAttendanceEvent && (
                      <Card>
                        <CardHeader>
                          <CardTitle>{selectedAttendanceEvent.title}</CardTitle>
                          <CardDescription>
                            {selectedAttendanceEvent.location || "No location"}
                            {selectedAttendanceEvent.startsAt ? ` - ${formatDateTime(selectedAttendanceEvent.startsAt)}` : ""}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-md border p-4">
                              <p className="text-sm text-muted-foreground">Attendees</p>
                              <p className="mt-1 text-2xl font-semibold">{selectedEventRecords.length}</p>
                            </div>
                            <div className="rounded-md border p-4">
                              <p className="text-sm text-muted-foreground">Status</p>
                              <p className="mt-1 text-2xl font-semibold capitalize">{selectedAttendanceEvent.status}</p>
                            </div>
                            <div className="rounded-md border p-4">
                              <p className="text-sm text-muted-foreground">Code</p>
                              <p className="mt-1 font-mono text-2xl font-semibold">
                                {selectedAttendanceEvent.code ?? (selectedAttendanceEvent.hasCode ? "Set" : "None")}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <div className="grid min-w-64 flex-1 gap-2 sm:grid-cols-[1fr_auto]">
                              <Input
                                value={selectedEventCodeDraft}
                                onChange={(event) => setSelectedEventCodeDraft(normalizeAttendanceCode(event.target.value))}
                                placeholder={selectedAttendanceEvent.code ?? "Enter event code"}
                                className="font-mono"
                                aria-label="Set event code"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => void handleSetSelectedEventCode(selectedAttendanceEvent._id)}
                                disabled={isEventBusy}
                              >
                                Save code
                              </Button>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void handleGenerateEventCode(selectedAttendanceEvent._id)}
                              disabled={isEventBusy}
                            >
                              <TimerReset className="size-4" />
                              Generate code
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                void handleEventStatus(
                                  selectedAttendanceEvent,
                                  selectedAttendanceEvent.status === "active" ? "closed" : "active",
                                )
                              }
                              disabled={isEventBusy}
                            >
                              {selectedAttendanceEvent.status === "active" ? "Close event" : "Reopen event"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                downloadCsv("event-attendance.csv", [
                                  ["Event", "Student", "Checked in", "Group", "Program", "Graduation Year"],
                                  ...selectedEventRecords.map((record) => [
                                    record.eventTitle,
                                    record.studentName,
                                    formatDateTime(record.checkedInAt),
                                    record.studentGroup ?? "",
                                    record.primaryProgram ?? "",
                                    record.graduationYear ? String(record.graduationYear) : "",
                                  ]),
                                ])
                              }
                            >
                              <Download className="size-4" />
                              Export CSV
                            </Button>
                          </div>
                          <div className="grid gap-3 rounded-md border bg-muted/30 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
                            <div className="relative space-y-2">
                              <Label htmlFor="eventCheckInSearch">Check in without a code</Label>
                              <Input
                                id="eventCheckInSearch"
                                value={eventCheckInSearch}
                                onChange={(event) => {
                                  setEventCheckInSearch(event.target.value);
                                  setEventCheckInUserId("");
                                  setIsEventCheckInSearchOpen(true);
                                }}
                                onFocus={() => setIsEventCheckInSearchOpen(true)}
                                onBlur={() => window.setTimeout(() => setIsEventCheckInSearchOpen(false), 120)}
                                placeholder="Search by name, team, or graduation year"
                                autoComplete="off"
                                disabled={selectedAttendanceEvent.status !== "active"}
                              />
                              {isEventCheckInSearchOpen && (
                                <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
                                  {eventCheckInResults.length === 0 ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">No people found.</div>
                                  ) : (
                                    eventCheckInResults.map((person) => (
                                      <button
                                        key={person.userId}
                                        type="button"
                                        className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => {
                                          setEventCheckInUserId(person.userId);
                                          setEventCheckInSearch(person.name);
                                          setIsEventCheckInSearchOpen(false);
                                        }}
                                      >
                                        <span className="min-w-0">
                                          <span className="block truncate font-medium">{person.name}</span>
                                          <span className="block truncate text-xs text-muted-foreground">
                                            {person.studentGroup ?? person.role}
                                            {person.graduationYear ? ` - ${person.graduationYear}` : ""}
                                          </span>
                                        </span>
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                            <Button
                              type="button"
                              onClick={() => void handleEventCheckIn(selectedAttendanceEvent._id)}
                              disabled={
                                isEventCheckInBusy ||
                                selectedAttendanceEvent.status !== "active" ||
                                !eventCheckInUserId
                              }
                            >
                              {isEventCheckInBusy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                              Check in
                            </Button>
                          </div>
                          {eventCheckInSelected && (
                            <p className="text-sm text-muted-foreground">
                              Selected: <span className="font-medium text-foreground">{eventCheckInSelected.name}</span>
                            </p>
                          )}
                          <div className="space-y-2">
                            {selectedEventAttendance === undefined && (
                              <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading attendees...</div>
                            )}
                            {selectedEventAttendance && selectedEventRecords.length === 0 && (
                              <div className="rounded-md border p-4 text-sm text-muted-foreground">No students have checked in yet.</div>
                            )}
                            {selectedEventRecords.map((record) => (
                              <div key={record._id} className="grid gap-2 rounded-md border p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{record.studentName}</p>
                                  <p className="text-sm text-muted-foreground">{formatDateTime(record.checkedInAt)}</p>
                                </div>
                                <Badge variant="outline">{record.studentGroup ?? "Student"}</Badge>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleDeleteEventRecord(record._id)}
                                  disabled={isEventBusy}
                                >
                                  <Trash2 className="size-4" />
                                  Remove
                                </Button>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
              </div>
            </TabsContent>
          )}

          {canUseStudentCheckIn && (
            <TabsContent value="checkin" className="space-y-5">
              {myAttendance && (
                <Card className="border-primary/25 bg-primary/[0.04]">
                  <CardContent className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Signed in to the shop</p>
                      <p className="font-heading text-3xl font-semibold tracking-tight text-foreground tabular-nums">
                        {formatLiveDuration(myAttendance.signInAt, now || Date.now())}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Since {formatTime(myAttendance.signInAt)} · no code needed to sign out
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="lg"
                      onClick={() => void handleSignOutOfShop()}
                      disabled={isAttendanceBusy}
                    >
                      {isAttendanceBusy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                      Sign out
                    </Button>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>{myAttendance ? "Event code" : "Enter your code"}</CardTitle>
                  <CardDescription>
                    {myAttendance
                      ? "Have an event code? Enter it here to check in to an event."
                      : "Scan the QR code on the shop display, or type the code shown."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <Label htmlFor="attendanceCode" className="sr-only">
                      Attendance code
                    </Label>
                    <Input
                      id="attendanceCode"
                      value={attendanceCode}
                      onChange={(event) => setAttendanceCode(normalizeAttendanceCode(event.target.value))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void handleStudentAttendance();
                        }
                      }}
                      placeholder="ABC123"
                      autoComplete="off"
                      autoCapitalize="characters"
                      className="h-16 rounded-lg text-center font-mono text-3xl font-semibold tracking-[0.35em] sm:h-20 sm:text-4xl"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => setIsScanning((value) => !value)}
                      >
                        <Camera className="size-4" />
                        {isScanning ? "Stop scanning" : "Scan QR"}
                      </Button>
                      <Button
                        type="button"
                        size="lg"
                        onClick={() => void handleStudentAttendance()}
                        disabled={isAttendanceBusy || !attendanceCode}
                      >
                        {isAttendanceBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        Use code
                      </Button>
                    </div>
                  </div>
                  {isScanning && (
                    <div className="overflow-hidden rounded-md border bg-black">
                      <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
                    </div>
                  )}
                  <p className="text-center text-xs text-muted-foreground">
                    {myAttendance
                      ? "Event codes mark you attended. Shop codes sign you in when you're not already signed in."
                      : "Shop codes sign you in. Event codes mark you attended."}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canManage && (
            <TabsContent value="live">
              <Card>
                <CardHeader>
                  <Users className="size-5 text-primary" />
                  <CardTitle>Currently signed in</CardTitle>
                  <CardDescription>{current?.session ? "Live shop roster." : "No active shop session."}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 rounded-md border bg-muted/30 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="relative space-y-2">
                      <Label htmlFor="liveSignInSearch">Add student without a code</Label>
                      <Input
                        id="liveSignInSearch"
                        value={liveSignInSearch}
                        onChange={(event) => {
                          setLiveSignInSearch(event.target.value);
                          setLiveSignInUserId("");
                          setIsLiveSignInSearchOpen(true);
                        }}
                        onFocus={() => setIsLiveSignInSearchOpen(true)}
                        onBlur={() => window.setTimeout(() => setIsLiveSignInSearchOpen(false), 120)}
                        placeholder="Search by name, team, or graduation year"
                        autoComplete="off"
                        disabled={!current?.session}
                      />
                      {!current?.session && (
                        <p className="text-xs text-muted-foreground">Start a shop session first.</p>
                      )}
                      {isLiveSignInSearchOpen && (
                        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
                          {liveSignInResults.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">No students found.</div>
                          ) : (
                            liveSignInResults.map((person) => (
                              <button
                                key={person.userId}
                                type="button"
                                className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setLiveSignInUserId(person.userId);
                                  setLiveSignInSearch(person.name);
                                  setIsLiveSignInSearchOpen(false);
                                }}
                              >
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">{person.name}</span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {person.studentGroup ?? person.role}
                                    {person.graduationYear ? ` - ${person.graduationYear}` : ""}
                                  </span>
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={() => void handleLiveSignIn()}
                      disabled={isLiveSignInBusy || !current?.session || !liveSignInUserId}
                    >
                      {isLiveSignInBusy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      Sign in
                    </Button>
                  </div>
                  {liveSignInSelected && (
                    <p className="text-sm text-muted-foreground">
                      Selected: <span className="font-medium text-foreground">{liveSignInSelected.name}</span>
                    </p>
                  )}
                  {openRows.length === 0 && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">No students are currently signed in.</div>
                  )}
                  {openRows.map((row) => (
                    <div key={row._id} className="grid gap-3 rounded-md border p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.studentName}</p>
                        <p className="text-sm text-muted-foreground">{row.studentGroup ?? row.studentRole}</p>
                      </div>
                      <Badge variant={row.status === "needs_review" ? "secondary" : "outline"}>{row.status === "open" ? "Signed in" : "Needs review"}</Badge>
                      <span className="text-sm text-muted-foreground">{formatTime(row.signInAt)}</span>
                      {row.status === "open" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleLiveSignOut(row._id)}
                          disabled={busyRecordId === row._id}
                        >
                          {busyRecordId === row._id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <LogOut className="size-4" />
                          )}
                          Sign out
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canManage && (
            <TabsContent value="review" className="space-y-5">
              <Card>
                <CardHeader>
                  <ShieldCheck className="size-5 text-primary" />
                  <CardTitle>Review queue</CardTitle>
                  <CardDescription>Approve corrected hours or void records that should not count.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {reviewRows.length === 0 && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">No attendance records need review.</div>
                  )}
                  {reviewRows.map((record) => (
                    <ReviewRecord
                      key={record._id}
                      record={record}
                      isBusy={busyRecordId === record._id}
                      onReview={(args) => void handleReview(args)}
                    />
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Plus className="size-5 text-primary" />
                  <CardTitle>Manual correction</CardTitle>
                  <CardDescription>Add a reviewed attendance record for a missed punch.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleManualCorrection} className="grid gap-3 lg:grid-cols-[1fr_190px_190px_1fr_auto] lg:items-end">
                    <div className="space-y-2">
                      <Label>Person</Label>
                      <Select value={manualUserId} onValueChange={setManualUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose person" />
                        </SelectTrigger>
                        <SelectContent>
                          {(people ?? []).map((person) => (
                            <SelectItem key={person.userId} value={person.userId}>
                              {person.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>In</Label>
                      <Input type="datetime-local" value={manualIn} onChange={(event) => setManualIn(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Out</Label>
                      <Input type="datetime-local" value={manualOut} onChange={(event) => setManualOut(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Note</Label>
                      <Input value={manualNote} onChange={(event) => setManualNote(event.target.value)} placeholder="Reason" />
                    </div>
                    <Button type="submit">
                      <Plus className="size-4" />
                      Add
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {canManage && (
            <TabsContent value="reports" className="space-y-5">
              <Card>
                <CardHeader>
                  <ClipboardList className="size-5 text-primary" />
                  <CardTitle>Hours report</CardTitle>
                  <CardDescription>Total reviewed and provisional shop time.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-2">
                      <Label>From</Label>
                      <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>To</Label>
                      <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        downloadCsv("shop-hours.csv", [
                          ["Student", "Status", "Source", "Sign in", "Sign out", "Minutes", "Hours"],
                          ...reportRows.map((row) => {
                            const minutes = minutesBetween(row.signInAt, row.signOutAt);

                            return [
                              row.studentName,
                              row.status,
                              row.source,
                              formatDateTime(row.signInAt),
                              formatDateTime(row.signOutAt),
                              String(minutes),
                              (minutes / 60).toFixed(2),
                            ];
                          }),
                        ])
                      }
                    >
                      <Download className="size-4" />
                      Export CSV
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border p-4">
                      <p className="text-sm text-muted-foreground">People</p>
                      <p className="mt-1 text-2xl font-semibold">{reportTotals.length}</p>
                    </div>
                    <div className="rounded-md border p-4">
                      <p className="text-sm text-muted-foreground">Records</p>
                      <p className="mt-1 text-2xl font-semibold">{reportRows.length}</p>
                    </div>
                    <div className="rounded-md border p-4">
                      <p className="text-sm text-muted-foreground">Total hours</p>
                      <p className="mt-1 text-2xl font-semibold">{formatHours(totalReportMinutes)}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {reportTotals.map((total) => (
                      <div key={total.userId} className="grid gap-2 rounded-md border p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                        <p className="font-medium">{total.studentName}</p>
                        <Badge variant={total.needsReviewMinutes > 0 ? "secondary" : "outline"}>
                          {total.sessionCount} record{total.sessionCount === 1 ? "" : "s"}
                        </Badge>
                        <p className="text-sm font-medium">{formatHours(total.minutes)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

        </Tabs>
        )}
      </Authenticated>
    </div>
  );
}

export function SlackLinkPage() {
  const { signOut } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [tokenHash, setTokenHash] = useState<string | null>(null);
  const preview = useQuery(
    api.shopAttendance.getSlackLinkPreview,
    token && tokenHash ? { tokenHash } : "skip",
  );
  const linkSlack = useMutation(api.shopAttendance.linkMySlackAccount);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    if (token) {
      void sha256Hex(token).then(setTokenHash);
    }
  }, [token]);

  async function handleLink() {
    if (!tokenHash) {
      return;
    }

    setIsLinking(true);

    try {
      await linkSlack({ tokenHash });
      toast.success("Slack account linked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not link Slack");
    } finally {
      setIsLinking(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading
        eyebrow="Shop Attendance"
        title="Link Slack"
        description="Connect your Slack identity to your Dolphin Apps account."
      />
      <Card>
        <CardHeader>
          <LinkIcon className="size-5 text-primary" />
          <CardTitle>{preview ? "Ready to link" : "Slack link"}</CardTitle>
          <CardDescription>
            {preview
              ? `Slack user ${preview.slackUserName ?? preview.slackUserId}`
              : "This link may be expired or missing."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token && (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">No Slack link token was provided.</div>
          )}
          {token && preview === undefined && (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">Checking Slack link...</div>
          )}
          {token && preview === null && (
            <div className="space-y-3 rounded-md border p-4 text-sm text-muted-foreground">
              <p>This Slack link is expired or already used.</p>
              <p>
                Go back to Slack and run <span className="font-mono text-foreground">/shop in CODE</span> or{" "}
                <span className="font-mono text-foreground">/shop out CODE</span> again to get a fresh link.
              </p>
            </div>
          )}
          {!isLoading && !isAuthenticated && (
            <Button asChild>
              <Link to={`/auth?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`}>
                <KeyRound className="size-4" />
                Sign in to Dolphin Apps
              </Link>
            </Button>
          )}
          {isAuthenticated && viewer && preview && (
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={() => void handleLink()} disabled={isLinking}>
                {isLinking ? <Loader2 className="size-4 animate-spin" /> : <ArrowLeftRight className="size-4" />}
                Link to {viewer.profile.displayName ?? viewer.user.name ?? "my account"}
              </Button>
              <Button type="button" variant="outline" onClick={() => void signOut()}>
                Switch account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
