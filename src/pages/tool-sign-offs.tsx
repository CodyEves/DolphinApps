import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Check,
  CreditCard,
  Download,
  Minus,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { canReviewLearning } from "@/lib/role-access";
import { useEffectiveRole } from "@/providers/role-preview-provider";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type CellState = "current" | "expired" | "none";

function cellState(signOff: { isCurrent: boolean; isExpired: boolean }): CellState {
  if (signOff.isCurrent) {
    return "current";
  }

  return signOff.isExpired ? "expired" : "none";
}

function formatDate(timestamp: number | undefined) {
  if (!timestamp) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "2-digit",
  }).format(new Date(timestamp));
}

function toCsvValue(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function ToolSignOffsPage() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const effectiveRole = useEffectiveRole(viewer?.profile.role);
  const canView = canReviewLearning(effectiveRole);

  const matrix = useQuery(
    api.equipment.signOffMatrix,
    isAuthenticated && canView ? {} : "skip",
  );
  const setHandsOn = useMutation(api.equipment.setHandsOnDemonstration);

  const [search, setSearch] = useState("");
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [pendingCell, setPendingCell] = useState<string | null>(null);

  const filteredStudents = useMemo(() => {
    if (!matrix) {
      return [];
    }

    const term = search.trim().toLowerCase();

    return matrix.students.filter((student) => {
      if (
        term &&
        !student.name.toLowerCase().includes(term) &&
        !(student.studentGroup ?? "").toLowerCase().includes(term)
      ) {
        return false;
      }

      if (onlyGaps && student.signOffs.every((signOff) => signOff.isCurrent)) {
        return false;
      }

      return true;
    });
  }, [matrix, search, onlyGaps]);

  async function toggleCell(
    equipmentId: Id<"equipment">,
    userId: Id<"users">,
    nextCompleted: boolean,
  ) {
    const key = `${userId}:${equipmentId}`;
    setPendingCell(key);

    try {
      await setHandsOn({ equipmentId, userId, completed: nextCompleted });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update sign-off");
    } finally {
      setPendingCell(null);
    }
  }

  function exportCsv() {
    if (!matrix) {
      return;
    }

    const header = ["Student", "Group", "Card enrolled", ...matrix.equipment.map((item) => item.name)];
    const rows = filteredStudents.map((student) => [
      student.name,
      student.studentGroup ?? "",
      student.hasCard ? "yes" : "no",
      ...student.signOffs.map((signOff) => {
        const state = cellState(signOff);

        if (state === "current") {
          return signOff.expiresAt ? `signed off (expires ${formatDate(signOff.expiresAt)})` : "signed off";
        }

        return state === "expired" ? "expired" : "";
      }),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => toCsvValue(String(value))).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tool-sign-offs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Sign-off tracking is restricted</CardTitle>
            <CardDescription>
              Admins, mentors, and instructors can view the sign-off tracker.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const canEditCells = effectiveRole === "admin";
  const totalCurrent =
    matrix?.students.reduce(
      (total, student) => total + student.signOffs.filter((signOff) => signOff.isCurrent).length,
      0,
    ) ?? 0;
  const totalExpired =
    matrix?.students.reduce(
      (total, student) => total + student.signOffs.filter((signOff) => signOff.isExpired).length,
      0,
    ) ?? 0;
  const withoutCard = matrix?.students.filter((student) => !student.hasCard).length ?? 0;

  return (
    <div className="mx-auto max-w-[110rem]">
      <PageHeading
        eyebrow="Shop Tools"
        title="Sign-off tracking"
        description="Every active student against every active tool. Green means they may power the tool right now."
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!matrix}>
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="size-4" />
            Current sign-offs
          </div>
          <p className="mt-1 text-2xl font-semibold">{matrix ? totalCurrent : "..."}</p>
        </div>
        <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="size-4" />
            Expired
          </div>
          <p className="mt-1 text-2xl font-semibold">{matrix ? totalExpired : "..."}</p>
        </div>
        <div className="rounded-md border bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="size-4" />
            No card enrolled
          </div>
          <p className="mt-1 text-2xl font-semibold">{matrix ? withoutCard : "..."}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search students"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button
          variant={onlyGaps ? "default" : "outline"}
          onClick={() => setOnlyGaps((current) => !current)}
        >
          Only students with gaps
        </Button>
      </div>

      {matrix === undefined ? (
        <Card>
          <CardHeader>
            <CardTitle>Loading sign-offs</CardTitle>
            <CardDescription>Building the roster grid.</CardDescription>
          </CardHeader>
        </Card>
      ) : matrix.equipment.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No active tools</CardTitle>
            <CardDescription>Add a tool before tracking sign-offs.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-muted/40 px-4 py-3 font-medium">Student</th>
                {matrix.equipment.map((item) => (
                  <th key={item._id} className="px-3 py-3 text-center font-medium">
                    <span className="block max-w-24 truncate" title={item.name}>
                      {item.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredStudents.map((student) => (
                <tr key={student.userId} className="hover:bg-muted/30">
                  <td className="sticky left-0 z-10 bg-background px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{student.name}</span>
                      {!student.hasCard && (
                        <Badge variant="outline" className="text-[10px]">
                          no card
                        </Badge>
                      )}
                    </div>
                    {student.studentGroup && (
                      <span className="text-xs text-muted-foreground">{student.studentGroup}</span>
                    )}
                  </td>
                  {student.signOffs.map((signOff) => {
                    const state = cellState(signOff);
                    const key = `${student.userId}:${signOff.equipmentId}`;
                    const label =
                      state === "current"
                        ? signOff.expiresAt
                          ? `Signed off, expires ${formatDate(signOff.expiresAt)}`
                          : "Signed off"
                        : state === "expired"
                          ? `Expired ${formatDate(signOff.expiresAt)}`
                          : "Not signed off";

                    return (
                      <td key={signOff.equipmentId} className="px-3 py-2 text-center">
                        <button
                          type="button"
                          title={label}
                          aria-label={`${student.name} - ${label}`}
                          disabled={!canEditCells || pendingCell === key}
                          onClick={() =>
                            void toggleCell(
                              signOff.equipmentId,
                              student.userId,
                              state !== "current",
                            )
                          }
                          className={[
                            "grid size-8 place-items-center rounded-md border transition-colors",
                            state === "current"
                              ? "border-primary/40 bg-primary text-primary-foreground"
                              : state === "expired"
                                ? "border-amber-500/50 bg-amber-500/15 text-amber-600"
                                : "border-dashed text-muted-foreground",
                            canEditCells ? "hover:opacity-80" : "cursor-default",
                            pendingCell === key ? "opacity-50" : "",
                          ].join(" ")}
                        >
                          {state === "current" ? (
                            <Check className="size-4" />
                          ) : state === "expired" ? (
                            <AlertTriangle className="size-4" />
                          ) : (
                            <Minus className="size-4" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td
                    colSpan={matrix.equipment.length + 1}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No students match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!canEditCells && matrix && (
        <p className="mt-3 text-sm text-muted-foreground">
          Viewing only. Admins can toggle a cell to grant or clear a sign-off.
        </p>
      )}
    </div>
  );
}
