import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Copy,
  GraduationCap,
  KeyRound,
  LockKeyhole,
  Plus,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
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

type AccountLabel = "varsity_5199" | "jv_9271" | "mentor" | "guest" | "admin";
type AccountRole = "student" | "mentor" | "guest" | "admin";
type Program = "frc_5199" | "frc_9271";
type AccountStatusFilter = "all" | "pending_setup" | "active" | "inactive";
type AccountSort = "displayName" | "username" | "program" | "graduationYear" | "status";

const accountLabelText: Record<AccountLabel, string> = {
  varsity_5199: "5199 Student",
  jv_9271: "9271 Student",
  mentor: "Mentor",
  guest: "Guest",
  admin: "Admin",
};

const programText: Record<Program, string> = {
  frc_5199: "5199",
  frc_9271: "9271",
};

function roleForAccountLabel(accountLabel: AccountLabel): AccountRole {
  if (accountLabel === "mentor" || accountLabel === "guest" || accountLabel === "admin") {
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

  if (normalized === "mentor" || normalized === "guest" || normalized === "admin") {
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

    return {
      displayName: record.displayName || record.name || "",
      accountLabel: record.accountLabel
        ? fallbackAccountLabel
        : accountLabelFor(role, program),
      graduationYear: record.graduationYear ? Number(record.graduationYear) : undefined,
    };
  });
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
  toast.success("Copied link");
}

export function AdminPeoplePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const isAdmin = effectiveRole === "admin";
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
  const deactivateGraduationYear = useMutation(api.access.deactivateGraduationYear);
  const revokeCredentialLink = useMutation(api.access.revokeCredentialLink);
  const deactivateAccount = useMutation(api.access.deactivateAccount);
  const reactivateAccount = useMutation(api.access.reactivateAccount);
  const clearLegacyProfile = useMutation(api.profiles.clearLegacyProfile);
  const clearLegacyProfiles = useMutation(api.profiles.clearLegacyProfiles);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [accountRole, setAccountRole] = useState<AccountRole>("student");
  const [program, setProgram] = useState<Program>("frc_5199");
  const [graduationYear, setGraduationYear] = useState("");
  const [graduatingYear, setGraduatingYear] = useState("");
  const [graduatingProgram, setGraduatingProgram] = useState<Program | "all">("all");
  const [csv, setCsv] = useState("displayName,role,program,graduationYear\n");
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>({});
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [isGraduating, setIsGraduating] = useState(false);
  const [clearingProfileId, setClearingProfileId] = useState<string | null>(null);
  const [isClearingLegacyProfiles, setIsClearingLegacyProfiles] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<AccountRole | "all">("all");
  const [programFilter, setProgramFilter] = useState<Program | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AccountStatusFilter>("all");
  const [graduationFilter, setGraduationFilter] = useState("");
  const [sortBy, setSortBy] = useState<AccountSort>("displayName");
  const createdLinks = useMemo(() => Object.entries(generatedLinks), [generatedLinks]);
  const accountStats = useMemo(() => {
    const list = accounts ?? [];

    return {
      total: list.length,
      active: list.filter((account) => account.status === "active").length,
      pending: list.filter((account) => account.status === "pending_setup").length,
      inactive: list.filter((account) => account.status === "inactive").length,
    };
  }, [accounts]);
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
              : first[sortBy];
        const secondValue =
          sortBy === "program"
            ? programTextForAccountLabel(secondLabel)
            : sortBy === "status"
              ? second.status
              : second[sortBy];

        return String(firstValue ?? "").localeCompare(String(secondValue ?? ""), undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
  }, [accounts, graduationFilter, programFilter, roleFilter, searchTerm, sortBy, statusFilter]);

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
        displayName,
        accountLabel: accountLabelFor(accountRole, program),
        graduationYear: graduationYear ? Number(graduationYear) : undefined,
        setupTokenHash: tokenHash,
        setupExpiresAt: expiresAtFromNow(setupDurationMs),
      });
      const link = setupLink(token);
      setGeneratedLinks((current) => ({ ...current, [result.credentialLinkId]: link }));
      setDisplayName("");
      setGraduationYear("");
      await copyText(link);
      toast.success(`Created ${result.username}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create account");
    }
  }

  async function handleUpdateProvisionedAccount(
    provisionedAccountId: Id<"provisionedAccounts">,
    patch: {
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
          setupLink(prepared[index].token),
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
      setGeneratedLinks((current) => ({ ...current, [result.credentialLinkId]: link }));
      await copyText(link);
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
                Switch back to your actual role or sign in with an admin account.
              </CardDescription>
            </CardHeader>
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
                  {createdLinks.map(([id, link]) => (
                    <div key={id} className="flex items-center gap-2 rounded-md border p-2">
                      <code className="min-w-0 flex-1 truncate text-xs">{link}</code>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void copyText(link)}
                      >
                        <Copy className="size-4" />
                        Copy
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
                          onChange={(event) => setSearchTerm(event.target.value)}
                          className="pl-9"
                          placeholder="Name, username, team, class..."
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={roleFilter}
                        onValueChange={(value: AccountRole | "all") => setRoleFilter(value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All roles</SelectItem>
                          <SelectItem value="student">Students</SelectItem>
                          <SelectItem value="mentor">Mentors</SelectItem>
                          <SelectItem value="guest">Guests</SelectItem>
                          <SelectItem value="admin">Admins</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Program</Label>
                      <Select
                        value={programFilter}
                        onValueChange={(value: Program | "all") => setProgramFilter(value)}
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
                        onValueChange={(value: AccountStatusFilter) => setStatusFilter(value)}
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
                      <Select value={sortBy} onValueChange={(value: AccountSort) => setSortBy(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="displayName">Name</SelectItem>
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
                        onChange={(event) => setGraduationFilter(event.target.value)}
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
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <KeyRound className="size-5 text-primary" />
                    <CardTitle>Provisioned accounts</CardTitle>
                    <CardDescription>
                      Showing {filteredAccounts.length} of {accounts?.length ?? 0} accounts.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {accounts === undefined && (
                      <p className="text-sm text-muted-foreground">Loading provisioned accounts...</p>
                    )}
                    {accounts?.length === 0 && (
                      <div className="rounded-md border p-4 text-sm text-muted-foreground">
                        No provisioned accounts exist yet.
                      </div>
                    )}
                    {accounts && accounts.length > 0 && filteredAccounts.length === 0 && (
                      <div className="rounded-md border p-4 text-sm text-muted-foreground">
                        No accounts match the current filters.
                      </div>
                    )}
                    {filteredAccounts.map((account) => {
                      const accountLabel = account.accountLabel as AccountLabel;
                      const role = roleForAccountLabel(accountLabel);
                      const programLabel = programForAccountLabel(accountLabel);

                      return (
                        <div
                          key={account._id}
                          className="grid gap-3 rounded-md border p-4 lg:grid-cols-[1fr_auto] lg:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{account.displayName}</p>
                              <Badge variant="outline">{account.username}</Badge>
                              <Badge variant="secondary">{accountLabelText[accountLabel]}</Badge>
                              {role === "student" && (
                                <Badge variant="outline">Team {programText[programLabel]}</Badge>
                              )}
                              <Badge variant={account.status === "inactive" ? "destructive" : "outline"}>
                                {account.status.replace("_", " ")}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {account.userId ? "Password set" : "Waiting for setup"}
                              {account.graduationYear ? ` / Class of ${account.graduationYear}` : ""}
                            </p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:justify-end">
                            <Select
                              value={role}
                              onValueChange={(value: AccountRole) =>
                                void handleUpdateProvisionedAccount(account._id, {
                                  accountLabel: accountLabelFor(value, programLabel),
                                })
                              }
                              disabled={busyAccountId === account._id}
                            >
                              <SelectTrigger className="w-full lg:w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="student">Student</SelectItem>
                                <SelectItem value="mentor">Mentor</SelectItem>
                                <SelectItem value="guest">Guest</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                            {role === "student" && (
                              <Select
                                value={programLabel}
                                onValueChange={(value: Program) =>
                                  void handleUpdateProvisionedAccount(account._id, {
                                    accountLabel: accountLabelFor("student", value),
                                  })
                                }
                                disabled={busyAccountId === account._id}
                              >
                                <SelectTrigger className="w-full lg:w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="frc_5199">5199</SelectItem>
                                  <SelectItem value="frc_9271">9271</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            <Input
                              className="w-full lg:w-28"
                              defaultValue={account.graduationYear ?? ""}
                              inputMode="numeric"
                              placeholder="Grad"
                              aria-label={`${account.displayName} graduation year`}
                              onBlur={(event) => {
                                const value = event.currentTarget.value.trim();
                                const nextYear = value ? Number(value) : null;

                                if ((account.graduationYear ?? null) === nextYear) {
                                  return;
                                }

                                void handleUpdateProvisionedAccount(account._id, {
                                  graduationYear: nextYear,
                                });
                              }}
                              disabled={busyAccountId === account._id}
                            />
                            {!account.userId && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full lg:w-auto"
                                disabled={busyAccountId === account._id}
                                onClick={() => void handleCreateLink(account._id, "initial_setup")}
                              >
                                <KeyRound className="size-4" />
                                Setup link
                              </Button>
                            )}
                            {account.userId && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full lg:w-auto"
                                disabled={busyAccountId === account._id}
                                onClick={() => void handleCreateLink(account._id, "password_reset")}
                              >
                                <RotateCcw className="size-4" />
                                Reset link
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant={account.status === "inactive" ? "default" : "destructive"}
                              size="sm"
                              className="w-full lg:w-auto"
                              disabled={busyAccountId === account._id}
                              onClick={() =>
                                void handleToggleAccount(account._id, account.status === "inactive")
                              }
                            >
                              {account.status === "inactive" ? "Reactivate" : "Deactivate"}
                            </Button>
                            {account.credentialLinks
                              .filter((link) => !link.consumedAt && !link.revokedAt && link.expiresAt > Date.now())
                              .map((link) => (
                                <Button
                                  key={link._id}
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="w-full lg:w-auto"
                                  onClick={() => void revokeCredentialLink({ credentialLinkId: link._id })}
                                >
                                  Revoke {link.purpose === "initial_setup" ? "setup" : "reset"}
                                </Button>
                              ))}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
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
                      <div className="space-y-2">
                        <Label htmlFor="displayName">Student name</Label>
                        <Input
                          id="displayName"
                          value={displayName}
                          onChange={(event) => setDisplayName(event.target.value)}
                          placeholder="Avery Student"
                          required
                        />
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
                      CSV columns: displayName, role, program, graduationYear.
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
