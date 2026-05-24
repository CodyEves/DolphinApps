import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  BadgePlusIcon,
  ExternalLinkIcon,
  FactoryIcon,
  GaugeIcon,
  PackageIcon,
  PlusIcon,
  SaveIcon,
  SettingsIcon,
  ShoppingCartIcon,
  type LucideIcon,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/use-ui-store";

type ActiveContext = {
  profile: Doc<"profiles">;
  season: Doc<"seasons"> | null;
};

type OverviewData = {
  profile: Doc<"profiles">;
  season: Doc<"seasons"> | null;
  subsystems: Doc<"subsystems">[];
  parts: Doc<"parts">[];
  manufacturing: Doc<"parts">[];
  orders: Doc<"orderRequests">[];
  transmissions: Doc<"transmissions">[];
};

function useActiveContext() {
  const { isAuthenticated } = useConvexAuth();

  return useQuery(api.setup.activeSeason, isAuthenticated ? {} : "skip") as
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
      {action}
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
  const active = useActiveContext();
  const seasonId = active?.season?._id;
  const overview = useQuery(
    api.dashboard.overview,
    seasonId ? { seasonId } : "skip",
  ) as OverviewData | undefined;
  const catalog = useQuery(api.catalog.list, active ? {} : "skip") as
    | Doc<"catalogOptions">[]
    | undefined;

  return { active, overview, catalog: catalog ?? [] };
}

function SetupSeasonCallout({ profile }: { profile: Doc<"profiles"> }) {
  const seedDefaults = useMutation(api.setup.seedDefaults);
  const [isSeeding, setIsSeeding] = useState(false);
  const { effectiveRoleView } = useUiStore();
  const effectiveRole = resolveEffectiveRole(profile.role, effectiveRoleView);

  if (!canManageAdmin(effectiveRole)) {
    return (
      <EmptyState>
        An admin needs to seed the active season before parts can be generated.
      </EmptyState>
    );
  }

  async function handleSeed() {
    setIsSeeding(true);
    try {
      await seedDefaults({});
      toast.success("Default season, subsystems, and shop tags seeded");
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
        Seed editable subsystems and common material/tool tags for Team 5199.
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
    active: ActiveContext,
    catalog: Doc<"catalogOptions">[],
  ) => ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { active, overview, catalog } = useSeasonData();

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

  if (!active.season) {
    return <SetupSeasonCallout profile={active.profile} />;
  }

  if (!overview) {
    return <LoadingState />;
  }

  return children(overview, active, catalog);
}

function subsystemName(subsystems: Doc<"subsystems">[], subsystemId: Id<"subsystems">) {
  return subsystems.find((subsystem) => subsystem._id === subsystemId)?.name ?? "Unknown";
}

function catalogLabel(catalog: Doc<"catalogOptions">[], optionId: Id<"catalogOptions"> | null) {
  return optionId ? catalog.find((option) => option._id === optionId)?.label ?? "Unknown" : "None";
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
        <span>Qty {part.quantity}</span>
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
                <Button asChild><Link to="/parts/new"><BadgePlusIcon data-icon="inline-start" aria-hidden="true" />
                  Generate</Link></Button>
              }
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {([
                ["Active parts", activeParts.length, PackageIcon],
                ["In manufacturing", overview.manufacturing.length, FactoryIcon],
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
                      <span className="text-muted-foreground">{part.priority}</span>
                    </Link>
                  ))}
                  {overview.manufacturing.length === 0 && <EmptyState>No parts are in manufacturing.</EmptyState>}
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

  return (
    <RequireSeason>
      {(overview, _active, catalog) => {
        const filteredParts =
          partsSubsystemFilter === "all"
            ? overview.parts
            : overview.parts.filter((part) => part.subsystemId === partsSubsystemFilter);

        return (
          <>
            <PageHeader
              title="Parts"
              description="Generated part numbers, drafts, metadata, and Onshape links."
              action={
                <Button asChild><Link to="/parts/new"><PlusIcon data-icon="inline-start" aria-hidden="true" />
                  New part</Link></Button>
              }
            />
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
            <div className="grid gap-3">
              {filteredParts.map((part) => (
                <PartCard key={part._id} part={part} subsystems={overview.subsystems} catalog={catalog} />
              ))}
              {filteredParts.length === 0 && <EmptyState>No parts match this filter.</EmptyState>}
            </div>
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
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant={value === null ? "default" : "outline"} onClick={() => onChange(null)}>
        None
      </Button>
      {options.filter((option) => option.isEnabled).map((option) => (
        <Button
          key={option._id}
          type="button"
          size="sm"
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
  const generatePart = useMutation(api.parts.generate);
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
            storageLocationOptionId,
            onshapeDocumentUrl: String(formData.get("onshapeDocumentUrl") ?? ""),
            onshapePartStudioUrl: String(formData.get("onshapePartStudioUrl") ?? ""),
            onshapeDrawingUrl: String(formData.get("onshapeDrawingUrl") ?? ""),
            notes: String(formData.get("notes") ?? ""),
            supersedesPartId: null,
          };

          try {
            const partId = mode === "generate" ? await generatePart(payload) : await saveDraft(payload);
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
              description="Create a canonical part number and move the part into manufacturing."
            />
            <form className="grid gap-5 lg:grid-cols-[1fr_320px]" onSubmit={(event) => handleSubmit(event, submitMode)}>
              <div className="grid gap-4 rounded-md border bg-card p-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Part name</Label>
                  <Input id="name" name="name" required placeholder="Drive rail left" />
                </div>
                <div className="grid gap-2">
                  <Label>Subsystem</Label>
                  <div className="flex flex-wrap gap-2">
                    {enabledSubsystems.map((subsystem) => (
                      <Button
                        key={subsystem._id}
                        type="button"
                        variant={activeSubsystemId === subsystem._id ? "default" : "outline"}
                        onClick={() => setSubsystemId(subsystem._id)}
                      >
                        {subsystem.letter} - {subsystem.name}
                      </Button>
                    ))}
                  </div>
                  {selectedSubsystem && (
                    <p className="text-sm text-muted-foreground">
                      Next number: {nextPartNumberPreview(selectedSubsystem.letter, selectedSubsystem.nextPartNumber)}
                    </p>
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
                  <Label>Priority</Label>
                  <div className="flex flex-wrap gap-2">
                    {priorities.map((item) => (
                      <Button key={item} type="button" size="sm" variant={priority === item ? "default" : "outline"} onClick={() => setPriority(item)}>
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
                  Generate consumes the next subsystem number and moves the part to manufacturing.
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
            <PageHeader title="Manufacturing" description="Shop queue and fabrication status." />
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
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => move(part._id, "manufactured")}>Manufactured</Button>
                    <Button size="sm" variant="outline" onClick={() => move(part._id, "stored")}>Stored</Button>
                    <Button size="sm" variant="outline" onClick={() => move(part._id, "onRobot")}>On robot</Button>
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

export function TransmissionsRoute() {
  const upsert = useMutation(api.transmissions.upsert);

  return (
    <RequireSeason>
      {(overview, active) => {
        async function handleSubmit(event: FormEvent<HTMLFormElement>) {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const subsystem = overview.subsystems[0];

          if (!subsystem) {
            toast.error("Create a subsystem first.");
            return;
          }

          try {
            await upsert({
              seasonId: active.season!._id,
              subsystemId: subsystem._id,
              name: String(formData.get("name") ?? ""),
              ratio: String(formData.get("ratio") ?? ""),
              driverTeeth: Number(formData.get("driverTeeth") || 0) || null,
              drivenTeeth: Number(formData.get("drivenTeeth") || 0) || null,
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
              <Input name="calculatorUrl" type="url" placeholder="https://www.reca.lc/..." className="lg:col-span-2" />
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
                  <p className="mt-2 text-sm text-muted-foreground">{transmission.notes}</p>
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
              <p>Storage: {catalogLabel(catalog, part.storageLocationOptionId)}</p>
            </div>
            <Separator className="my-4" />
            <p className="text-sm text-muted-foreground">{part.notes || "No notes yet."}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {part.onshapeDocumentUrl && <Button size="sm" variant="outline" asChild><a href={part.onshapeDocumentUrl} target="_blank" rel="noreferrer">Onshape doc</a></Button>}
              {part.onshapePartStudioUrl && <Button size="sm" variant="outline" asChild><a href={part.onshapePartStudioUrl} target="_blank" rel="noreferrer">Part studio</a></Button>}
              {part.onshapeDrawingUrl && <Button size="sm" variant="outline" asChild><a href={part.onshapeDrawingUrl} target="_blank" rel="noreferrer">Drawing</a></Button>}
            </div>
          </div>
          <div className="rounded-md border bg-card p-4">
            <h2 className="mb-3 font-semibold">Lifecycle</h2>
            <div className="flex flex-wrap gap-2">
              {partStatuses.map((status) => (
                <Button key={status} size="sm" variant={part.status === status ? "default" : "outline"} onClick={() => move(status)}>
                  {partStatusLabel(status)}
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
                <Button key={candidate._id} size="sm" variant="outline" onClick={() => addChild(candidate._id)}>
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
            await seedDefaults({});
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





