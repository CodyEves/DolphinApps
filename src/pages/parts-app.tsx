import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  BadgePlusIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  FactoryIcon,
  GaugeIcon,
  PackageIcon,
  PlayIcon,
  PlusIcon,
  SaveIcon,
  SettingsIcon,
  ShoppingCartIcon,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  canAdvanceOrders,
  canManageAdmin,
  nextPartNumberPreview,
  orderStatusLabel,
  orderStatuses,
  partStatusLabel,
  partStatuses,
  priorities,
  roles,
  type OrderStatus,
  type PartStatus,
  type Priority,
  type Role,
} from "@/lib/parts-domain";
import { resolveEffectiveRole } from "@/lib/parts-roles";
import {
  availablePartsPrograms,
  defaultPartsProgram,
  programMeta,
  teamNumberForProgram,
  type Program,
} from "@/lib/programs";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/use-ui-store";

type ActiveContext = {
  profile: Doc<"profiles"> | null;
  season: Doc<"seasons"> | null;
};

type ReadyActiveContext = ActiveContext & { profile: Doc<"profiles"> };

type OverviewData = {
  profile: Doc<"profiles">;
  season: Doc<"seasons"> | null;
  subsystems: Doc<"subsystems">[];
  parts: Doc<"parts">[];
  manufacturing: Doc<"parts">[];
  orders: Doc<"orderRequests">[];
  transmissions: Doc<"transmissions">[];
  designers?: Doc<"profiles">[];
};

function usePartsProgram() {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.profiles.viewer, isAuthenticated ? {} : "skip");
  const { partsProgramView, programView, setPartsProgramView } = useUiStore();
  const profile = viewer?.profile ?? null;
  const availablePrograms = availablePartsPrograms(profile);
  const fallbackProgram = defaultPartsProgram(profile);
  const selectedProgram =
    partsProgramView && availablePrograms.includes(partsProgramView)
      ? partsProgramView
      : programView && availablePrograms.includes(programView)
        ? programView
      : fallbackProgram;

  return {
    viewer,
    profile,
    selectedProgram,
    selectedTeamNumber: teamNumberForProgram(selectedProgram),
    availablePrograms,
    setPartsProgramView,
  };
}

function useActiveContext(teamNumber: "5199" | "9271", canLoad: boolean) {
  const { isAuthenticated } = useConvexAuth();

  return useQuery(
    api.setup.activeSeason,
    isAuthenticated && canLoad ? { teamNumber } : "skip",
  ) as
    | ActiveContext
    | undefined;
}

function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action && <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">{action}</div>}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-md border p-4 text-sm text-muted-foreground">
      Loading live team data...
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: PartStatus | OrderStatus }) {
  const isPartStatus = partStatuses.includes(status as PartStatus);
  const label = isPartStatus
    ? partStatusLabel(status as PartStatus)
    : orderStatusLabel(status as OrderStatus);

  return (
    <span className="inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium">
      {label}
    </span>
  );
}

function useSeasonData() {
  const partsProgram = usePartsProgram();
  const active = useActiveContext(
    partsProgram.selectedTeamNumber,
    partsProgram.viewer !== undefined,
  );
  const seasonId = active?.season?._id;
  const overview = useQuery(
    api.dashboard.overview,
    seasonId ? { seasonId } : "skip",
  ) as OverviewData | undefined;
  const catalog = useQuery(api.catalog.list, active ? {} : "skip") as
    | Doc<"catalogOptions">[]
    | undefined;

  return { active, overview, catalog: catalog ?? [], partsProgram };
}

function PartsProgramSelector({
  availablePrograms,
  selectedProgram,
  onSelect,
}: {
  availablePrograms: Program[];
  selectedProgram: Program;
  onSelect: (program: Program) => void;
}) {
  if (availablePrograms.length <= 1) {
    return null;
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
      <span className="px-2 text-xs font-medium text-muted-foreground">
        Robot program
      </span>
      {availablePrograms.map((program) => (
        <Button
          key={program}
          type="button"
          size="sm"
          variant={selectedProgram === program ? "default" : "outline"}
          onClick={() => onSelect(program)}
        >
          {programMeta[program].teamNumber}
        </Button>
      ))}
    </div>
  );
}

function SetupSeasonCallout({
  profile,
  selectedProgram,
}: {
  profile: Doc<"profiles">;
  selectedProgram: Program;
}) {
  const seedDefaults = useMutation(api.setup.seedDefaults);
  const [isSeeding, setIsSeeding] = useState(false);
  const { effectiveRoleView } = useUiStore();
  const effectiveRole = resolveEffectiveRole(profile.role, effectiveRoleView);
  const teamNumber = programMeta[selectedProgram].teamNumber;

  if (!canManageAdmin(effectiveRole)) {
    return (
      <EmptyState>
        An admin needs to seed the Team {teamNumber} season before parts can be generated.
      </EmptyState>
    );
  }

  async function handleSeed() {
    setIsSeeding(true);
    try {
      await seedDefaults({ teamNumber });
      toast.success(`Team ${teamNumber} season, subsystems, and shop tags seeded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Setup failed");
    } finally {
      setIsSeeding(false);
    }
  }

  return (
    <div className="rounded-md border bg-card p-4">
      <h2 className="font-semibold">Start the robot season</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Seed editable subsystems and common material/tool tags for Team {teamNumber}.
      </p>
      <Button className="mt-4" onClick={handleSeed} disabled={isSeeding}>
        <SettingsIcon data-icon="inline-start" aria-hidden="true" />
        Seed defaults
      </Button>
    </div>
  );
}

function RequireSeason({
  children,
}: {
  children: (
    data: OverviewData,
    active: ReadyActiveContext,
    catalog: Doc<"catalogOptions">[],
  ) => ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { active, overview, catalog, partsProgram } = useSeasonData();

  if (!isLoading && !isAuthenticated) {
    return (
      <div className="rounded-md border bg-card p-4 text-sm">
        <p className="font-medium">Sign in to Dolphin Apps</p>
        <p className="mt-1 text-muted-foreground">
          Use your team account to open Dolphin Parts.
        </p>
        <Button asChild className="mt-4">
          <Link to="/auth">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (!active) {
    return <LoadingState />;
  }

  if (!active.profile) {
    return <LoadingState />;
  }

  if (!active.season) {
    return (
      <>
        <PartsProgramSelector
          availablePrograms={partsProgram.availablePrograms}
          selectedProgram={partsProgram.selectedProgram}
          onSelect={partsProgram.setPartsProgramView}
        />
        <SetupSeasonCallout
          profile={active.profile}
          selectedProgram={partsProgram.selectedProgram}
        />
      </>
    );
  }

  if (!overview) {
    return <LoadingState />;
  }

  const readyActive: ReadyActiveContext = { ...active, profile: active.profile };

  return (
    <>
      <PartsProgramSelector
        availablePrograms={partsProgram.availablePrograms}
        selectedProgram={partsProgram.selectedProgram}
        onSelect={partsProgram.setPartsProgramView}
      />
      {children(overview, readyActive, catalog)}
    </>
  );
}

function subsystemName(subsystems: Doc<"subsystems">[], subsystemId: Id<"subsystems">) {
  return subsystems.find((subsystem) => subsystem._id === subsystemId)?.name ?? "Unknown";
}

function catalogLabel(catalog: Doc<"catalogOptions">[], optionId: Id<"catalogOptions"> | null) {
  return optionId ? catalog.find((option) => option._id === optionId)?.label ?? "Unknown" : "None";
}

async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function designerLabel(designers: Doc<"profiles">[] | undefined, profileId: Id<"profiles"> | null) {
  if (!profileId) {
    return "Unassigned";
  }

  const designer = (designers ?? []).find((profile) => profile._id === profileId);
  return designer?.displayName ?? designer?.email ?? "Team member";
}

function PartCard({
  part,
  subsystems,
  catalog,
}: {
  part: Doc<"parts">;
  subsystems: Doc<"subsystems">[];
  catalog: Doc<"catalogOptions">[];
}) {
  return (
    <Link
      to={`/parts/${part._id}`}
      className="grid gap-3 rounded-md border bg-card p-3 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{part.partNumber ?? "Draft"}</p>
          <p className="truncate text-sm text-muted-foreground">{part.name}</p>
        </div>
        <StatusPill status={part.status} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
        <span>{subsystemName(subsystems, part.subsystemId)}</span>
        <span>{part.kind}</span>
        <span>{catalogLabel(catalog, part.materialOptionId)}</span>
        <span>{part.sizeProfile || `Qty ${part.quantity}`}</span>
      </div>
    </Link>
  );
}

export function DashboardRoute() {
  return (
    <RequireSeason>
      {(overview) => {
        const activeParts = overview.parts.filter((part) => part.status !== "deprecated");
        const openOrders = overview.orders.filter(
          (order) => order.status !== "delivered" && order.status !== "canceled",
        );

        return (
          <>
            <PageHeader
              title="Dashboard"
              description="Live design, fab, order, and transmission status."
              action={
                <Button asChild><Link to="/parts"><BadgePlusIcon data-icon="inline-start" aria-hidden="true" />
                  Generate</Link></Button>
              }
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {([
                ["Active parts", activeParts.length, PackageIcon],
                ["Fab queue", overview.manufacturing.length, FactoryIcon],
                ["Open orders", openOrders.length, ShoppingCartIcon],
                ["Transmissions", overview.transmissions.length, GaugeIcon],
              ] as Array<[string, number, LucideIcon]>).map(([label, value, Icon]) => (
                <div key={label} className="rounded-md border bg-card p-4">
                  <Icon className="mb-3 size-5 text-muted-foreground" aria-hidden="true" />
                  <p className="text-2xl font-semibold">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <section className="mt-5 grid gap-3 lg:grid-cols-2">
              <div className="rounded-md border bg-card p-4">
                <h2 className="mb-3 font-semibold">Manufacturing queue</h2>
                <div className="grid gap-2">
                  {overview.manufacturing.slice(0, 5).map((part) => (
                    <Link
                      key={part._id}
                      to={`/parts/${part._id}`}
                      className="flex items-center justify-between rounded-md border p-2 text-sm"
                    >
                      <span>{part.partNumber ?? "Draft"} - {part.name}</span>
                      <span className="text-muted-foreground">{partStatusLabel(part.status)}</span>
                    </Link>
                  ))}
                  {overview.manufacturing.length === 0 && <EmptyState>No parts are ready for fab.</EmptyState>}
                </div>
              </div>
              <div className="rounded-md border bg-card p-4">
                <h2 className="mb-3 font-semibold">Subsystem BOM coverage</h2>
                <div className="grid gap-2">
                  {overview.subsystems.map((subsystem) => {
                    const count = overview.parts.filter((part) => part.subsystemId === subsystem._id).length;
                    return (
                      <div key={subsystem._id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                        <span>{subsystem.letter} - {subsystem.name}</span>
                        <span className="text-muted-foreground">{count} parts</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        );
      }}
    </RequireSeason>
  );
}

export function PartsRoute() {
  const { partsSubsystemFilter, setPartsSubsystemFilter } = useUiStore();
  const generateNumber = useMutation(api.parts.generateNumber);
  const updatePart = useMutation(api.parts.update);
  const updateStatus = useMutation(api.parts.updateStatus);
  const [newSubsystemId, setNewSubsystemId] = useState<Id<"subsystems"> | null>(null);
  const [expandedPartId, setExpandedPartId] = useState<Id<"parts"> | null>(null);

  return (
    <RequireSeason>
      {(overview, active, catalog) => {
        const activeParts = overview.parts.filter((part) => part.status !== "deprecated");
        const readyParts = overview.parts.filter((part) => part.status === "readyForFab");
        const manufacturingParts = overview.parts.filter((part) => part.status === "inManufacturing");
        const openOrders = overview.orders.filter(
          (order) => order.status !== "delivered" && order.status !== "canceled",
        );
        const filteredParts =
          partsSubsystemFilter === "all"
            ? overview.parts
            : overview.parts.filter((part) => part.subsystemId === partsSubsystemFilter);
        const enabledSubsystems = overview.subsystems.filter((subsystem) => subsystem.isEnabled);
        const selectedNewSubsystem =
          enabledSubsystems.find((subsystem) => subsystem._id === newSubsystemId) ??
          enabledSubsystems[0];
        const activeNewSubsystemId = newSubsystemId ?? selectedNewSubsystem?._id ?? null;
        const catalogOptionsFor = (kind: Doc<"catalogOptions">["kind"]) =>
          catalog.filter((option) => option.kind === kind && option.isEnabled);
        const optionValue = (value: FormDataEntryValue | null) => {
          const optionId = String(value ?? "");
          return optionId ? optionId as Id<"catalogOptions"> : null;
        };

        async function createPartNumber(event: FormEvent<HTMLFormElement>) {
          event.preventDefault();

          if (!activeNewSubsystemId) {
            toast.error("Create a subsystem before generating part numbers.");
            return;
          }

          const form = event.currentTarget;
          const formData = new FormData(form);

          try {
            const result = await generateNumber({
              seasonId: active.season!._id,
              subsystemId: activeNewSubsystemId,
              name: String(formData.get("name") ?? ""),
            });
            const copied = await copyToClipboard(result.partNumber);
            form.reset();
            setPartsSubsystemFilter(activeNewSubsystemId);
            toast.success(
              copied
                ? `Generated and copied ${result.partNumber}`
                : `Generated ${result.partNumber}`,
            );
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not generate part number");
          }
        }

        async function saveInlinePart(event: FormEvent<HTMLFormElement>, part: Doc<"parts">) {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);

          try {
            await updatePart({
              partId: part._id,
              name: String(formData.get("name") ?? ""),
              kind: String(formData.get("kind") ?? "part") as "part" | "assembly",
              quantity: Number(formData.get("quantity") ?? 1),
              priority: String(formData.get("priority") ?? "normal") as Priority,
              materialOptionId: optionValue(formData.get("materialOptionId")),
              toolOptionId: optionValue(formData.get("toolOptionId")),
              bitSizeOptionId: optionValue(formData.get("bitSizeOptionId")),
              sizeProfile: String(formData.get("sizeProfile") ?? ""),
              storageLocationOptionId: optionValue(formData.get("storageLocationOptionId")),
              onshapeDocumentUrl: String(formData.get("onshapeDocumentUrl") ?? ""),
              onshapePartStudioUrl: String(formData.get("onshapePartStudioUrl") ?? ""),
              onshapeDrawingUrl: String(formData.get("onshapeDrawingUrl") ?? ""),
              notes: String(formData.get("notes") ?? ""),
            });
            toast.success("Part details saved");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not save part");
          }
        }

        async function move(partId: Id<"parts">, status: PartStatus) {
          try {
            await updateStatus({ partId, status, note: "", storageLocationOptionId: null });
            toast.success("Status updated");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Status update failed");
          }
        }

        return (
          <>
            <PageHeader
              title="Parts workspace"
              description="Part numbers, system reference, manufacturing, orders, and calculator links."
              action={
                <Button asChild variant="outline">
                  <Link to="/parts/transmissions">
                    <GaugeIcon data-icon="inline-start" aria-hidden="true" />
                    Calculator
                  </Link>
                </Button>
              }
            />
            <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {([
                ["Active parts", activeParts.length, PackageIcon],
                ["Ready for fab", readyParts.length, CheckCircle2Icon],
                ["Manufacturing", manufacturingParts.length, FactoryIcon],
                ["Open orders", openOrders.length, ShoppingCartIcon],
              ] as Array<[string, number, LucideIcon]>).map(([label, value, Icon]) => (
                <div key={label} className="rounded-md border bg-card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </section>
            <section className="mb-4 grid gap-3 xl:grid-cols-[1fr_1fr_1.2fr]">
              <div className="rounded-md border bg-card p-4">
                <h2 className="font-semibold">Generate a part number</h2>
                <form className="mt-3 grid gap-3" onSubmit={createPartNumber}>
                  <div className="grid gap-2">
                    <Label htmlFor="quick-subsystem">Subsystem</Label>
                    <select
                      id="quick-subsystem"
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={activeNewSubsystemId ?? ""}
                      onChange={(event) => setNewSubsystemId(event.currentTarget.value as Id<"subsystems">)}
                      required
                    >
                      {enabledSubsystems.map((subsystem) => (
                        <option key={subsystem._id} value={subsystem._id}>
                          {subsystem.name} ({subsystem.letter})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="quick-name">Working part name</Label>
                    <Input id="quick-name" name="name" placeholder="Left gearbox plate" required />
                  </div>
                  {selectedNewSubsystem && (
                    <div className="rounded-md bg-muted p-2 text-sm">
                      <p className="font-medium">
                        Next: {nextPartNumberPreview(selectedNewSubsystem.letter, selectedNewSubsystem.nextPartNumber)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        More details can be added from the table after CAD starts.
                      </p>
                    </div>
                  )}
                  <Button type="submit">
                    <BadgePlusIcon data-icon="inline-start" aria-hidden="true" />
                    Generate
                  </Button>
                </form>
              </div>
              <div className="rounded-md border bg-card p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold">Fab queue</h2>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/parts/manufacturing">
                      <FactoryIcon data-icon="inline-start" aria-hidden="true" />
                      Open
                    </Link>
                  </Button>
                </div>
                <div className="grid gap-2">
                  {overview.manufacturing.slice(0, 5).map((part) => (
                    <div key={part._id} className="rounded-md border p-2 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/parts/${part._id}`} className="font-medium hover:underline">
                          {part.partNumber ?? "Draft"} - {part.name}
                        </Link>
                        <StatusPill status={part.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {part.status === "readyForFab" && (
                          <Button size="sm" variant="outline" onClick={() => move(part._id, "inManufacturing")}>
                            <PlayIcon data-icon="inline-start" aria-hidden="true" />
                            Start
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => move(part._id, "manufactured")}>
                          Manufactured
                        </Button>
                      </div>
                    </div>
                  ))}
                  {overview.manufacturing.length === 0 && <EmptyState>No parts are ready for fab.</EmptyState>}
                </div>
              </div>
              <div className="rounded-md border bg-card p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold">Transmission cheatsheet</h2>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/parts/transmissions">
                      <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
                      Add
                    </Link>
                  </Button>
                </div>
                <div className="grid gap-2">
                  {overview.transmissions.slice(0, 5).map((transmission) => (
                    <div key={transmission._id} className="rounded-md border p-2 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{transmission.name}</p>
                        {transmission.calculatorUrl && (
                          <Button size="icon" variant="ghost" asChild>
                            <a href={transmission.calculatorUrl} target="_blank" rel="noreferrer">
                              <ExternalLinkIcon aria-hidden="true" />
                            </a>
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {subsystemName(overview.subsystems, transmission.subsystemId)} / {transmission.ratio || calculatedRatio(transmission.driverTeeth, transmission.drivenTeeth) || "ratio TBD"}
                      </p>
                    </div>
                  ))}
                  {overview.transmissions.length === 0 && <EmptyState>No transmissions have been added.</EmptyState>}
                </div>
              </div>
            </section>
            <Tabs defaultValue="parts" className="grid gap-4">
              <TabsList className="max-w-full overflow-x-auto">
                <TabsTrigger value="parts">Parts</TabsTrigger>
                <TabsTrigger value="systems">Systems</TabsTrigger>
                <TabsTrigger value="fab">Fab</TabsTrigger>
                <TabsTrigger value="transmissions">Transmissions</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
              </TabsList>
              <TabsContent value="parts" className="grid gap-4">
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              <Button
                size="sm"
                variant={partsSubsystemFilter === "all" ? "default" : "outline"}
                onClick={() => setPartsSubsystemFilter("all")}
              >
                All
              </Button>
              {overview.subsystems.map((subsystem) => (
                <Button
                  key={subsystem._id}
                  size="sm"
                  variant={partsSubsystemFilter === subsystem._id ? "default" : "outline"}
                  onClick={() => setPartsSubsystemFilter(subsystem._id)}
                >
                  {subsystem.letter}
                </Button>
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-md border bg-card md:block">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b bg-muted/70 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Part number</th>
                    <th className="px-3 py-2 font-medium">Part name</th>
                    <th className="px-3 py-2 font-medium">Obsolete</th>
                    <th className="px-3 py-2 font-medium">System-Sub</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Drawn by</th>
                    <th className="px-3 py-2 font-medium">Qty</th>
                    <th className="px-3 py-2 font-medium">Material</th>
                    <th className="px-3 py-2 font-medium">Size/Profile</th>
                    <th className="px-3 py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParts.map((part) => (
                    <Fragment key={part._id}>
                      <tr className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-3 py-2 font-medium">
                          <Link to={`/parts/${part._id}`} className="hover:underline">
                            {part.partNumber ?? "Draft"}
                          </Link>
                        </td>
                        <td className="max-w-[260px] px-3 py-2">
                          <span className="line-clamp-2">{part.name}</span>
                        </td>
                        <td className="px-3 py-2">{part.status === "deprecated" ? "Y" : "N"}</td>
                        <td className="px-3 py-2">{subsystemName(overview.subsystems, part.subsystemId)}</td>
                        <td className="px-3 py-2"><StatusPill status={part.status} /></td>
                        <td className="px-3 py-2">{designerLabel(overview.designers, part.designedByProfileId)}</td>
                        <td className="px-3 py-2">{part.quantity}</td>
                        <td className="px-3 py-2">{catalogLabel(catalog, part.materialOptionId)}</td>
                        <td className="px-3 py-2">{part.sizeProfile || "None"}</td>
                        <td className="px-3 py-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setExpandedPartId(expandedPartId === part._id ? null : part._id)}
                          >
                            {expandedPartId === part._id ? "Close" : "Edit"}
                          </Button>
                        </td>
                      </tr>
                      {expandedPartId === part._id && (
                        <tr className="border-b bg-muted/30">
                          <td colSpan={10} className="px-3 py-4">
                            <form className="grid gap-3" onSubmit={(event) => saveInlinePart(event, part)}>
                              <div className="grid gap-3 lg:grid-cols-4">
                                <div className="grid gap-2 lg:col-span-2">
                                  <Label htmlFor={`part-name-${part._id}`}>Part name</Label>
                                  <Input id={`part-name-${part._id}`} name="name" defaultValue={part.name} required />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor={`part-qty-${part._id}`}>Qty</Label>
                                  <Input id={`part-qty-${part._id}`} name="quantity" type="number" min={1} defaultValue={part.quantity} required />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor={`part-kind-${part._id}`}>Kind</Label>
                                  <select id={`part-kind-${part._id}`} name="kind" className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={part.kind}>
                                    <option value="part">Part</option>
                                    <option value="assembly">Assembly</option>
                                  </select>
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor={`part-priority-${part._id}`}>Priority</Label>
                                  <select id={`part-priority-${part._id}`} name="priority" className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={part.priority}>
                                    {priorities.map((priority) => (
                                      <option key={priority} value={priority}>{priority}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor={`part-material-${part._id}`}>Material</Label>
                                  <select id={`part-material-${part._id}`} name="materialOptionId" className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={part.materialOptionId ?? ""}>
                                    <option value="">None</option>
                                    {catalogOptionsFor("material").map((option) => (
                                      <option key={option._id} value={option._id}>{option.label}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor={`part-size-${part._id}`}>Size/Profile</Label>
                                  <Input id={`part-size-${part._id}`} name="sizeProfile" defaultValue={part.sizeProfile ?? ""} />
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor={`part-tool-${part._id}`}>Tool</Label>
                                  <select id={`part-tool-${part._id}`} name="toolOptionId" className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={part.toolOptionId ?? ""}>
                                    <option value="">None</option>
                                    {catalogOptionsFor("tool").map((option) => (
                                      <option key={option._id} value={option._id}>{option.label}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor={`part-bit-${part._id}`}>Bit</Label>
                                  <select id={`part-bit-${part._id}`} name="bitSizeOptionId" className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={part.bitSizeOptionId ?? ""}>
                                    <option value="">None</option>
                                    {catalogOptionsFor("bitSize").map((option) => (
                                      <option key={option._id} value={option._id}>{option.label}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="grid gap-2">
                                  <Label htmlFor={`part-storage-${part._id}`}>Storage</Label>
                                  <select id={`part-storage-${part._id}`} name="storageLocationOptionId" className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={part.storageLocationOptionId ?? ""}>
                                    <option value="">None</option>
                                    {catalogOptionsFor("storageLocation").map((option) => (
                                      <option key={option._id} value={option._id}>{option.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="grid gap-3 lg:grid-cols-3">
                                <Input name="onshapeDocumentUrl" type="url" placeholder="Onshape doc URL" defaultValue={part.onshapeDocumentUrl} />
                                <Input name="onshapePartStudioUrl" type="url" placeholder="Part studio URL" defaultValue={part.onshapePartStudioUrl} />
                                <Input name="onshapeDrawingUrl" type="url" placeholder="Drawing URL" defaultValue={part.onshapeDrawingUrl} />
                              </div>
                              <Textarea name="notes" placeholder="Notes" defaultValue={part.notes} />
                              <Button type="submit" className="w-full sm:w-fit">
                                <SaveIcon data-icon="inline-start" aria-hidden="true" />
                                Save details
                              </Button>
                            </form>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 md:hidden">
              {filteredParts.map((part) => (
                <PartCard key={part._id} part={part} subsystems={overview.subsystems} catalog={catalog} />
              ))}
            </div>
            {filteredParts.length === 0 && <EmptyState>No parts match this filter.</EmptyState>}
              </TabsContent>
              <TabsContent value="systems">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {overview.subsystems.map((subsystem) => {
                    const parts = overview.parts.filter((part) => part.subsystemId === subsystem._id);
                    const fabParts = parts.filter(
                      (part) => part.status === "readyForFab" || part.status === "inManufacturing",
                    );
                    const transmissions = overview.transmissions.filter(
                      (transmission) => transmission.subsystemId === subsystem._id,
                    );

                    return (
                      <section key={subsystem._id} className="rounded-md border bg-card p-4">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <h2 className="font-semibold">{subsystem.letter} - {subsystem.name}</h2>
                            <p className="text-sm text-muted-foreground">
                              Next {nextPartNumberPreview(subsystem.letter, subsystem.nextPartNumber)}
                            </p>
                          </div>
                          <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
                            {parts.length}
                          </span>
                        </div>
                        <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="rounded-md bg-muted p-2">
                            <p className="text-lg font-semibold">{parts.filter((part) => part.status !== "deprecated").length}</p>
                            <p className="text-muted-foreground">active</p>
                          </div>
                          <div className="rounded-md bg-muted p-2">
                            <p className="text-lg font-semibold">{fabParts.length}</p>
                            <p className="text-muted-foreground">fab</p>
                          </div>
                          <div className="rounded-md bg-muted p-2">
                            <p className="text-lg font-semibold">{transmissions.length}</p>
                            <p className="text-muted-foreground">trans</p>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          {parts.slice(0, 5).map((part) => (
                            <Link
                              key={part._id}
                              to={`/parts/${part._id}`}
                              className="rounded-md border p-2 text-sm transition-colors hover:bg-muted/50"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-medium">{part.partNumber ?? "Draft"}</span>
                                <span className="text-xs text-muted-foreground">Qty {part.quantity}</span>
                              </div>
                              <p className="mt-1 line-clamp-1 text-muted-foreground">{part.name}</p>
                            </Link>
                          ))}
                          {parts.length === 0 && <EmptyState>No parts in this subsystem.</EmptyState>}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </TabsContent>
              <TabsContent value="fab">
                <div className="grid gap-3">
                  {overview.manufacturing.map((part) => (
                    <div key={part._id} className="rounded-md border bg-card p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link to={`/parts/${part._id}`} className="font-semibold hover:underline">
                            {part.partNumber ?? "Draft"} - {part.name}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {subsystemName(overview.subsystems, part.subsystemId)} / {catalogLabel(catalog, part.materialOptionId)} / {part.sizeProfile || "No profile"}
                          </p>
                        </div>
                        <StatusPill status={part.status} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {part.status === "readyForFab" && (
                          <Button size="sm" variant="outline" onClick={() => move(part._id, "inManufacturing")}>
                            <PlayIcon data-icon="inline-start" aria-hidden="true" />
                            Start
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => move(part._id, "manufactured")}>Manufactured</Button>
                        <Button size="sm" variant="outline" onClick={() => move(part._id, "stored")}>Stored</Button>
                        <Button size="sm" variant="outline" onClick={() => move(part._id, "onRobot")}>On robot</Button>
                      </div>
                    </div>
                  ))}
                  {overview.manufacturing.length === 0 && <EmptyState>No parts are ready for fab.</EmptyState>}
                </div>
              </TabsContent>
              <TabsContent value="transmissions">
                <div className="grid gap-3">
                  {overview.transmissions.map((transmission) => (
                    <div key={transmission._id} className="rounded-md border bg-card p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-semibold">{transmission.name}</h2>
                          <p className="text-sm text-muted-foreground">
                            {subsystemName(overview.subsystems, transmission.subsystemId)} / {transmission.ratio || calculatedRatio(transmission.driverTeeth, transmission.drivenTeeth) || "ratio TBD"}
                          </p>
                        </div>
                        {transmission.calculatorUrl && (
                          <Button size="icon" variant="outline" asChild>
                            <a href={transmission.calculatorUrl} target="_blank" rel="noreferrer">
                              <ExternalLinkIcon aria-hidden="true" />
                            </a>
                          </Button>
                        )}
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-4">
                        <span>Driver {transmission.driverTeeth ?? "TBD"}</span>
                        <span>Driven {transmission.drivenTeeth ?? "TBD"}</span>
                        <span>Belt {transmission.beltTeeth ?? "TBD"}</span>
                        <span>Center {transmission.centerDistance || "TBD"}</span>
                      </div>
                    </div>
                  ))}
                  {overview.transmissions.length === 0 && <EmptyState>No transmissions have been added.</EmptyState>}
                  <Button asChild className="w-full sm:w-fit">
                    <Link to="/parts/transmissions">
                      <PlusIcon data-icon="inline-start" aria-hidden="true" />
                      Add transmission
                    </Link>
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="orders">
                <div className="grid gap-3">
                  {overview.orders.map((order) => (
                    <div key={order._id} className="rounded-md border bg-card p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 className="font-semibold">{order.itemName}</h2>
                          <p className="text-sm text-muted-foreground">
                            {order.vendor || "No vendor"} / Qty {order.quantity}
                          </p>
                        </div>
                        <StatusPill status={order.status} />
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{order.reason}</p>
                    </div>
                  ))}
                  {overview.orders.length === 0 && <EmptyState>No order requests yet.</EmptyState>}
                  <Button asChild className="w-full sm:w-fit">
                    <Link to="/parts/orders">
                      <ShoppingCartIcon data-icon="inline-start" aria-hidden="true" />
                      New order
                    </Link>
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </>
        );
      }}
    </RequireSeason>
  );
}

function OptionButtons({
  options,
  value,
  onChange,
}: {
  options: Doc<"catalogOptions">[];
  value: Id<"catalogOptions"> | null;
  onChange: (value: Id<"catalogOptions"> | null) => void;
}) {
  return (
    <div className="grid gap-2 sm:flex sm:flex-wrap">
      <Button
        type="button"
        size="sm"
        className="w-full sm:w-auto"
        variant={value === null ? "default" : "outline"}
        onClick={() => onChange(null)}
      >
        None
      </Button>
      {options.filter((option) => option.isEnabled).map((option) => (
        <Button
          key={option._id}
          type="button"
          size="sm"
          className="w-full sm:w-auto"
          variant={value === option._id ? "default" : "outline"}
          onClick={() => onChange(option._id)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

export function GeneratePartRoute() {
  const navigate = useNavigate();
  const generateNumber = useMutation(api.parts.generateNumber);
  const saveDraft = useMutation(api.parts.saveDraft);
  const [subsystemId, setSubsystemId] = useState<Id<"subsystems"> | null>(null);
  const [kind, setKind] = useState<"part" | "assembly">("part");
  const [priority, setPriority] = useState<Priority>("normal");
  const [materialOptionId, setMaterialOptionId] = useState<Id<"catalogOptions"> | null>(null);
  const [toolOptionId, setToolOptionId] = useState<Id<"catalogOptions"> | null>(null);
  const [bitSizeOptionId, setBitSizeOptionId] = useState<Id<"catalogOptions"> | null>(null);
  const [storageLocationOptionId, setStorageLocationOptionId] = useState<Id<"catalogOptions"> | null>(null);
  const [submitMode, setSubmitMode] = useState<"draft" | "generate">("generate");

  return (
    <RequireSeason>
      {(overview, active, catalog) => {
        const enabledSubsystems = overview.subsystems.filter((subsystem) => subsystem.isEnabled);
        const selectedSubsystem = enabledSubsystems.find((subsystem) => subsystem._id === subsystemId) ?? enabledSubsystems[0];
        const activeSubsystemId = subsystemId ?? selectedSubsystem?._id ?? null;

        async function handleSubmit(event: FormEvent<HTMLFormElement>, mode: "draft" | "generate") {
          event.preventDefault();

          if (!activeSubsystemId) {
            toast.error("Create a subsystem before adding parts.");
            return;
          }

          const formData = new FormData(event.currentTarget);
          const payload = {
            seasonId: active.season!._id,
            subsystemId: activeSubsystemId,
            name: String(formData.get("name") ?? ""),
            kind,
            quantity: Number(formData.get("quantity") ?? 1),
            priority,
            materialOptionId,
            toolOptionId,
            bitSizeOptionId,
            sizeProfile: String(formData.get("sizeProfile") ?? ""),
            storageLocationOptionId,
            onshapeDocumentUrl: String(formData.get("onshapeDocumentUrl") ?? ""),
            onshapePartStudioUrl: String(formData.get("onshapePartStudioUrl") ?? ""),
            onshapeDrawingUrl: String(formData.get("onshapeDrawingUrl") ?? ""),
            notes: String(formData.get("notes") ?? ""),
            supersedesPartId: null,
          };

          try {
            const partId = mode === "generate"
              ? (await generateNumber({
                  seasonId: active.season!._id,
                  subsystemId: activeSubsystemId,
                  name: payload.name,
                })).partId
              : await saveDraft(payload);
            toast.success(mode === "generate" ? "Part number generated" : "Draft saved");
            navigate(`/parts/${partId}`);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not save part");
          }
        }

        return (
          <>
            <PageHeader
              title="Generate part"
              description="Create a canonical part number and add the part to the fab queue."
            />
            <form className="grid gap-5 lg:grid-cols-[1fr_320px]" onSubmit={(event) => handleSubmit(event, submitMode)}>
              <div className="grid gap-4 rounded-md border bg-card p-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Part name</Label>
                  <Input id="name" name="name" required placeholder="Drive rail left" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="subsystemId">Subsystem</Label>
                  <select
                    id="subsystemId"
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={activeSubsystemId ?? ""}
                    onChange={(event) => setSubsystemId(event.currentTarget.value as Id<"subsystems">)}
                    required
                  >
                    {enabledSubsystems.map((subsystem) => (
                      <option key={subsystem._id} value={subsystem._id}>
                        {subsystem.name} ({subsystem.letter})
                      </option>
                    ))}
                  </select>
                  {selectedSubsystem && (
                    <div className="rounded-md border bg-muted p-3 text-sm">
                      <p className="font-medium">
                        Next part number: {nextPartNumberPreview(selectedSubsystem.letter, selectedSubsystem.nextPartNumber)}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {selectedSubsystem.letter} is the subsystem code for {selectedSubsystem.name}. The next number is reserved only when you generate the part.
                      </p>
                    </div>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Kind</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["part", "assembly"] as const).map((item) => (
                        <Button key={item} type="button" variant={kind === item ? "default" : "outline"} onClick={() => setKind(item)}>
                          {item}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} required />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sizeProfile">Size/Profile</Label>
                  <Input id="sizeProfile" name="sizeProfile" placeholder='1/8" sheet, 2x1 tube, 5mm plate' />
                </div>
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    {priorities.map((item) => (
                      <Button
                        key={item}
                        type="button"
                        size="sm"
                        className="w-full sm:w-auto"
                        variant={priority === item ? "default" : "outline"}
                        onClick={() => setPriority(item)}
                      >
                        {item}
                      </Button>
                    ))}
                  </div>
                </div>
                {(["material", "tool", "bitSize", "storageLocation"] as const).map((kindName) => (
                  <div key={kindName} className="grid gap-2">
                    <Label>{kindName}</Label>
                    <OptionButtons
                      options={catalog.filter((option) => option.kind === kindName)}
                      value={
                        kindName === "material"
                          ? materialOptionId
                          : kindName === "tool"
                            ? toolOptionId
                            : kindName === "bitSize"
                              ? bitSizeOptionId
                              : storageLocationOptionId
                      }
                      onChange={
                        kindName === "material"
                          ? setMaterialOptionId
                          : kindName === "tool"
                            ? setToolOptionId
                            : kindName === "bitSize"
                              ? setBitSizeOptionId
                              : setStorageLocationOptionId
                      }
                    />
                  </div>
                ))}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="onshapeDocumentUrl">Onshape doc</Label>
                    <Input id="onshapeDocumentUrl" name="onshapeDocumentUrl" type="url" placeholder="https://cad.onshape.com/..." />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="onshapePartStudioUrl">Part studio</Label>
                    <Input id="onshapePartStudioUrl" name="onshapePartStudioUrl" type="url" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="onshapeDrawingUrl">Drawing</Label>
                    <Input id="onshapeDrawingUrl" name="onshapeDrawingUrl" type="url" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" placeholder="Setup, tolerances, or fabrication notes" />
                </div>
              </div>
              <aside className="h-fit rounded-md border bg-card p-4">
                <h2 className="font-semibold">Design to fab</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Generate consumes the next subsystem number and marks the part ready for fab.
                </p>
                <div className="mt-4 grid gap-2">
                  <Button type="submit" onClick={() => setSubmitMode("generate")}>
                    <BadgePlusIcon data-icon="inline-start" aria-hidden="true" />
                    Generate part
                  </Button>
                  <Button type="submit" variant="outline" onClick={() => setSubmitMode("draft")}>
                    <SaveIcon data-icon="inline-start" aria-hidden="true" />
                    Save draft
                  </Button>
                </div>
              </aside>
            </form>
          </>
        );
      }}
    </RequireSeason>
  );
}

export function BomRoute() {
  return (
    <RequireSeason>
      {(overview, _active, catalog) => (
        <>
          <PageHeader title="BOM" description="Robot bill of materials separated by subsystem." />
          <div className="grid gap-4">
            {overview.subsystems.map((subsystem) => {
              const parts = overview.parts.filter((part) => part.subsystemId === subsystem._id);
              return (
                <section key={subsystem._id} className="rounded-md border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold">{subsystem.letter} - {subsystem.name}</h2>
                    <span className="text-sm text-muted-foreground">{parts.length} parts</span>
                  </div>
                  <div className="grid gap-2">
                    {parts.map((part) => (
                      <PartCard key={part._id} part={part} subsystems={overview.subsystems} catalog={catalog} />
                    ))}
                    {parts.length === 0 && <EmptyState>No BOM items in this subsystem.</EmptyState>}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </RequireSeason>
  );
}

export function SystemListRoute() {
  return (
    <RequireSeason>
      {(overview, _active, catalog) => (
        <>
          <PageHeader
            title="System list"
            description="Subsystem reference for every part, fab item, and transmission."
            action={
              <Button asChild variant="outline">
                <Link to="/parts">
                  <PlusIcon data-icon="inline-start" aria-hidden="true" />
                  New part
                </Link>
              </Button>
            }
          />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overview.subsystems.map((subsystem) => {
              const parts = overview.parts.filter((part) => part.subsystemId === subsystem._id);
              const fabParts = parts.filter(
                (part) => part.status === "readyForFab" || part.status === "inManufacturing",
              );
              const transmissions = overview.transmissions.filter(
                (transmission) => transmission.subsystemId === subsystem._id,
              );

              return (
                <section key={subsystem._id} className="rounded-md border bg-card p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{subsystem.letter} - {subsystem.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        Next part {nextPartNumberPreview(subsystem.letter, subsystem.nextPartNumber)}
                      </p>
                    </div>
                    <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
                      {parts.length} parts
                    </span>
                  </div>
                  <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-md bg-muted p-2">
                      <p className="text-lg font-semibold">{parts.filter((part) => part.status !== "deprecated").length}</p>
                      <p className="text-muted-foreground">active</p>
                    </div>
                    <div className="rounded-md bg-muted p-2">
                      <p className="text-lg font-semibold">{fabParts.length}</p>
                      <p className="text-muted-foreground">fab</p>
                    </div>
                    <div className="rounded-md bg-muted p-2">
                      <p className="text-lg font-semibold">{transmissions.length}</p>
                      <p className="text-muted-foreground">trans</p>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    {parts.slice(0, 8).map((part) => (
                      <Link
                        key={part._id}
                        to={`/parts/${part._id}`}
                        className="rounded-md border p-2 text-sm transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium">{part.partNumber ?? "Draft"}</span>
                          <span className="text-xs text-muted-foreground">Qty {part.quantity}</span>
                        </div>
                        <p className="mt-1 line-clamp-1 text-muted-foreground">{part.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {catalogLabel(catalog, part.materialOptionId)}
                          {part.sizeProfile ? ` / ${part.sizeProfile}` : ""}
                        </p>
                      </Link>
                    ))}
                    {parts.length === 0 && <EmptyState>No parts in this subsystem.</EmptyState>}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </RequireSeason>
  );
}

export function ManufacturingRoute() {
  const { manufacturingStatusFilter, setManufacturingStatusFilter } = useUiStore();
  const updateStatus = useMutation(api.parts.updateStatus);

  return (
    <RequireSeason>
      {(overview, _active, catalog) => {
        const parts = overview.parts.filter((part) => part.status === manufacturingStatusFilter);

        async function move(partId: Id<"parts">, status: PartStatus) {
          try {
            await updateStatus({ partId, status, note: "", storageLocationOptionId: null });
            toast.success("Status updated");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Status update failed");
          }
        }

        return (
          <>
            <PageHeader
              title="Manufacturing"
              description="Parts marked ready for fab automatically appear here."
            />
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {partStatuses.filter((status) => status !== "draft").map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={manufacturingStatusFilter === status ? "default" : "outline"}
                  onClick={() => setManufacturingStatusFilter(status)}
                >
                  {partStatusLabel(status)}
                </Button>
              ))}
            </div>
            <div className="grid gap-3">
              {parts.map((part) => (
                <div key={part._id} className="rounded-md border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link to={`/parts/${part._id}`} className="font-semibold hover:underline">
                        {part.partNumber ?? "Draft"} - {part.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {catalogLabel(catalog, part.materialOptionId)} / {catalogLabel(catalog, part.toolOptionId)} / {catalogLabel(catalog, part.bitSizeOptionId)}
                      </p>
                    </div>
                    <StatusPill status={part.status} />
                  </div>
                  <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                    {part.status === "readyForFab" && (
                      <Button size="sm" className="w-full sm:w-auto" variant="outline" onClick={() => move(part._id, "inManufacturing")}>
                        <PlayIcon data-icon="inline-start" aria-hidden="true" />
                        Start
                      </Button>
                    )}
                    {part.status !== "readyForFab" && (
                      <Button size="sm" className="w-full sm:w-auto" variant="outline" onClick={() => move(part._id, "readyForFab")}>
                        <CheckCircle2Icon data-icon="inline-start" aria-hidden="true" />
                        Ready
                      </Button>
                    )}
                    <Button size="sm" className="w-full sm:w-auto" variant="outline" onClick={() => move(part._id, "manufactured")}>Manufactured</Button>
                    <Button size="sm" className="w-full sm:w-auto" variant="outline" onClick={() => move(part._id, "stored")}>Stored</Button>
                    <Button size="sm" className="w-full sm:w-auto" variant="outline" onClick={() => move(part._id, "onRobot")}>On robot</Button>
                  </div>
                </div>
              ))}
              {parts.length === 0 && <EmptyState>No parts in this status.</EmptyState>}
            </div>
          </>
        );
      }}
    </RequireSeason>
  );
}

type TransmissionImport = {
  name?: string;
  ratio?: string;
  driverTeeth?: string;
  drivenTeeth?: string;
  beltTeeth?: string;
  centerDistance?: string;
};

function parseTransmissionUrl(value: string): TransmissionImport {
  if (!value.trim()) {
    return {};
  }

  try {
    const url = new URL(value);
    const params = new URLSearchParams(url.search);
    const hashQuery = url.hash.includes("?") ? url.hash.slice(url.hash.indexOf("?")) : url.hash.replace(/^#/, "");
    const hashParams = new URLSearchParams(hashQuery);
    const allParams = [params, hashParams];
    const first = (...keys: string[]) => {
      for (const source of allParams) {
        for (const key of keys) {
          const found = source.get(key);
          if (found) {
            return found;
          }
        }
      }
      return undefined;
    };

    const driverTeeth = first("driverTeeth", "driver", "smallPulleyTeeth", "smallTeeth", "inputTeeth", "motorTeeth");
    const drivenTeeth = first("drivenTeeth", "driven", "largePulleyTeeth", "largeTeeth", "outputTeeth");
    const ratio = first("ratio");

    return {
      name: first("name", "title", "mechanism"),
      ratio: ratio ?? calculatedRatio(driverTeeth, drivenTeeth),
      driverTeeth,
      drivenTeeth,
      beltTeeth: first("beltTeeth", "belt", "beltLength", "beltToothCount"),
      centerDistance: first("centerDistance", "center", "cc", "targetCenterDistance"),
    };
  } catch {
    return {};
  }
}

function calculatedRatio(driverTeeth?: string | number | null, drivenTeeth?: string | number | null) {
  const driver = Number(driverTeeth);
  const driven = Number(drivenTeeth);

  if (!driver || !driven) {
    return "";
  }

  return `${Number((driven / driver).toFixed(3))}:1`;
}

function setFormValue(form: HTMLFormElement | null, name: string, value: string | undefined) {
  if (!form || !value) {
    return;
  }

  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    field.value = value;
  }
}

export function TransmissionsRoute() {
  const upsert = useMutation(api.transmissions.upsert);
  const [subsystemId, setSubsystemId] = useState<Id<"subsystems"> | null>(null);

  return (
    <RequireSeason>
      {(overview, active) => {
        const selectedSubsystem =
          overview.subsystems.find((subsystem) => subsystem._id === subsystemId) ??
          overview.subsystems[0];

        async function handleSubmit(event: FormEvent<HTMLFormElement>) {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const subsystem = selectedSubsystem;

          if (!subsystem) {
            toast.error("Create a subsystem first.");
            return;
          }

          const driverTeeth = Number(formData.get("driverTeeth") || 0) || null;
          const drivenTeeth = Number(formData.get("drivenTeeth") || 0) || null;
          const ratio = String(formData.get("ratio") ?? "") || calculatedRatio(driverTeeth, drivenTeeth);

          try {
            await upsert({
              seasonId: active.season!._id,
              subsystemId: subsystem._id,
              name: String(formData.get("name") ?? ""),
              ratio,
              driverTeeth,
              drivenTeeth,
              beltTeeth: Number(formData.get("beltTeeth") || 0) || null,
              centerDistance: String(formData.get("centerDistance") ?? ""),
              calculatorUrl: String(formData.get("calculatorUrl") ?? ""),
              notes: String(formData.get("notes") ?? ""),
            });
            event.currentTarget.reset();
            toast.success("Transmission saved");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not save transmission");
          }
        }

        return (
          <>
            <PageHeader title="Transmissions" description="Power transmission summary with ReCalc and design calculator links." />
            <form className="mb-4 grid gap-3 rounded-md border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={handleSubmit}>
              <Input name="name" placeholder="Shooter belt" required />
              <Input name="ratio" placeholder="1.5:1" />
              <Input name="driverTeeth" type="number" placeholder="Driver teeth" />
              <Input name="drivenTeeth" type="number" placeholder="Driven teeth" />
              <Input name="beltTeeth" type="number" placeholder="Belt teeth" />
              <Input name="centerDistance" placeholder="5 in" />
              <div className="grid gap-2 sm:col-span-2 lg:col-span-4">
                <Label>Subsystem</Label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {overview.subsystems.map((subsystem) => (
                    <Button
                      key={subsystem._id}
                      type="button"
                      size="sm"
                      variant={selectedSubsystem?._id === subsystem._id ? "default" : "outline"}
                      onClick={() => setSubsystemId(subsystem._id)}
                    >
                      {subsystem.letter}
                    </Button>
                  ))}
                </div>
              </div>
              <Input
                name="calculatorUrl"
                type="url"
                placeholder="https://www.reca.lc/..."
                className="lg:col-span-2"
                onBlur={(event) => {
                  const imported = parseTransmissionUrl(event.currentTarget.value);
                  setFormValue(event.currentTarget.form, "name", imported.name);
                  setFormValue(event.currentTarget.form, "ratio", imported.ratio);
                  setFormValue(event.currentTarget.form, "driverTeeth", imported.driverTeeth);
                  setFormValue(event.currentTarget.form, "drivenTeeth", imported.drivenTeeth);
                  setFormValue(event.currentTarget.form, "beltTeeth", imported.beltTeeth);
                  setFormValue(event.currentTarget.form, "centerDistance", imported.centerDistance);
                }}
              />
              <Textarea name="notes" placeholder="Notes" className="sm:col-span-2 lg:col-span-3" />
              <Button type="submit">
                <SaveIcon data-icon="inline-start" aria-hidden="true" />
                Save
              </Button>
            </form>
            <div className="grid gap-3">
              {overview.transmissions.map((transmission) => (
                <div key={transmission._id} className="rounded-md border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{transmission.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {subsystemName(overview.subsystems, transmission.subsystemId)} / {transmission.ratio || "ratio TBD"}
                      </p>
                    </div>
                    {transmission.calculatorUrl && (
                      <Button size="icon" variant="outline" asChild><a href={transmission.calculatorUrl} target="_blank" rel="noreferrer"><ExternalLinkIcon aria-hidden="true" /></a></Button>
                    )}
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-4">
                    <span>Driver {transmission.driverTeeth ?? "TBD"}</span>
                    <span>Driven {transmission.drivenTeeth ?? "TBD"}</span>
                    <span>Belt {transmission.beltTeeth ?? "TBD"}</span>
                    <span>Center {transmission.centerDistance || "TBD"}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{transmission.notes || "No notes yet."}</p>
                </div>
              ))}
              {overview.transmissions.length === 0 && <EmptyState>No transmissions have been added.</EmptyState>}
            </div>
          </>
        );
      }}
    </RequireSeason>
  );
}

export function OrdersRoute() {
  const submit = useMutation(api.orderRequests.submit);
  const updateStatus = useMutation(api.orderRequests.updateStatus);
  const { effectiveRoleView } = useUiStore();

  return (
    <RequireSeason>
      {(overview, active) => {
        const effectiveRole = resolveEffectiveRole(
          active.profile.role,
          effectiveRoleView,
        );

        async function handleSubmit(event: FormEvent<HTMLFormElement>) {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);

          try {
            await submit({
              seasonId: active.season!._id,
              subsystemId: overview.subsystems[0]?._id ?? null,
              partId: null,
              itemName: String(formData.get("itemName") ?? ""),
              vendor: String(formData.get("vendor") ?? ""),
              url: String(formData.get("url") ?? ""),
              quantity: Number(formData.get("quantity") ?? 1),
              estimatedCost: Number(formData.get("estimatedCost") || 0) || null,
              reason: String(formData.get("reason") ?? ""),
              notes: "",
            });
            event.currentTarget.reset();
            toast.success("Order request submitted");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not submit order");
          }
        }

        async function advance(orderRequestId: Id<"orderRequests">, status: OrderStatus, notes: string) {
          try {
            await updateStatus({ orderRequestId, status, notes });
            toast.success("Order updated");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Order update failed");
          }
        }

        return (
          <>
            <PageHeader title="Orders" description="Student requests tracked from requested to delivered." />
            <form className="mb-4 grid gap-3 rounded-md border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5" onSubmit={handleSubmit}>
              <Input name="itemName" placeholder="Item name" required />
              <Input name="vendor" placeholder="Vendor" />
              <Input name="url" type="url" placeholder="Product URL" />
              <Input name="quantity" type="number" min={1} defaultValue={1} required />
              <Input name="estimatedCost" type="number" min={0} step="0.01" placeholder="Est. cost" />
              <Textarea name="reason" placeholder="Why do we need this?" className="sm:col-span-2 lg:col-span-4" />
              <Button type="submit">
                <ShoppingCartIcon data-icon="inline-start" aria-hidden="true" />
                Request
              </Button>
            </form>
            <div className="grid gap-3">
              {overview.orders.map((order) => (
                <div key={order._id} className="rounded-md border bg-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{order.itemName}</h2>
                      <p className="text-sm text-muted-foreground">
                        {order.vendor || "No vendor"} / Qty {order.quantity}
                      </p>
                    </div>
                    <StatusPill status={order.status} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{order.reason}</p>
                  {canAdvanceOrders(effectiveRole) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {orderStatuses.filter((status) => status !== order.status).map((status) => (
                        <Button key={status} size="sm" variant="outline" onClick={() => advance(order._id, status, order.notes)}>
                          {orderStatusLabel(status)}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {overview.orders.length === 0 && <EmptyState>No order requests yet.</EmptyState>}
            </div>
          </>
        );
      }}
    </RequireSeason>
  );
}

export function PartDetailRoute() {
  const { partId } = useParams();
  const detail = useQuery(api.parts.detail, partId ? { partId: partId as Id<"parts"> } : "skip");
  const { overview, catalog } = useSeasonData();
  const updatePart = useMutation(api.parts.update);
  const updateStatus = useMutation(api.parts.updateStatus);
  const addBomLink = useMutation(api.parts.addBomLink);

  if (!partId || !detail || !overview) {
    return <LoadingState />;
  }

  if (!detail.part) {
    return <EmptyState>Part not found.</EmptyState>;
  }

  const part = detail.part;
  const candidateChildren = overview.parts.filter((candidate) => candidate._id !== part._id);
  const catalogOptionsFor = (kind: Doc<"catalogOptions">["kind"]) =>
    catalog.filter((option) => option.kind === kind && option.isEnabled);
  const optionValue = (value: FormDataEntryValue | null) => {
    const optionId = String(value ?? "");
    return optionId ? optionId as Id<"catalogOptions"> : null;
  };

  async function move(status: PartStatus) {
    try {
      await updateStatus({ partId: part._id, status, note: "", storageLocationOptionId: null });
      toast.success("Status updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Status update failed");
    }
  }

  async function addChild(childPartId: Id<"parts">) {
    try {
      await addBomLink({ parentPartId: part._id, childPartId, quantity: 1, notes: "" });
      toast.success("BOM link added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add BOM link");
    }
  }

  async function savePart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      await updatePart({
        partId: part._id,
        name: String(formData.get("name") ?? ""),
        kind: String(formData.get("kind") ?? "part") as "part" | "assembly",
        quantity: Number(formData.get("quantity") ?? 1),
        priority: String(formData.get("priority") ?? "normal") as Priority,
        materialOptionId: optionValue(formData.get("materialOptionId")),
        toolOptionId: optionValue(formData.get("toolOptionId")),
        bitSizeOptionId: optionValue(formData.get("bitSizeOptionId")),
        sizeProfile: String(formData.get("sizeProfile") ?? ""),
        storageLocationOptionId: optionValue(formData.get("storageLocationOptionId")),
        onshapeDocumentUrl: String(formData.get("onshapeDocumentUrl") ?? ""),
        onshapePartStudioUrl: String(formData.get("onshapePartStudioUrl") ?? ""),
        onshapeDrawingUrl: String(formData.get("onshapeDrawingUrl") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      });
      toast.success("Part details saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save part");
    }
  }

  return (
    <>
      <PageHeader
        title={`${part.partNumber ?? "Draft"} ${part.name}`}
        description={`${subsystemName(overview.subsystems, part.subsystemId)} lifecycle and BOM details.`}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <section className="grid gap-4">
          <div className="rounded-md border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <StatusPill status={part.status} />
              <span className="text-sm text-muted-foreground">Qty {part.quantity}</span>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>Material: {catalogLabel(catalog, part.materialOptionId)}</p>
              <p>Tool: {catalogLabel(catalog, part.toolOptionId)}</p>
              <p>Bit: {catalogLabel(catalog, part.bitSizeOptionId)}</p>
              <p>Size/Profile: {part.sizeProfile || "None"}</p>
              <p>Storage: {catalogLabel(catalog, part.storageLocationOptionId)}</p>
            </div>
            <Separator className="my-4" />
            <p className="text-sm text-muted-foreground">{part.notes || "No notes yet."}</p>
            <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
              {part.onshapeDocumentUrl && <Button size="sm" className="w-full sm:w-auto" variant="outline" asChild><a href={part.onshapeDocumentUrl} target="_blank" rel="noreferrer">Onshape doc</a></Button>}
              {part.onshapePartStudioUrl && <Button size="sm" className="w-full sm:w-auto" variant="outline" asChild><a href={part.onshapePartStudioUrl} target="_blank" rel="noreferrer">Part studio</a></Button>}
              {part.onshapeDrawingUrl && <Button size="sm" className="w-full sm:w-auto" variant="outline" asChild><a href={part.onshapeDrawingUrl} target="_blank" rel="noreferrer">Drawing</a></Button>}
            </div>
          </div>
          <form className="grid gap-4 rounded-md border bg-card p-4" onSubmit={savePart}>
            <div>
              <h2 className="font-semibold">Edit part details</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Designers can update part metadata after a number has been generated.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Part name</Label>
                <Input id="edit-name" name="name" defaultValue={part.name} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-quantity">Quantity</Label>
                <Input id="edit-quantity" name="quantity" type="number" min={1} defaultValue={part.quantity} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-kind">Kind</Label>
                <select id="edit-kind" name="kind" className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={part.kind}>
                  <option value="part">Part</option>
                  <option value="assembly">Assembly</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-priority">Priority</Label>
                <select id="edit-priority" name="priority" className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={part.priority}>
                  {priorities.map((priority) => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-material">Material</Label>
                <select id="edit-material" name="materialOptionId" className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={part.materialOptionId ?? ""}>
                  <option value="">None</option>
                  {catalogOptionsFor("material").map((option) => (
                    <option key={option._id} value={option._id}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-size-profile">Size/Profile</Label>
                <Input id="edit-size-profile" name="sizeProfile" defaultValue={part.sizeProfile ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-tool">Tool</Label>
                <select id="edit-tool" name="toolOptionId" className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={part.toolOptionId ?? ""}>
                  <option value="">None</option>
                  {catalogOptionsFor("tool").map((option) => (
                    <option key={option._id} value={option._id}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-bit">Bit size</Label>
                <select id="edit-bit" name="bitSizeOptionId" className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={part.bitSizeOptionId ?? ""}>
                  <option value="">None</option>
                  {catalogOptionsFor("bitSize").map((option) => (
                    <option key={option._id} value={option._id}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-storage">Storage</Label>
                <select id="edit-storage" name="storageLocationOptionId" className="h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue={part.storageLocationOptionId ?? ""}>
                  <option value="">None</option>
                  {catalogOptionsFor("storageLocation").map((option) => (
                    <option key={option._id} value={option._id}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="edit-onshape-doc">Onshape doc</Label>
                <Input id="edit-onshape-doc" name="onshapeDocumentUrl" type="url" defaultValue={part.onshapeDocumentUrl} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-part-studio">Part studio</Label>
                <Input id="edit-part-studio" name="onshapePartStudioUrl" type="url" defaultValue={part.onshapePartStudioUrl} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-drawing">Drawing</Label>
                <Input id="edit-drawing" name="onshapeDrawingUrl" type="url" defaultValue={part.onshapeDrawingUrl} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea id="edit-notes" name="notes" defaultValue={part.notes} />
            </div>
            <Button type="submit" className="w-full sm:w-fit">
              <SaveIcon data-icon="inline-start" aria-hidden="true" />
              Save changes
            </Button>
          </form>
          <div className="rounded-md border bg-card p-4">
            <h2 className="mb-3 font-semibold">Lifecycle</h2>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {partStatuses.map((status) => (
                <Button
                  key={status}
                  size="sm"
                  className="w-full sm:w-auto"
                  variant={part.status === status ? "default" : "outline"}
                  onClick={() => move(status)}
                >
                  {status === "readyForFab" ? "Ready for manufacturing" : partStatusLabel(status)}
                </Button>
              ))}
            </div>
          </div>
          <div className="rounded-md border bg-card p-4">
            <h2 className="mb-3 font-semibold">Events</h2>
            <div className="grid gap-2">
              {detail.events.map((event) => (
                <div key={event._id} className="rounded-md border p-2 text-sm">
                  <p className="font-medium">{event.eventType}</p>
                  <p className="text-muted-foreground">{event.note || `${event.fromStatus ?? ""} -> ${event.toStatus ?? ""}`}</p>
                </div>
              ))}
              {detail.events.length === 0 && <EmptyState>No events recorded.</EmptyState>}
            </div>
          </div>
        </section>
        <aside className="grid h-fit gap-4">
          <div className="rounded-md border bg-card p-4">
            <h2 className="mb-3 font-semibold">BOM children</h2>
            <div className="grid gap-2">
              {detail.children.map((link) => {
                const child = overview.parts.find((candidate) => candidate._id === link.childPartId);
                return (
                  <div key={link._id} className="rounded-md border p-2 text-sm">
                    {child?.partNumber ?? "Unknown"} - {child?.name ?? "Missing part"} x{link.quantity}
                  </div>
                );
              })}
              {detail.children.length === 0 && <EmptyState>No child parts linked.</EmptyState>}
            </div>
          </div>
          <div className="rounded-md border bg-card p-4">
            <h2 className="mb-3 font-semibold">Add child</h2>
            <div className="grid max-h-80 gap-2 overflow-auto">
              {candidateChildren.slice(0, 30).map((candidate) => (
                <Button
                  key={candidate._id}
                  size="sm"
                  variant="outline"
                  className="h-auto min-h-9 w-full justify-start whitespace-normal text-left"
                  onClick={() => addChild(candidate._id)}
                >
                  {candidate.partNumber ?? "Draft"} - {candidate.name}
                </Button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

export function AdminRoute() {
  const seedDefaults = useMutation(api.setup.seedDefaults);
  const upsertSubsystem = useMutation(api.subsystems.upsert);
  const upsertCatalog = useMutation(api.catalog.upsert);
  const updateRole = useMutation(api.profiles.updateRole);
  const profiles = useQuery(api.profiles.list, {});
  const { effectiveRoleView } = useUiStore();

  return (
    <RequireSeason>
      {(overview, active) => {
        const effectiveRole = resolveEffectiveRole(
          active.profile.role,
          effectiveRoleView,
        );

        if (!canManageAdmin(effectiveRole)) {
          return <EmptyState>Admin access required.</EmptyState>;
        }

        async function seed() {
          try {
            await seedDefaults({ teamNumber: active.season!.teamNumber ?? "5199" });
            toast.success("Defaults refreshed");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Seed failed");
          }
        }

        async function addSubsystem(event: FormEvent<HTMLFormElement>) {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          try {
            await upsertSubsystem({
              seasonId: active.season!._id,
              letter: String(formData.get("letter") ?? ""),
              name: String(formData.get("name") ?? ""),
              isEnabled: true,
            });
            event.currentTarget.reset();
            toast.success("Subsystem saved");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Subsystem failed");
          }
        }

        async function addCatalog(event: FormEvent<HTMLFormElement>) {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          try {
            await upsertCatalog({
              kind: "material",
              label: String(formData.get("label") ?? ""),
              isEnabled: true,
            });
            event.currentTarget.reset();
            toast.success("Catalog option saved");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Catalog failed");
          }
        }

        async function setRole(profileId: Id<"profiles">, role: Role, isActive: boolean) {
          try {
            await updateRole({ profileId, role, isActive });
            toast.success("Profile updated");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Profile update failed");
          }
        }

        return (
          <>
            <PageHeader
              title="Admin"
              description="Manage team setup, subsystem letters, shop tags, and roles."
              action={<Button onClick={seed}><SettingsIcon data-icon="inline-start" aria-hidden="true" />Seed defaults</Button>}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-md border bg-card p-4">
                <h2 className="mb-3 font-semibold">Subsystems</h2>
                <form className="mb-3 grid grid-cols-[80px_1fr_auto] gap-2" onSubmit={addSubsystem}>
                  <Input name="letter" placeholder="D" required />
                  <Input name="name" placeholder="Drivetrain" required />
                  <Button type="submit" size="icon"><PlusIcon aria-hidden="true" /></Button>
                </form>
                <div className="grid gap-2">
                  {overview.subsystems.map((subsystem) => (
                    <div key={subsystem._id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <span>{subsystem.letter} - {subsystem.name}</span>
                      <span className={cn("text-xs", subsystem.isEnabled ? "text-muted-foreground" : "text-destructive")}>{subsystem.isEnabled ? "enabled" : "disabled"}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-md border bg-card p-4">
                <h2 className="mb-3 font-semibold">Material tags</h2>
                <form className="mb-3 grid grid-cols-[1fr_auto] gap-2" onSubmit={addCatalog}>
                  <Input name="label" placeholder="Carbon fiber plate" required />
                  <Button type="submit" size="icon"><PlusIcon aria-hidden="true" /></Button>
                </form>
                <p className="text-sm text-muted-foreground">Additional tools, bits, and storage locations can use the same catalog mutation in a later UI pass.</p>
              </section>
              <section className="rounded-md border bg-card p-4 lg:col-span-2">
                <h2 className="mb-3 font-semibold">Profiles</h2>
                <div className="grid gap-2">
                  {(profiles ?? []).map((profile) => (
                    <div key={profile._id} className="rounded-md border p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{profile.name}</p>
                          <p className="text-xs text-muted-foreground">{profile.email}</p>
                        </div>
                        <span className="text-sm">{profile.role}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {roles.map((role) => (
                          <Button key={role} size="sm" variant={profile.role === role ? "default" : "outline"} onClick={() => setRole(profile._id, role, profile.isActive)}>
                            {role}
                          </Button>
                        ))}
                        <Button size="sm" variant="outline" onClick={() => setRole(profile._id, profile.role, !profile.isActive)}>
                          {profile.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        );
      }}
    </RequireSeason>
  );
}
