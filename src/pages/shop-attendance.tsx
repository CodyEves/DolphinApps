import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useAction, useMutation, useQuery } from "convex/react";
import QRCode from "qrcode";
import {
  ArrowLeftRight,
  Check,
  ClipboardList,
  Clock,
  Download,
  KeyRound,
  Link as LinkIcon,
  Loader2,
  LockKeyhole,
  MessageSquare,
  Monitor,
  Plus,
  QrCode,
  ShieldCheck,
  Square,
  TimerReset,
  Users,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
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
  const bytes = new TextEncoder().encode(value.trim().toUpperCase());
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

export function ShopAttendancePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const canManage =
    effectiveRole === "admin" || effectiveRole === "mentor" || effectiveRole === "instructor";
  const current = useQuery(api.shopAttendance.currentShopSession, isAuthenticated ? {} : "skip");
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
  const report = useQuery(
    api.shopAttendance.listHoursReport,
    isAuthenticated && canManage
      ? {
          from: fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : undefined,
          to: toDate ? new Date(`${toDate}T23:59:59`).getTime() : undefined,
        }
      : "skip",
  );
  const startShopSession = useMutation(api.shopAttendance.startShopSession);
  const endShopSession = useMutation(api.shopAttendance.endShopSession);
  const generateCode = useMutation(api.shopAttendance.generateOrReadCurrentCode);
  const reviewAttendance = useMutation(api.shopAttendance.reviewAttendanceSession);
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

  async function refreshCode() {
    if (!current?.session || !current.canManage) {
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
      setQrDataUrl(await QRCode.toDataURL(code, { margin: 2, width: 256 }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate shop code");
    } finally {
      setIsGeneratingCode(false);
    }
  }

  useEffect(() => {
    if (!current?.session || !current.canManage) {
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
          setQrDataUrl(await QRCode.toDataURL(code, { margin: 2, width: 256 }));
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
    const interval = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(interval);
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

  const reportRows = useMemo(() => report?.rows ?? [], [report?.rows]);
  const reportTotals = useMemo(() => report?.totals ?? [], [report?.totals]);
  const openRows = useMemo(() => liveAttendance ?? [], [liveAttendance]);
  const reviewRows = useMemo(() => reviewQueue ?? [], [reviewQueue]);
  const activeDisplayCode = current?.session ? displayCode : "";
  const activeQrDataUrl = current?.session ? qrDataUrl : "";
  const codeSecondsRemaining = Math.max(0, Math.ceil((displayCodeExpiresAt - now) / 1000));
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
              <Link to="/auth">
                <KeyRound className="size-4" />
                Sign in
              </Link>
            </Button>
          </CardContent>
        </Card>
      </Unauthenticated>

      <Authenticated>
        <Tabs defaultValue={canManage ? "display" : "slack"} className="space-y-5">
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            {canManage && (
              <>
                <TabsTrigger value="display">
                  <Monitor className="size-4" />
                  Display
                </TabsTrigger>
                <TabsTrigger value="live">
                  <Users className="size-4" />
                  Live
                </TabsTrigger>
                <TabsTrigger value="review">
                  <ShieldCheck className="size-4" />
                  Review
                </TabsTrigger>
                <TabsTrigger value="reports">
                  <ClipboardList className="size-4" />
                  Reports
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="slack">
              <MessageSquare className="size-4" />
              Slack
            </TabsTrigger>
          </TabsList>

          {canManage && (
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
                      {!current?.session ? (
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
                      ) : (
                        <div className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-md border p-4">
                              <p className="text-sm text-muted-foreground">Signed in</p>
                              <p className="mt-1 text-2xl font-semibold">{current.openCount}</p>
                            </div>
                            <div className="rounded-md border p-4">
                              <p className="text-sm text-muted-foreground">Needs review</p>
                              <p className="mt-1 text-2xl font-semibold">{current.needsReviewCount}</p>
                            </div>
                            <div className="rounded-md border p-4">
                              <p className="text-sm text-muted-foreground">Status</p>
                              <p className="mt-1 text-2xl font-semibold">Open</p>
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
                    <div className="grid size-72 place-items-center rounded-md border bg-white p-4">
                      {current?.session && activeQrDataUrl ? (
                        <img src={activeQrDataUrl} alt="Current shop attendance QR code" className="size-60" />
                      ) : (
                        <QrCode className="size-24 text-muted-foreground" />
                      )}
                    </div>
                    <div className="w-full rounded-md border bg-muted/40 p-5">
                      <p className="font-mono text-5xl font-semibold tracking-normal">{activeDisplayCode || "------"}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void refreshCode()}
                      disabled={!current?.session || isGeneratingCode}
                    >
                      {isGeneratingCode ? <Loader2 className="size-4 animate-spin" /> : <TimerReset className="size-4" />}
                      Rotate now
                    </Button>
                  </CardContent>
                </Card>
              </div>
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
        </Tabs>
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
            <div className="rounded-md border p-4 text-sm text-muted-foreground">This Slack link is expired or already used.</div>
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
