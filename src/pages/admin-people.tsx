import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  GraduationCap,
  KeyRound,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type AccountLabel = "varsity_5199" | "jv_9271" | "mentor" | "guest" | "kiosk" | "admin";
type AccountRole = "student" | "mentor" | "guest" | "kiosk" | "admin";
type Program = "frc_5199" | "frc_9271";
type AccountStatusFilter = "all" | "pending_setup" | "active" | "inactive";
type AccountSort = "displayName" | "accountNumber" | "username" | "program" | "graduationYear" | "status";
type GeneratedCredentialLink = {
  link: string;
  username: string;
  displayName: string;
  accountNumber?: string;
  purpose: "initial_setup" | "password_reset";
};

const accountLabelText: Record<AccountLabel, string> = {
  varsity_5199: "5199 Student",
  jv_9271: "9271 Student",
  mentor: "Mentor",
  guest: "Guest",
  kiosk: "Shop Kiosk",
  admin: "Admin",
};

const programText: Record<Program, string> = {
  frc_5199: "5199",
  frc_9271: "9271",
};

function roleForAccountLabel(accountLabel: AccountLabel): AccountRole {
  if (
    accountLabel === "mentor" ||
    accountLabel === "guest" ||
    accountLabel === "kiosk" ||
    accountLabel === "admin"
  ) {
    return accountLabel;
  }

  return "student";
}

function programForAccountLabel(accountLabel: AccountLabel): Program {
  return accountLabel === "jv_9271" ? "frc_9271" : "frc_5199";
}

function programTextForAccountLabel(accountLabel: AccountLabel): string {
  if (roleForAccountLabel(accountLabel) !== "student") {
    return "";
  }

  return programText[programForAccountLabel(accountLabel)];
}

function accountLabelFor(role: AccountRole, program: Program): AccountLabel {
  if (role === "student") {
    return program === "frc_9271" ? "jv_9271" : "varsity_5199";
  }

  return role;
}

function normalizeProgram(value: string | undefined): Program {
  const normalized = (value ?? "").trim().toLowerCase();

  if (normalized === "9271" || normalized === "frc_9271" || normalized === "jv") {
    return "frc_9271";
  }

  return "frc_5199";
}

function normalizeRole(value: string | undefined, accountLabel: AccountLabel): AccountRole {
  const normalized = (value ?? "").trim().toLowerCase();

  if (normalized === "mentor" || normalized === "guest" || normalized === "kiosk" || normalized === "admin") {
    return normalized;
  }

  return roleForAccountLabel(accountLabel);
}

const setupDurationMs = 14 * 24 * 60 * 60 * 1000;
const resetDurationMs = 24 * 60 * 60 * 1000;

function expiresAtFromNow(durationMs: number) {
  return new Date().getTime() + durationMs;
}

async function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function setupLink(token: string) {
  return `${window.location.origin}/auth/setup?token=${encodeURIComponent(token)}`;
}

function resetLink(token: string) {
  return `${window.location.origin}/auth/reset?token=${encodeURIComponent(token)}`;
}

function parseCsvRows(csv: string) {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(",").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));

    const fallbackAccountLabel = (record.accountLabel || "varsity_5199") as AccountLabel;
    const role = normalizeRole(record.role, fallbackAccountLabel);
    const program = normalizeProgram(record.program || record.team || record.teamNumber);

    const firstName = record.firstName || record.first || "";
    const lastName = record.lastName || record.last || "";

    return {
      firstName,
      lastName,
      displayName: record.displayName || record.name || [firstName, lastName].filter(Boolean).join(" "),
      accountLabel: record.accountLabel
        ? fallbackAccountLabel
        : accountLabelFor(role, program),
      graduationYear: record.graduationYear ? Number(record.graduationYear) : undefined,
    };
  });
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
  toast.success("Copied account details");
}

function credentialShareText(details: GeneratedCredentialLink) {
  const action =
    details.purpose === "initial_setup"
      ? "Use this one-time setup link to create your password."
      : "Use this one-time reset link to choose a new password.";

  return [
    `Dolphin Apps account for ${details.displayName}`,
    ...(details.accountNumber ? [`Account ID: ${details.accountNumber}`] : []),
    `Username: ${details.username}`,
    action,
    details.link,
  ].join("\n");
}

function accountStatusText(status: "pending_setup" | "active" | "inactive") {
  return status.replace("_", " ");
}

function formatShortDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

function splitDisplayName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export function AdminPeoplePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const isAdmin = viewer?.profile.role === "admin" && viewer.profile.status === "active";
  const users = useQuery(
    api.profiles.listUsersForAdmin,
    isAuthenticated && isAdmin ? {} : "skip",
  );
  const accounts = useQuery(
    api.access.listProvisionedAccountsForAdmin,
    isAuthenticated && isAdmin ? {} : "skip",
  );
  const setAccountLabel = useMutation(api.profiles.setAccountLabel);
  const createProvisionedAccount = useMutation(api.access.createProvisionedAccount);
  const bulkCreateProvisionedAccounts = useMutation(api.access.bulkCreateProvisionedAccounts);
  const createCredentialLink = useMutation(api.access.createCredentialLink);
  const updateProvisionedAccount = useMutation(api.access.updateProvisionedAccount);
  const syncMyProvisionedProfile = useMutation(api.access.syncMyProvisionedProfile);
  const assignMissingAccountNumbers = useMutation(api.access.assignMissingAccountNumbers);
  const deactivateGraduationYear = useMutation(api.access.deactivateGraduationYear);
  const revokeCredentialLink = useMutation(api.access.revokeCredentialLink);
  const deactivateAccount = useMutation(api.access.deactivateAccount);
  const reactivateAccount = useMutation(api.access.reactivateAccount);
  const clearLegacyProfile = useMutation(api.profiles.clearLegacyProfile);
  const clearLegacyProfiles = useMutation(api.profiles.clearLegacyProfiles);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [accountRole, setAccountRole] = useState<AccountRole>("student");
  const [program, setProgram] = useState<Program>("frc_5199");
  const [graduationYear, setGraduationYear] = useState("");
  const [graduatingYear, setGraduatingYear] = useState("");
  const [graduatingProgram, setGraduatingProgram] = useState<Program | "all">("all");
  const [csv, setCsv] = useState("firstName,lastName,role,program,graduationYear\n");
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, GeneratedCredentialLink>>({});
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [isAssigningAccountNumbers, setIsAssigningAccountNumbers] = useState(false);
  const [isGraduating, setIsGraduating] = useState(false);
  const [clearingProfileId, setClearingProfileId] = useState<string | null>(null);
  const [isClearingLegacyProfiles, setIsClearingLegacyProfiles] = useState(false);
  const [isRefreshingAdminAccess, setIsRefreshingAdminAccess] = useState(false);
  const hasTriedAdminRefresh = useRef(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<AccountRole | "all">("all");
  const [programFilter, setProgramFilter] = useState<Program | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AccountStatusFilter>("all");
  const [graduationFilter, setGraduationFilter] = useState("");
  const [sortBy, setSortBy] = useState<AccountSort>("displayName");
  const [selectedAccountId, setSelectedAccountId] = useState<Id<"provisionedAccounts"> | null>(null);
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState(false);
  const [pageSize, setPageSize] = useState("50");
  const [pageIndex, setPageIndex] = useState(0);
  const createdLinks = useMemo(() => Object.entries(generatedLinks), [generatedLinks]);
  const canRefreshAdminAccess =
    !isAdmin &&
    (
      (viewer?.profile.role === "admin" && viewer.profile.status !== "active") ||
      (
        viewer?.provisionedAccount?.accountLabel === "admin" &&
        viewer.provisionedAccount.status === "active"
      )
    );
  const accountStats = useMemo(() => {
    const list = accounts ?? [];

    return {
      total: list.length,
      active: list.filter((account) => account.status === "active").length,
      pending: list.filter((account) => account.status === "pending_setup").length,
      inactive: list.filter((account) => account.status === "inactive").length,
    };
  }, [accounts]);
  const missingAccountNumberCount = useMemo(
    () => (accounts ?? []).filter((account) => !account.accountNumber).length,
    [accounts],
  );
  const filteredAccounts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const graduationSearch = graduationFilter.trim();

    return [...(accounts ?? [])]
      .filter((account) => {
        const accountLabel = account.accountLabel as AccountLabel;
        const role = roleForAccountLabel(accountLabel);
        const accountProgram = programForAccountLabel(accountLabel);
        const searchable = [
          account.displayName,
          account.firstName ?? "",
          account.lastName ?? "",
          account.accountNumber ?? "",
          account.username,
          accountLabelText[accountLabel],
          account.status,
          account.graduationYear?.toString() ?? "",
          role,
          programTextForAccountLabel(accountLabel),
        ]
          .join(" ")
          .toLowerCase();

        if (normalizedSearch && !searchable.includes(normalizedSearch)) {
          return false;
        }

        if (roleFilter !== "all" && role !== roleFilter) {
          return false;
        }

        if (programFilter !== "all" && (role !== "student" || accountProgram !== programFilter)) {
          return false;
        }

        if (statusFilter !== "all" && account.status !== statusFilter) {
          return false;
        }

        if (graduationSearch && String(account.graduationYear ?? "") !== graduationSearch) {
          return false;
        }

        return true;
      })
      .sort((first, second) => {
        const firstLabel = first.accountLabel as AccountLabel;
        const secondLabel = second.accountLabel as AccountLabel;

        if (sortBy === "graduationYear") {
          return (first.graduationYear ?? Number.MAX_SAFE_INTEGER) - (second.graduationYear ?? Number.MAX_SAFE_INTEGER);
        }

        const firstValue =
          sortBy === "program"
            ? programTextForAccountLabel(firstLabel)
            : sortBy === "status"
              ? first.status
              : sortBy === "accountNumber"
                ? first.accountNumber ?? ""
              : first[sortBy];
        const secondValue =
          sortBy === "program"
            ? programTextForAccountLabel(secondLabel)
            : sortBy === "status"
              ? second.status
              : sortBy === "accountNumber"
                ? second.accountNumber ?? ""
              : second[sortBy];

        return String(firstValue ?? "").localeCompare(String(secondValue ?? ""), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [accounts, graduationFilter, programFilter, roleFilter, searchTerm, sortBy, statusFilter]);
  const selectedAccount = useMemo(
    () => accounts?.find((account) => account._id === selectedAccountId),
    [accounts, selectedAccountId],
  );
  const numericPageSize = Number(pageSize);
  const pageCount = Math.max(1, Math.ceil(filteredAccounts.length / numericPageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const paginatedAccounts = filteredAccounts.slice(
    safePageIndex * numericPageSize,
    safePageIndex * numericPageSize + numericPageSize,
  );
  const pageStart = filteredAccounts.length === 0 ? 0 : safePageIndex * numericPageSize + 1;
  const pageEnd = Math.min(filteredAccounts.length, safePageIndex * numericPageSize + paginatedAccounts.length);

  async function handleRefreshAdminAccess() {
    setIsRefreshingAdminAccess(true);

    try {
      const synced = await syncMyProvisionedProfile({});
      toast.success(
        synced.role === "admin"
          ? "Admin access refreshed"
          : "Team profile refreshed",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to refresh admin access");
    } finally {
      setIsRefreshingAdminAccess(false);
    }
  }

  useEffect(() => {
    if (!canRefreshAdminAccess || hasTriedAdminRefresh.current) {
      return;
    }

    hasTriedAdminRefresh.current = true;
    void handleRefreshAdminAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRefreshAdminAccess]);

  function openAccountSheet(provisionedAccountId: Id<"provisionedAccounts">) {
    setSelectedAccountId(provisionedAccountId);
    setIsAccountSheetOpen(true);
  }

  async function handleSetAccountLabel(
    userId: Id<"users">,
    nextAccountLabel: AccountLabel,
  ) {
    setSavingUserId(userId);

    try {
      await setAccountLabel({ userId, accountLabel: nextAccountLabel });
      toast.success("User label updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update user");
    } finally {
      setSavingUserId(null);
    }
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = await randomToken();
    const tokenHash = await sha256Hex(token);

    try {
      const result = await createProvisionedAccount({
        firstName,
        lastName,
        accountLabel: accountLabelFor(accountRole, program),
        graduationYear: graduationYear ? Number(graduationYear) : undefined,
        setupTokenHash: tokenHash,
        setupExpiresAt: expiresAtFromNow(setupDurationMs),
      });
      const link = setupLink(token);
      const details: GeneratedCredentialLink = {
        link,
        username: result.username,
        displayName: result.displayName,
        accountNumber: result.accountNumber,
        purpose: "initial_setup",
      };
      setGeneratedLinks((current) => ({ ...current, [result.credentialLinkId]: details }));
      setFirstName("");
      setLastName("");
      setGraduationYear("");
      await copyText(credentialShareText(details));
      toast.success(`Created ${result.username}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create account");
    }
  }

  async function handleUpdateProvisionedAccount(
    provisionedAccountId: Id<"provisionedAccounts">,
    patch: {
      firstName?: string;
      lastName?: string;
      displayName?: string;
      accountLabel?: AccountLabel;
      graduationYear?: number | null;
    },
  ) {
    setBusyAccountId(provisionedAccountId);

    try {
      await updateProvisionedAccount({
        provisionedAccountId,
        ...patch,
      });
      toast.success("Account updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update account");
    } finally {
      setBusyAccountId(null);
    }
  }

  async function handleGraduateClass() {
    const year = Number(graduatingYear);

    if (!Number.isFinite(year)) {
      toast.error("Enter a graduation year.");
      return;
    }

    setIsGraduating(true);

    try {
      const result = await deactivateGraduationYear({
        graduationYear: year,
        program: graduatingProgram === "all" ? undefined : graduatingProgram,
      });
      toast.success(`Deactivated ${result.deactivatedCount} graduating students`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not graduate class");
    } finally {
      setIsGraduating(false);
    }
  }

  async function handleAssignMissingAccountNumbers() {
    setIsAssigningAccountNumbers(true);

    try {
      const result = await assignMissingAccountNumbers({});
      toast.success(`Assigned ${result.assignedCount} account IDs`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not assign account IDs");
    } finally {
      setIsAssigningAccountNumbers(false);
    }
  }

  async function handleBulkCreate() {
    const rows = parseCsvRows(csv);

    if (rows.length === 0) {
      toast.error("Paste a CSV with a header and at least one row.");
      return;
    }

    const prepared = await Promise.all(
      rows.map(async (row) => {
        const token = await randomToken();

        return {
          row,
          token,
          tokenHash: await sha256Hex(token),
        };
      }),
    );

    try {
      const result = await bulkCreateProvisionedAccounts({
        accounts: prepared.map(({ row, tokenHash }) => ({
          firstName: row.firstName,
          lastName: row.lastName,
          displayName: row.displayName,
          accountLabel: row.accountLabel,
          graduationYear: row.graduationYear,
          setupTokenHash: tokenHash,
          setupExpiresAt: expiresAtFromNow(setupDurationMs),
        })),
      });
      const links = Object.fromEntries(
        result.map((created, index) => [
          created.credentialLinkId,
          {
            link: setupLink(prepared[index].token),
            username: created.username,
            displayName: created.displayName,
            accountNumber: created.accountNumber,
            purpose: "initial_setup" as const,
          },
        ]),
      );
      setGeneratedLinks((current) => ({ ...current, ...links }));
      toast.success(`Created ${result.length} accounts`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import accounts");
    }
  }

  async function handleCreateLink(
    provisionedAccountId: Id<"provisionedAccounts">,
    purpose: "initial_setup" | "password_reset",
  ) {
    setBusyAccountId(provisionedAccountId);
    const token = await randomToken();
    const tokenHash = await sha256Hex(token);

    try {
      const result = await createCredentialLink({
        provisionedAccountId,
        purpose,
        tokenHash,
        expiresAt: expiresAtFromNow(
          purpose === "initial_setup" ? setupDurationMs : resetDurationMs,
        ),
      });
      const link = purpose === "initial_setup" ? setupLink(token) : resetLink(token);
      const account = accounts?.find((item) => item._id === provisionedAccountId);
      const details: GeneratedCredentialLink = {
        link,
        username: result.username,
        displayName: account?.displayName ?? result.username,
        accountNumber: account?.accountNumber,
        purpose,
      };
      setGeneratedLinks((current) => ({ ...current, [result.credentialLinkId]: details }));
      await copyText(credentialShareText(details));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create link");
    } finally {
      setBusyAccountId(null);
    }
  }

  async function handleToggleAccount(
    provisionedAccountId: Id<"provisionedAccounts">,
    isInactive: boolean,
  ) {
    setBusyAccountId(provisionedAccountId);

    try {
      if (isInactive) {
        await reactivateAccount({ provisionedAccountId });
        toast.success("Account reactivated");
      } else {
        await deactivateAccount({ provisionedAccountId });
        toast.success("Account deactivated");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update account");
    } finally {
      setBusyAccountId(null);
    }
  }

  async function handleClearLegacyProfile(profileId: Id<"profiles">, displayName: string) {
    const confirmed = window.confirm(
      `Clear the legacy profile for ${displayName}? This removes only the old profile row. Provisioned username accounts cannot be cleared here.`,
    );

    if (!confirmed) {
      return;
    }

    setClearingProfileId(profileId);

    try {
      await clearLegacyProfile({ profileId });
      toast.success("Legacy profile cleared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not clear profile");
    } finally {
      setClearingProfileId(null);
    }
  }

  async function handleClearLegacyProfiles() {
    const confirmed = window.confirm(
      "Clear all profiles that are not linked to provisioned username accounts? This keeps all provisioned accounts and skips your own profile.",
    );

    if (!confirmed) {
      return;
    }

    setIsClearingLegacyProfiles(true);

    try {
      const result = await clearLegacyProfiles({});
      toast.success(`Cleared ${result.clearedCount} legacy profiles`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not clear legacy profiles");
    } finally {
      setIsClearingLegacyProfiles(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeading
          eyebrow="Admin"
          title="People"
          description="Loading user management."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        eyebrow="Admin"
        title="People"
        description="Manage provisioned usernames, setup links, password recovery, and account labels."
        actions={
          <Button asChild variant="outline">
            <Link to="/management">
              <ArrowLeft className="size-4" />
              Back to admin
            </Link>
          </Button>
        }
      />

      <Unauthenticated>
        <Card>
          <CardHeader>
            <LockKeyhole className="size-5 text-primary" />
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              User management requires an authenticated admin account.
            </CardDescription>
          </CardHeader>
        </Card>
      </Unauthenticated>

      <Authenticated>
        {!isAdmin ? (
          <Card>
            <CardHeader>
              <LockKeyhole className="size-5 text-primary" />
              <CardTitle>Admin access required</CardTitle>
              <CardDescription>
                The server currently sees this profile as {viewer?.profile.role ?? "unknown"} /{" "}
                {viewer?.profile.status ?? "unknown"}.
              </CardDescription>
            </CardHeader>
            {canRefreshAdminAccess && (
              <CardContent>
                <Button
                  type="button"
                  onClick={() => void handleRefreshAdminAccess()}
                  disabled={isRefreshingAdminAccess}
                >
                  <RotateCcw className="size-4" />
                  {isRefreshingAdminAccess ? "Refreshing..." : "Refresh admin access"}
                </Button>
              </CardContent>
            )}
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="space-y-1">
                  <CardDescription>Total accounts</CardDescription>
                  <CardTitle className="text-2xl">{accountStats.total}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="space-y-1">
                  <CardDescription>Active</CardDescription>
                  <CardTitle className="text-2xl">{accountStats.active}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="space-y-1">
                  <CardDescription>Pending setup</CardDescription>
                  <CardTitle className="text-2xl">{accountStats.pending}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="space-y-1">
                  <CardDescription>Inactive</CardDescription>
                  <CardTitle className="text-2xl">{accountStats.inactive}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {createdLinks.length > 0 && (
              <Card>
                <CardHeader>
                  <Copy className="size-5 text-primary" />
                  <CardTitle>Generated links</CardTitle>
                  <CardDescription>
                    Copy these now. The app stores only token hashes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {createdLinks.map(([id, details]) => (
                    <div key={id} className="flex items-center gap-2 rounded-md border p-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{details.displayName}</p>
                          {details.accountNumber && (
                            <Badge variant="secondary" className="font-mono">
                              {details.accountNumber}
                            </Badge>
                          )}
                          <Badge variant="outline" className="font-mono">
                            {details.username}
                          </Badge>
                        </div>
                        <code className="block truncate text-xs text-muted-foreground">
                          {details.link}
                        </code>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void copyText(credentialShareText(details))}
                      >
                        <Copy className="size-4" />
                        Copy details
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="directory" className="space-y-4">
              <TabsList className="h-auto w-full flex-wrap justify-start">
                <TabsTrigger value="directory">
                  <Search className="size-4" />
                  Directory
                </TabsTrigger>
                <TabsTrigger value="provision">
                  <Plus className="size-4" />
                  Provision
                </TabsTrigger>
                <TabsTrigger value="bulk">
                  <Upload className="size-4" />
                  Bulk import
                </TabsTrigger>
                <TabsTrigger value="classes">
                  <GraduationCap className="size-4" />
                  Class tools
                </TabsTrigger>
                <TabsTrigger value="profiles">
                  <Users className="size-4" />
                  Profiles
                </TabsTrigger>
              </TabsList>

              <TabsContent value="directory" className="space-y-4">
                <Card>
                  <CardHeader>
                    <SlidersHorizontal className="size-5 text-primary" />
                    <CardTitle>Find accounts</CardTitle>
                    <CardDescription>
                      Search, filter, and sort the roster before making account changes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="peopleSearch">Search</Label>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="peopleSearch"
                          value={searchTerm}
                          onChange={(event) => {
                            setSearchTerm(event.target.value);
                            setPageIndex(0);
                          }}
                          className="pl-9"
                          placeholder="Name, ID, username, team, class..."
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={roleFilter}
                        onValueChange={(value: AccountRole | "all") => {
                          setRoleFilter(value);
                          setPageIndex(0);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All roles</SelectItem>
                          <SelectItem value="student">Students</SelectItem>
                          <SelectItem value="mentor">Mentors</SelectItem>
                          <SelectItem value="guest">Guests</SelectItem>
                          <SelectItem value="kiosk">Shop kiosks</SelectItem>
                          <SelectItem value="admin">Admins</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Program</Label>
                      <Select
                        value={programFilter}
                        onValueChange={(value: Program | "all") => {
                          setProgramFilter(value);
                          setPageIndex(0);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All programs</SelectItem>
                          <SelectItem value="frc_5199">5199</SelectItem>
                          <SelectItem value="frc_9271">9271</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={statusFilter}
                        onValueChange={(value: AccountStatusFilter) => {
                          setStatusFilter(value);
                          setPageIndex(0);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="pending_setup">Pending setup</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Sort</Label>
                      <Select
                        value={sortBy}
                        onValueChange={(value: AccountSort) => {
                          setSortBy(value);
                          setPageIndex(0);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="displayName">Name</SelectItem>
                          <SelectItem value="accountNumber">Account ID</SelectItem>
                          <SelectItem value="username">Username</SelectItem>
                          <SelectItem value="program">Program</SelectItem>
                          <SelectItem value="graduationYear">Graduation year</SelectItem>
                          <SelectItem value="status">Status</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="graduationFilter">Class</Label>
                      <Input
                        id="graduationFilter"
                        value={graduationFilter}
                        onChange={(event) => {
                          setGraduationFilter(event.target.value);
                          setPageIndex(0);
                        }}
                        inputMode="numeric"
                        placeholder="2029"
                      />
                    </div>
                    <div className="flex items-end md:col-span-2 xl:col-span-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setSearchTerm("");
                          setRoleFilter("all");
                          setProgramFilter("all");
                          setStatusFilter("all");
                          setGraduationFilter("");
                          setSortBy("displayName");
                          setPageIndex(0);
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden py-0">
                  <CardHeader className="border-b px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <KeyRound className="size-5 text-primary" />
                          <CardTitle>Provisioned accounts</CardTitle>
                        </div>
                        <CardDescription>
                          Showing {pageStart}-{pageEnd} of {filteredAccounts.length} filtered accounts.
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {missingAccountNumberCount > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleAssignMissingAccountNumbers()}
                            disabled={isAssigningAccountNumbers}
                          >
                            <Save className="size-4" />
                            Assign IDs
                          </Button>
                        )}
                        <Label htmlFor="accountPageSize" className="sr-only">Rows per page</Label>
                        <Select
                          value={pageSize}
                          onValueChange={(value) => {
                            setPageSize(value);
                            setPageIndex(0);
                          }}
                        >
                          <SelectTrigger id="accountPageSize" className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="25">25 rows</SelectItem>
                            <SelectItem value="50">50 rows</SelectItem>
                            <SelectItem value="100">100 rows</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {accounts === undefined && (
                      <p className="p-5 text-sm text-muted-foreground">Loading provisioned accounts...</p>
                    )}
                    {accounts?.length === 0 && (
                      <div className="m-5 rounded-md border p-4 text-sm text-muted-foreground">
                        No provisioned accounts exist yet.
                      </div>
                    )}
                    {accounts && accounts.length > 0 && filteredAccounts.length === 0 && (
                      <div className="m-5 rounded-md border p-4 text-sm text-muted-foreground">
                        No accounts match the current filters.
                      </div>
                    )}
                    {filteredAccounts.length > 0 && (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                              <tr>
                                <th className="px-4 py-3 font-medium">Name</th>
                                <th className="px-4 py-3 font-medium">Account ID</th>
                                <th className="px-4 py-3 font-medium">Username</th>
                                <th className="px-4 py-3 font-medium">Role</th>
                                <th className="px-4 py-3 font-medium">Program</th>
                                <th className="px-4 py-3 font-medium">Class</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Last link</th>
                                <th className="px-4 py-3 text-right font-medium">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {paginatedAccounts.map((account) => {
                                const accountLabel = account.accountLabel as AccountLabel;
                                const role = roleForAccountLabel(accountLabel);
                                const programLabel = programForAccountLabel(accountLabel);
                                const latestLink = account.credentialLinks[0];
                                const activeLinkCount = account.credentialLinks.filter(
                                  (link) => !link.consumedAt && !link.revokedAt && link.expiresAt > Date.now(),
                                ).length;

                                return (
                                  <tr
                                    key={account._id}
                                    className="cursor-pointer transition-colors hover:bg-muted/35"
                                    onClick={() => openAccountSheet(account._id)}
                                  >
                                    <td className="max-w-64 px-4 py-3">
                                      <div className="truncate font-medium">{account.displayName}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {account.userId ? "Password set" : "Waiting for setup"}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      {account.accountNumber ? (
                                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                          {account.accountNumber}
                                        </code>
                                      ) : (
                                        <span className="text-muted-foreground">-</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                        {account.username}
                                      </code>
                                    </td>
                                    <td className="px-4 py-3">
                                      <Badge variant="secondary">{accountLabelText[accountLabel]}</Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                      {role === "student" ? programText[programLabel] : "-"}
                                    </td>
                                    <td className="px-4 py-3">
                                      {account.graduationYear ?? "-"}
                                    </td>
                                    <td className="px-4 py-3">
                                      <Badge variant={account.status === "inactive" ? "destructive" : "outline"}>
                                        {accountStatusText(account.status)}
                                      </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">
                                      {latestLink
                                        ? `${latestLink.purpose === "initial_setup" ? "Setup" : "Reset"} ${formatShortDate(latestLink.createdAt)}`
                                        : "-"}
                                      {activeLinkCount > 0 ? ` / ${activeLinkCount} active` : ""}
                                    </td>
                                    <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Manage ${account.displayName}`}
                                          >
                                            <MoreHorizontal className="size-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onSelect={() => openAccountSheet(account._id)}>
                                            Manage account
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            disabled={busyAccountId === account._id}
                                            onSelect={() =>
                                              void handleCreateLink(
                                                account._id,
                                                account.userId ? "password_reset" : "initial_setup",
                                              )
                                            }
                                          >
                                            {account.userId ? "Create reset link" : "Create setup link"}
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            variant={account.status === "inactive" ? "default" : "destructive"}
                                            disabled={busyAccountId === account._id}
                                            onSelect={() =>
                                              void handleToggleAccount(
                                                account._id,
                                                account.status === "inactive",
                                              )
                                            }
                                          >
                                            {account.status === "inactive" ? "Reactivate" : "Deactivate"}
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex flex-col gap-3 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-muted-foreground">
                            Page {safePageIndex + 1} of {pageCount}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setPageIndex(Math.max(0, safePageIndex - 1))}
                              disabled={safePageIndex === 0}
                            >
                              <ChevronLeft className="size-4" />
                              Previous
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setPageIndex(Math.min(pageCount - 1, safePageIndex + 1))
                              }
                              disabled={safePageIndex >= pageCount - 1}
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

                <Sheet open={isAccountSheetOpen} onOpenChange={setIsAccountSheetOpen}>
                  <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
                    {selectedAccount ? (
                      (() => {
                        const accountLabel = selectedAccount.accountLabel as AccountLabel;
                        const role = roleForAccountLabel(accountLabel);
                        const programLabel = programForAccountLabel(accountLabel);
                        const fallbackName = splitDisplayName(selectedAccount.displayName);
                        const selectedFirstName = selectedAccount.firstName ?? fallbackName.firstName;
                        const selectedLastName = selectedAccount.lastName ?? fallbackName.lastName;
                        const activeLinks = selectedAccount.credentialLinks.filter(
                          (link) => !link.consumedAt && !link.revokedAt && link.expiresAt > Date.now(),
                        );

                        return (
                          <>
                            <SheetHeader className="border-b px-5 py-4">
                              <SheetTitle>{selectedAccount.displayName}</SheetTitle>
                              <SheetDescription>
                                {selectedAccount.accountNumber ? `${selectedAccount.accountNumber} / ` : ""}
                                {selectedAccount.username} / {accountLabelText[accountLabel]}
                              </SheetDescription>
                            </SheetHeader>
                            <div className="space-y-5 px-5 pb-5">
                              <div className="grid gap-3 rounded-md border p-4 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">Account ID</span>
                                  <span className="font-mono font-medium">
                                    {selectedAccount.accountNumber ?? "Unassigned"}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">Status</span>
                                  <Badge variant={selectedAccount.status === "inactive" ? "destructive" : "outline"}>
                                    {accountStatusText(selectedAccount.status)}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">Password</span>
                                  <span className="font-medium">
                                    {selectedAccount.userId ? "Set" : "Waiting for setup"}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">Created</span>
                                  <span className="font-medium">{formatShortDate(selectedAccount.createdAt)}</span>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <h3 className="font-medium">Account details</h3>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label htmlFor="selectedFirstName">First name</Label>
                                    <Input
                                      key={`${selectedAccount._id}:first:${selectedFirstName}`}
                                      id="selectedFirstName"
                                      defaultValue={selectedFirstName}
                                      placeholder="First"
                                      onBlur={(event) => {
                                        const value = event.currentTarget.value.trim();

                                        if (!value || value === selectedFirstName) {
                                          return;
                                        }

                                        void handleUpdateProvisionedAccount(selectedAccount._id, {
                                          firstName: value,
                                          lastName: selectedLastName,
                                        });
                                      }}
                                      disabled={busyAccountId === selectedAccount._id}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="selectedLastName">Last name</Label>
                                    <Input
                                      key={`${selectedAccount._id}:last:${selectedLastName}`}
                                      id="selectedLastName"
                                      defaultValue={selectedLastName}
                                      placeholder="Last"
                                      onBlur={(event) => {
                                        const value = event.currentTarget.value.trim();

                                        if (!value || value === selectedLastName) {
                                          return;
                                        }

                                        void handleUpdateProvisionedAccount(selectedAccount._id, {
                                          firstName: selectedFirstName,
                                          lastName: value,
                                        });
                                      }}
                                      disabled={busyAccountId === selectedAccount._id}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Role</Label>
                                    <Select
                                      value={role}
                                      onValueChange={(value: AccountRole) =>
                                        void handleUpdateProvisionedAccount(selectedAccount._id, {
                                          accountLabel: accountLabelFor(value, programLabel),
                                        })
                                      }
                                      disabled={busyAccountId === selectedAccount._id}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="student">Student</SelectItem>
                                        <SelectItem value="mentor">Mentor</SelectItem>
                                        <SelectItem value="guest">Guest</SelectItem>
                                        <SelectItem value="kiosk">Shop Kiosk</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Program</Label>
                                    <Select
                                      value={programLabel}
                                      onValueChange={(value: Program) =>
                                        void handleUpdateProvisionedAccount(selectedAccount._id, {
                                          accountLabel: accountLabelFor("student", value),
                                        })
                                      }
                                      disabled={role !== "student" || busyAccountId === selectedAccount._id}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="frc_5199">5199</SelectItem>
                                        <SelectItem value="frc_9271">9271</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="selectedGraduationYear">Graduation year</Label>
                                    <Input
                                      key={`${selectedAccount._id}:${selectedAccount.graduationYear ?? ""}`}
                                      id="selectedGraduationYear"
                                      defaultValue={selectedAccount.graduationYear ?? ""}
                                      inputMode="numeric"
                                      placeholder="2029"
                                      onBlur={(event) => {
                                        const value = event.currentTarget.value.trim();
                                        const nextYear = value ? Number(value) : null;

                                        if ((selectedAccount.graduationYear ?? null) === nextYear) {
                                          return;
                                        }

                                        void handleUpdateProvisionedAccount(selectedAccount._id, {
                                          graduationYear: nextYear,
                                        });
                                      }}
                                      disabled={busyAccountId === selectedAccount._id}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <h3 className="font-medium">Credential links</h3>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    disabled={busyAccountId === selectedAccount._id || !!selectedAccount.userId}
                                    onClick={() => void handleCreateLink(selectedAccount._id, "initial_setup")}
                                  >
                                    <KeyRound className="size-4" />
                                    Setup link
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    disabled={busyAccountId === selectedAccount._id || !selectedAccount.userId}
                                    onClick={() => void handleCreateLink(selectedAccount._id, "password_reset")}
                                  >
                                    <RotateCcw className="size-4" />
                                    Reset link
                                  </Button>
                                </div>
                                {activeLinks.length === 0 ? (
                                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                                    No active one-time links.
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {activeLinks.map((link) => (
                                      <div
                                        key={link._id}
                                        className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                                      >
                                        <div>
                                          <p className="font-medium">
                                            {link.purpose === "initial_setup" ? "Setup" : "Reset"} link
                                          </p>
                                          <p className="text-muted-foreground">
                                            Expires {formatShortDate(link.expiresAt)}
                                          </p>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => void revokeCredentialLink({ credentialLinkId: link._id })}
                                        >
                                          Revoke
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-3 border-t pt-5">
                                <Button
                                  type="button"
                                  variant={selectedAccount.status === "inactive" ? "default" : "destructive"}
                                  className="w-full"
                                  disabled={busyAccountId === selectedAccount._id}
                                  onClick={() =>
                                    void handleToggleAccount(
                                      selectedAccount._id,
                                      selectedAccount.status === "inactive",
                                    )
                                  }
                                >
                                  {selectedAccount.status === "inactive" ? "Reactivate" : "Deactivate"}
                                </Button>
                              </div>
                            </div>
                          </>
                        );
                      })()
                    ) : (
                      <>
                        <SheetHeader>
                          <SheetTitle>Account not found</SheetTitle>
                          <SheetDescription>
                            Select an account from the table to manage it.
                          </SheetDescription>
                        </SheetHeader>
                      </>
                    )}
                  </SheetContent>
                </Sheet>
              </TabsContent>

              <TabsContent value="provision">
                <Card>
                  <CardHeader>
                    <Plus className="size-5 text-primary" />
                    <CardTitle>Provision account</CardTitle>
                    <CardDescription>
                      Generate a username and one-time setup link.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateAccount} className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First name</Label>
                          <Input
                            id="firstName"
                            value={firstName}
                            onChange={(event) => setFirstName(event.target.value)}
                            placeholder="Avery"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last name</Label>
                          <Input
                            id="lastName"
                            value={lastName}
                            onChange={(event) => setLastName(event.target.value)}
                            placeholder="Student"
                            required
                          />
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Role</Label>
                          <Select
                            value={accountRole}
                            onValueChange={(value: AccountRole) => setAccountRole(value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="student">Student</SelectItem>
                              <SelectItem value="mentor">Mentor</SelectItem>
                              <SelectItem value="guest">Guest</SelectItem>
                              <SelectItem value="kiosk">Shop Kiosk</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Program</Label>
                          <Select
                            value={program}
                            onValueChange={(value: Program) => setProgram(value)}
                            disabled={accountRole !== "student"}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="frc_5199">5199</SelectItem>
                              <SelectItem value="frc_9271">9271</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="graduationYear">Graduation year</Label>
                          <Input
                            id="graduationYear"
                            value={graduationYear}
                            onChange={(event) => setGraduationYear(event.target.value)}
                            inputMode="numeric"
                            placeholder="2029"
                          />
                        </div>
                      </div>
                      <Button type="submit">
                        <Save className="size-4" />
                        Provision and copy link
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bulk">
                <Card>
                  <CardHeader>
                    <Upload className="size-5 text-primary" />
                    <CardTitle>Bulk import</CardTitle>
                    <CardDescription>
                      CSV columns: firstName, lastName, role, program, graduationYear.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={csv}
                      onChange={(event) => setCsv(event.target.value)}
                      className="min-h-52 font-mono text-sm"
                    />
                    <Button type="button" variant="outline" onClick={() => void handleBulkCreate()}>
                      <Upload className="size-4" />
                      Import roster
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="classes">
                <Card>
                  <CardHeader>
                    <GraduationCap className="size-5 text-primary" />
                    <CardTitle>Class tools</CardTitle>
                    <CardDescription>
                      Deactivate graduating students or use the directory filters to move students between 9271 and 5199.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 rounded-md border p-4">
                      <div>
                        <p className="font-medium">Graduate a class</p>
                        <p className="text-sm text-muted-foreground">
                          Deactivate students when they leave the program.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="graduatingYear">Graduation year</Label>
                          <Input
                            id="graduatingYear"
                            value={graduatingYear}
                            onChange={(event) => setGraduatingYear(event.target.value)}
                            inputMode="numeric"
                            placeholder="2026"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Program</Label>
                          <Select
                            value={graduatingProgram}
                            onValueChange={(value: Program | "all") => setGraduatingProgram(value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All students</SelectItem>
                              <SelectItem value="frc_5199">5199 only</SelectItem>
                              <SelectItem value="frc_9271">9271 only</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => void handleGraduateClass()}
                        disabled={isGraduating}
                      >
                        Graduate class
                      </Button>
                    </div>

                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="profiles">
                <Card>
                  <CardHeader>
                    <Users className="size-5 text-primary" />
                    <CardTitle>Profiles</CardTitle>
                    <CardDescription>
                      Assign active profiles to the correct team or access group.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                      <div>
                        <p className="font-medium">Legacy profile cleanup</p>
                        <p className="text-sm text-muted-foreground">
                          Clear profiles that are not linked to provisioned username accounts.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleClearLegacyProfiles()}
                        disabled={isClearingLegacyProfiles}
                      >
                        <Trash2 className="size-4" />
                        Clear legacy profiles
                      </Button>
                    </div>
                    {users === undefined && (
                      <p className="text-sm text-muted-foreground">Loading users...</p>
                    )}
                    {users?.length === 0 && (
                      <div className="rounded-md border p-4 text-sm text-muted-foreground">
                        No user profiles exist yet.
                      </div>
                    )}
                    {users?.map((profile) => {
                      const profileName =
                        profile.displayName ??
                        profile.user?.name ??
                        profile.email ??
                        profile.user?.email ??
                        "Team member";
                      const isLegacyProfile = !profile.provisionedAccount;
                      const isOwnProfile = profile.userId === viewer?.user._id;

                      return (
                        <div
                          key={profile._id}
                          className="grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_260px_auto] md:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{profileName}</p>
                              <Badge variant="outline">
                                {accountLabelText[profile.accountLabel as AccountLabel]}
                              </Badge>
                              <Badge variant={isLegacyProfile ? "secondary" : "outline"}>
                                {isLegacyProfile ? "Legacy profile" : profile.provisionedAccount?.username}
                              </Badge>
                              {profile.status === "inactive" && (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {profile.email ?? profile.user?.email ?? profile.user?.name ?? "No email on file"}
                            </p>
                          </div>
                          <Select
                            value={profile.accountLabel}
                            onValueChange={(value: AccountLabel) =>
                              void handleSetAccountLabel(profile.userId, value)
                            }
                            disabled={savingUserId === profile.userId || isLegacyProfile}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="varsity_5199">5199 Student</SelectItem>
                              <SelectItem value="jv_9271">9271 Student</SelectItem>
                              <SelectItem value="mentor">Mentor</SelectItem>
                              <SelectItem value="guest">Guest</SelectItem>
                              <SelectItem value="kiosk">Shop Kiosk</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground md:justify-end">
                            {savingUserId === profile.userId ? (
                              <span className="inline-flex items-center gap-2">
                                <Save className="size-4" />
                                Saving
                              </span>
                            ) : (
                              <span>{profile.studentGroup ?? profile.role}</span>
                            )}
                            {isLegacyProfile && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full md:w-auto"
                                disabled={clearingProfileId === profile._id || isOwnProfile}
                                onClick={() => void handleClearLegacyProfile(profile._id, profileName)}
                              >
                                <Trash2 className="size-4" />
                                Clear
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </Authenticated>
    </div>
  );
}
