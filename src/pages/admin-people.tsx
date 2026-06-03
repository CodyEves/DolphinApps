import { useConvexAuth } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Copy,
  KeyRound,
  LockKeyhole,
  Plus,
  RotateCcw,
  Save,
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
import { Textarea } from "@/components/ui/textarea";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type AccountLabel = "varsity_5199" | "jv_9271" | "mentor" | "guest" | "admin";

const accountLabelText: Record<AccountLabel, string> = {
  varsity_5199: "5199 Student",
  jv_9271: "9271 Student",
  mentor: "Mentor",
  guest: "Guest",
  admin: "Admin",
};

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

    return {
      displayName: record.displayName || record.name || "",
      accountLabel: (record.accountLabel || "varsity_5199") as AccountLabel,
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
  const revokeCredentialLink = useMutation(api.access.revokeCredentialLink);
  const deactivateAccount = useMutation(api.access.deactivateAccount);
  const reactivateAccount = useMutation(api.access.reactivateAccount);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [accountLabel, setAccountLabelState] = useState<AccountLabel>("varsity_5199");
  const [graduationYear, setGraduationYear] = useState("");
  const [csv, setCsv] = useState("displayName,accountLabel,graduationYear\n");
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>({});
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const createdLinks = useMemo(() => Object.entries(generatedLinks), [generatedLinks]);

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
        accountLabel,
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
            <Link to="/admin">
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
            <div className="grid gap-4 lg:grid-cols-2">
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
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Account label</Label>
                        <Select value={accountLabel} onValueChange={(value: AccountLabel) => setAccountLabelState(value)}>
                          <SelectTrigger>
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

              <Card>
                <CardHeader>
                  <Upload className="size-5 text-primary" />
                  <CardTitle>Bulk import</CardTitle>
                  <CardDescription>
                    CSV columns: displayName, accountLabel, graduationYear.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={csv}
                    onChange={(event) => setCsv(event.target.value)}
                    className="min-h-36 font-mono text-sm"
                  />
                  <Button type="button" variant="outline" onClick={() => void handleBulkCreate()}>
                    <Upload className="size-4" />
                    Import roster
                  </Button>
                </CardContent>
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
                      <Button type="button" size="sm" variant="outline" onClick={() => void copyText(link)}>
                        <Copy className="size-4" />
                        Copy
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <KeyRound className="size-5 text-primary" />
                <CardTitle>Provisioned accounts</CardTitle>
                <CardDescription>
                  Issue setup or reset links and disable accounts that should not access the app.
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
                {accounts?.map((account) => (
                  <div
                    key={account._id}
                    className="grid gap-3 rounded-md border p-4 lg:grid-cols-[1fr_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{account.displayName}</p>
                        <Badge variant="outline">{account.username}</Badge>
                        <Badge variant="secondary">{accountLabelText[account.accountLabel as AccountLabel]}</Badge>
                        <Badge variant={account.status === "inactive" ? "destructive" : "outline"}>
                          {account.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {account.userId ? "Password set" : "Waiting for setup"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {!account.userId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
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
                        disabled={busyAccountId === account._id}
                        onClick={() => void handleToggleAccount(account._id, account.status === "inactive")}
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
                            onClick={() => void revokeCredentialLink({ credentialLinkId: link._id })}
                          >
                            Revoke {link.purpose === "initial_setup" ? "setup" : "reset"}
                          </Button>
                        ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="size-5 text-primary" />
                <CardTitle>Profiles</CardTitle>
                <CardDescription>
                  Assign active profiles to the correct team or access group.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {users === undefined && (
                  <p className="text-sm text-muted-foreground">Loading users...</p>
                )}
                {users?.length === 0 && (
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    No user profiles exist yet.
                  </div>
                )}
                {users?.map((profile) => (
                  <div
                    key={profile._id}
                    className="grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_260px_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {profile.displayName ??
                            profile.user?.name ??
                            profile.email ??
                            profile.user?.email ??
                            "Team member"}
                        </p>
                        <Badge variant="outline">
                          {accountLabelText[profile.accountLabel as AccountLabel]}
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
                      disabled={savingUserId === profile.userId}
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
                    <div className="flex items-center justify-end text-sm text-muted-foreground">
                      {savingUserId === profile.userId ? (
                        <span className="inline-flex items-center gap-2">
                          <Save className="size-4" />
                          Saving
                        </span>
                      ) : (
                        <span>{profile.studentGroup ?? profile.role}</span>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </Authenticated>
    </div>
  );
}
