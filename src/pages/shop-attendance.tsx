import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useAction, useMutation, useQuery } from "convex/react";
import QRCode from "qrcode";
import {
  ArrowLeftRight,
  Camera,
  Check,
  ClipboardList,
  Clock,
  Download,
  KeyRound,
  Link as LinkIcon,
  Loader2,
  LockKeyhole,
  Maximize2,
  MessageSquare,
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
  const [searchParams] = useSearchParams();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const canManage =
    effectiveRole === "admin" || effectiveRole === "mentor" || effectiveRole === "instructor";
  const canDisplayRole = canManage || effectiveRole === "kiosk";
  const canUseStudentCheckIn = effectiveRole !== "kiosk";
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
  const slackLink = useQuery(api.shopAttendance.mySlackLink, isAuthenticated ? {} : "skip");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [isStudentSearchOpen, setIsStudentSearchOpen] = useState(false);
  const [recordFromDate, setRecordFromDate] = useState("");
  const [recordToDate, setRecordToDate] = useState("");
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
  const endShopSession = useMutation(api.shopAttendance.endShopSession);
  const generateCode = useMutation(api.shopAttendance.generateOrReadCurrentCode);
  const signInWithCode = useMutation(api.shopAttendance.signInWithCode);
  const signOutWithCode = useMutation(api.shopAttendance.signOutWithCode);
  const reviewAttendance = useMutation(api.shopAttendance.reviewAttendanceSession);
  const deleteAttendance = useMutation(api.shopAttendance.deleteAttendanceSession);
  const createManualAttendance = useMutation(api.shopAttendance.createManualAttendanceSession);
  const notifyClosed = useAction(api.shopSlack.notifyShopSessionClosed);
  const [shopTitle, setShopTitle] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const [displayCode, setDisplayCode] = useState("");
  const [displayCodeExpiresAt, setDisplayCodeExpiresAt] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [busyRecordId, setBusyRecordId] = useState<string | null>(null);
  const [manualUserId, setManualUserId] = useState("");
  const [manualIn, setManualIn] = useState("");
  const [manualOut, setManualOut] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [now, setNow] = useState(0);
  const [attendanceCode, setAttendanceCode] = useState(
    searchParams.get("code")?.trim().toUpperCase() ?? "",
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
  }, [current, generateCode]);

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

  async function handleEndSession() {
    try {
      const result = await endShopSession({ note: closingNote.trim() || undefined });
      setClosingNote("");
      void notifyClosed(result);
      toast.success(
        result.flaggedCount > 0
          ? `Shop closed. ${result.flaggedCount} record needs review.`
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

  async function handleStudentAttendance(action: "in" | "out") {
    const code = attendanceCode.trim().toUpperCase();

    if (!code) {
      toast.error("Enter or scan the current shop code.");
      return;
    }

    setIsAttendanceBusy(true);

    try {
      if (action === "in") {
        await signInWithCode({ code });
        setAttendanceCode("");
        toast.success("Signed in to the shop");
      } else {
        await signOutWithCode({ code });
        setAttendanceCode("");
        toast.success("Signed out of the shop");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update attendance");
    } finally {
      setIsAttendanceBusy(false);
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
                  <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-end">
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
                                    {person.studentGroup ?? "Student"}
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
                    <Button asChild variant="outline">
                      <Link to="/shop">
                        <ArrowLeftRight className="size-4" />
                        Shop
                      </Link>
                    </Button>
                  </div>
                  {selectedStudentUserId && (showRecordsRoute || showReportsRoute) && (
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
                        <Button asChild variant="outline">
                          <Link to={routeBase}>
                            <Users className="size-4" />
                            All students
                          </Link>
                        </Button>
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
                    <div className="grid gap-3 sm:grid-cols-3">
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
                <div className="space-y-3">
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
                          <span>{person.studentGroup ?? "Student"}</span>
                          {person.graduationYear && <span>{person.graduationYear}</span>}
                          {person.primaryProgram && <span>{person.primaryProgram}</span>}
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
        <Tabs defaultValue={canDisplayRole ? "display" : "checkin"} className="space-y-5">
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            {canDisplayRole && (
              <TabsTrigger value="display">
                <Monitor className="size-4" />
                Display
              </TabsTrigger>
            )}
            {canManage && (
              <>
                <TabsTrigger value="live">
                  <Users className="size-4" />
                  Live
                </TabsTrigger>
                <TabsTrigger value="review" asChild>
                  <Link to="/shop/review">
                    <ShieldCheck className="size-4" />
                    Review
                  </Link>
                </TabsTrigger>
                <TabsTrigger value="reports" asChild>
                  <Link to="/shop/reports">
                    <ClipboardList className="size-4" />
                    Reports
                  </Link>
                </TabsTrigger>
              </>
            )}
            {canUseStudentCheckIn && (
              <TabsTrigger value="checkin">
                <QrCode className="size-4" />
                Check in/out
              </TabsTrigger>
            )}
            {canUseStudentCheckIn && (
              <TabsTrigger value="slack">
                <MessageSquare className="size-4" />
                Slack
              </TabsTrigger>
            )}
          </TabsList>

          {canDisplayRole && (
            <TabsContent value="display" className="space-y-5">
              <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
                <section className="space-y-5">
                  <Card>
                    <CardHeader>
                      <Clock className="size-5 text-primary" />
                      <CardTitle>Shop session</CardTitle>
                      <CardDescription>
                        {current?.session
                          ? `Opened ${formatDateTime(current.session.openedAt)}`
                          : "No active shop session."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!current?.session && canManage ? (
                        <form onSubmit={handleStartSession} className="flex flex-col gap-3 sm:flex-row">
                          <Input
                            value={shopTitle}
                            onChange={(event) => setShopTitle(event.target.value)}
                            placeholder="Optional session title"
                          />
                          <Button type="submit">
                            <Clock className="size-4" />
                            Start session
                          </Button>
                        </form>
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
                          {current?.session
                            ? "This kiosk can display the code, but only mentors and admins can close or review sessions."
                            : "No active shop session. Ask a mentor to start one from a manager account."}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <MessageSquare className="size-5 text-primary" />
                      <CardTitle>Slack command</CardTitle>
                      <CardDescription>Students use the current code with the shop command.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-md border bg-muted/30 p-4 font-mono text-sm">/shop in {activeDisplayCode || "CODE"}</div>
                        <div className="rounded-md border bg-muted/30 p-4 font-mono text-sm">/shop out {activeDisplayCode || "CODE"}</div>
                      </div>
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

          {canUseStudentCheckIn && (
            <TabsContent value="checkin">
              <Card>
                <CardHeader>
                  <QrCode className="size-5 text-primary" />
                  <CardTitle>Website check-in</CardTitle>
                  <CardDescription>
                    {myAttendance
                      ? `Signed in since ${formatTime(myAttendance.signInAt)}.`
                      : "Scan the shop QR with your camera or type the current code."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
                    <div className="space-y-2">
                      <Label htmlFor="attendanceCode">Shop code</Label>
                      <Input
                        id="attendanceCode"
                        value={attendanceCode}
                        onChange={(event) => setAttendanceCode(event.target.value.toUpperCase())}
                        placeholder="ABC123"
                        className="font-mono text-lg"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsScanning((value) => !value)}
                    >
                      <Camera className="size-4" />
                      {isScanning ? "Stop scanning" : "Scan QR"}
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        onClick={() => void handleStudentAttendance("in")}
                        disabled={isAttendanceBusy || !!myAttendance}
                      >
                        {isAttendanceBusy ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
                        Sign in
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleStudentAttendance("out")}
                        disabled={isAttendanceBusy || !myAttendance}
                      >
                        <Square className="size-4" />
                        Sign out
                      </Button>
                    </div>
                  </div>
                  {isScanning && (
                    <div className="overflow-hidden rounded-md border bg-black">
                      <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
                    </div>
                  )}
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    Phone camera apps can also open the QR link directly. The code still expires quickly.
                  </div>
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
                <CardContent className="space-y-3">
                  {openRows.length === 0 && (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground">No students are currently signed in.</div>
                  )}
                  {openRows.map((row) => (
                    <div key={row._id} className="grid gap-3 rounded-md border p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.studentName}</p>
                        <p className="text-sm text-muted-foreground">{row.studentGroup ?? row.studentRole}</p>
                      </div>
                      <Badge variant={row.status === "needs_review" ? "secondary" : "outline"}>{row.status === "open" ? "Signed in" : "Needs review"}</Badge>
                      <span className="text-sm text-muted-foreground">{formatTime(row.signInAt)}</span>
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

          {canUseStudentCheckIn && (
            <TabsContent value="slack">
              <Card>
                <CardHeader>
                  <MessageSquare className="size-5 text-primary" />
                  <CardTitle>Slack attendance</CardTitle>
                  <CardDescription>
                    {slackLink
                      ? `Linked as ${slackLink.slackUserName ?? slackLink.slackUserId}.`
                      : "Link Slack from your first shop command."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border bg-muted/30 p-4 font-mono text-sm">/shop in CODE</div>
                    <div className="rounded-md border bg-muted/30 p-4 font-mono text-sm">/shop out CODE</div>
                  </div>
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    The code comes from the shop screen and expires quickly.
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
