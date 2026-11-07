import { useMutation, useQuery } from "convex/react";
import {
  Activity,
  ArrowLeft,
  BatteryCharging,
  Bot,
  Download,
  FlaskConical,
  Gauge,
  KeyRound,
  Pencil,
  Plus,
  ScanLine,
  Trash2,
  Zap,
} from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { BatterySummary } from "@convex/batteries";
import {
  BATTERY_THRESHOLDS,
  MATCH_LEVEL_LABELS,
  STATE_LABELS,
  formatPercent,
  formatResistance,
  parseOptionalNumber,
  type BatteryHealth,
  type BatteryMatchLevel,
  type BatteryPool,
  type BatteryState,
  type BatteryUseKind,
} from "@convex/lib/batteryDomain";
import { ListSkeleton } from "@/components/ui/skeleton";

type Program = "frc_5199" | "frc_9271";
type ActionKind = "into" | "out" | "check" | "analyzer" | "edit" | "adjust" | "add";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const STORAGE = {
  pin: "dolphin.batteries.pin",
  name: "dolphin.batteries.name",
  program: "dolphin.batteries.program",
};

function readStored(key: string) {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStored(key: string, value: string) {
  try {
    if (value) {
      window.localStorage.setItem(key, value);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Private browsing etc. — the value just won't be remembered.
  }
}

/** Turns a Convex error into the one sentence the server meant to say. */
function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const uncaught = message.match(/Uncaught Error:\s*([^\n]+)/);

  return (uncaught?.[1] ?? message).replace(/^\[.*?\]\s*/g, "").split("\n")[0].slice(0, 200);
}

function formatWhen(timestamp: number | undefined | null) {
  if (!timestamp) return "—";

  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDay(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const HEALTH_STYLES: Record<BatteryHealth, string> = {
  good: "text-emerald-700 dark:text-emerald-400",
  watch: "text-amber-700 dark:text-amber-400",
  bad: "text-red-700 dark:text-red-400",
  unknown: "text-muted-foreground",
};

const HEALTH_LABELS: Record<BatteryHealth, string> = {
  good: "Healthy",
  watch: "Watch IR",
  bad: "High IR",
  unknown: "No IR yet",
};

const STATE_STYLES: Record<BatteryState, string> = {
  in_robot: "bg-brand-blue text-white",
  ready: "bg-emerald-600 text-white",
  needs_charge: "bg-amber-500 text-amber-950",
  unknown: "bg-muted text-muted-foreground",
  retired: "bg-muted text-muted-foreground line-through",
};

function StatePill({ battery }: { battery: Pick<BatterySummary, "state" | "openUse"> }) {
  const label = battery.state === "in_robot" && battery.openUse ? `In robot · ${battery.openUse.label}` : STATE_LABELS[battery.state];

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", STATE_STYLES[battery.state])}>
      {label}
    </span>
  );
}

function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("truncate text-lg font-semibold tabular-nums", className)}>{value}</p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const selectClass =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

// ---------------------------------------------------------------------------
// Who's logging: signed-in account, or pit PIN + name
// ---------------------------------------------------------------------------

function useWriter() {
  const access = useQuery(api.batteries.writeAccess, {});
  const [pin, setPinState] = useState(() => readStored(STORAGE.pin));
  const [name, setNameState] = useState(() => readStored(STORAGE.name));

  const signedInAs = access?.signedInAs ?? null;
  const ready = Boolean(signedInAs || (pin && name));

  return {
    access,
    signedInAs,
    ready,
    name,
    credentials: signedInAs ? {} : { pin: pin || undefined, loggerName: name || undefined },
    save(nextPin: string, nextName: string) {
      setPinState(nextPin);
      setNameState(nextName);
      writeStored(STORAGE.pin, nextPin);
      writeStored(STORAGE.name, nextName);
    },
    forget() {
      setPinState("");
      writeStored(STORAGE.pin, "");
    },
  };
}

type Writer = ReturnType<typeof useWriter>;

function PinSheet({
  writer,
  open,
  onOpenChange,
  onReady,
}: {
  writer: Writer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReady: () => void;
}) {
  const checkPin = useMutation(api.batteries.checkPin);
  const [pin, setPin] = useState("");
  const [name, setName] = useState(writer.name);
  const [busy, setBusy] = useState(false);
  const pinConfigured = writer.access?.pinConfigured ?? true;

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      toast.error("Enter your name.");
      return;
    }

    setBusy(true);

    try {
      const result = await checkPin({ pin });

      if (!result.ok) {
        toast.error("That PIN isn't right.");
        return;
      }

      writer.save(pin.trim(), name.trim());
      onOpenChange(false);
      onReady();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[92vh] max-w-lg overflow-y-auto rounded-t-xl">
        <SheetHeader>
          <SheetTitle>Pit PIN</SheetTitle>
          <SheetDescription>
            Enter it once on this phone. Anyone in Slack can also log with <code>/battery</code>.
          </SheetDescription>
        </SheetHeader>
        {pinConfigured ? (
          <form onSubmit={submit} className="grid gap-4 px-4 pb-6">
            <Field label="Your name">
              <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="h-11 text-base" />
            </Field>
            <Field label="PIN">
              <Input
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                inputMode="numeric"
                type="password"
                autoComplete="off"
                className="h-11 text-base"
              />
            </Field>
            <Button type="submit" size="lg" disabled={busy}>
              Continue
            </Button>
          </form>
        ) : (
          <p className="px-4 pb-6 text-sm text-muted-foreground">
            Web logging is off until a mentor sets the pit PIN (<code>BATTERY_PIN</code> in Convex). Until then, use{" "}
            <code>/battery</code> in Slack or sign in to Dolphin Apps.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Action forms (bottom sheet)
// ---------------------------------------------------------------------------

type DetailBattery = BatterySummary & { manufacturer?: string; purchasedOn?: string; notes?: string };

function ActionSheet({
  kind,
  onClose,
  writer,
  program,
  batteries,
  battery,
}: {
  kind: ActionKind | null;
  onClose: () => void;
  writer: Writer;
  program: Program;
  batteries: BatterySummary[];
  battery?: DetailBattery;
}) {
  const titles: Record<ActionKind, string> = {
    into: "Battery into robot",
    out: "Battery out of robot",
    check: "Beak check",
    analyzer: "Analyzer run",
    edit: "Edit battery",
    adjust: "Adjust cycle count",
    add: "Add a battery",
  };
  const descriptions: Record<ActionKind, string> = {
    into: "Put the Beak on the battery and enter what it reads.",
    out: "Counts as one full cycle. A Beak reading is optional.",
    check: "A reading off the charger. Doesn't count as a cycle.",
    analyzer: "Counts as one full cycle unless you uncheck it.",
    edit: "Rename, change the pool, or retire it.",
    adjust: "Every change is kept in the battery's history.",
    add: "New batteries start at the cycle count you enter.",
  };

  return (
    <Sheet open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[92vh] max-w-lg overflow-y-auto rounded-t-xl">
        {kind && (
          <>
            <SheetHeader>
              <SheetTitle>{titles[kind]}</SheetTitle>
              <SheetDescription>{descriptions[kind]}</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-6">
              {kind === "into" && <IntoForm {...{ writer, program, batteries, battery, onDone: onClose }} />}
              {kind === "out" && <OutForm {...{ writer, batteries, battery, onDone: onClose }} />}
              {kind === "check" && <CheckForm {...{ writer, batteries, battery, onDone: onClose }} />}
              {kind === "analyzer" && <AnalyzerForm {...{ writer, batteries, battery, onDone: onClose }} />}
              {kind === "edit" && battery && <EditForm {...{ writer, battery, onDone: onClose }} />}
              {kind === "adjust" && battery && <AdjustForm {...{ writer, battery, onDone: onClose }} />}
              {kind === "add" && <AddForm {...{ writer, program, onDone: onClose }} />}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function BatteryPicker({
  batteries,
  value,
  onChange,
}: {
  batteries: BatterySummary[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label="Battery">
      <select className={selectClass} value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="" disabled>
          Pick a battery
        </option>
        {batteries.map((battery) => (
          <option key={battery._id} value={battery._id}>
            {battery.displayName} · {battery.cycleCount} cycles · {formatResistance(battery.lastResistanceOhms)}
          </option>
        ))}
      </select>
    </Field>
  );
}

function BeakFields({
  charge,
  setCharge,
  ir,
  setIr,
  optional,
}: {
  charge: string;
  setCharge: (value: string) => void;
  ir: string;
  setIr: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-lg border border-dashed border-brand-aqua/50 bg-accent/40 p-3">
      <div className="col-span-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <ScanLine className="size-4 text-brand-aqua" /> Battery Beak reading{optional ? " (optional)" : ""}
        </p>
        <p className="text-xs text-muted-foreground">Type IR the way the Beak shows it, e.g. 0.012.</p>
      </div>
      <Field label="Charge %">
        <Input
          value={charge}
          onChange={(event) => setCharge(event.target.value)}
          inputMode="decimal"
          placeholder="99"
          className="h-11 text-base"
          required={!optional}
        />
      </Field>
      <Field label="IR (Ω)">
        <Input
          value={ir}
          onChange={(event) => setIr(event.target.value)}
          inputMode="decimal"
          placeholder="0.012"
          className="h-11 text-base"
          required={!optional}
        />
      </Field>
    </div>
  );
}

function useSubmit(onDone: () => void) {
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<string | void>) {
    setBusy(true);

    try {
      const message = await work();
      if (message) toast.success(message);
      onDone();
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  return { busy, run };
}

function IntoForm({
  writer,
  program,
  batteries,
  battery,
  onDone,
}: {
  writer: Writer;
  program: Program;
  batteries: BatterySummary[];
  battery?: DetailBattery;
  onDone: () => void;
}) {
  const startUse = useMutation(api.batteries.startUseWeb);
  const lastEvent = useQuery(api.batteries.lastEventCode, { program });
  const available = batteries.filter((item) => !item.retired && item.state !== "in_robot");
  const [batteryId, setBatteryId] = useState<string>(battery?._id ?? (available.length === 1 ? available[0]._id : ""));
  const [kind, setKind] = useState<BatteryUseKind>("practice");
  const [matchLevel, setMatchLevel] = useState<BatteryMatchLevel>("qualification");
  const [matchNumber, setMatchNumber] = useState("");
  const [eventCode, setEventCode] = useState<string | null>(null);
  const [charge, setCharge] = useState("");
  const [ir, setIr] = useState("");
  const [notes, setNotes] = useState("");
  const { busy, run } = useSubmit(onDone);
  const eventValue = eventCode ?? lastEvent ?? "";

  if (available.length === 0) {
    return <p className="text-sm text-muted-foreground">Every battery is already in the robot. Log one out first.</p>;
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          const result = await startUse({
            ...writer.credentials,
            batteryId: batteryId as Id<"batteries">,
            kind,
            matchLevel: kind === "match" ? matchLevel : undefined,
            matchNumber: kind === "match" ? parseOptionalNumber(matchNumber) : undefined,
            eventCode: eventValue || undefined,
            notes: notes || undefined,
            chargePercent: parseOptionalNumber(charge),
            resistanceOhms: parseOptionalNumber(ir),
          });

          return `${result.batteryName} is in the robot for ${result.label}.`;
        });
      }}
    >
      <BatteryPicker batteries={available} value={batteryId} onChange={setBatteryId} />
      <Field label="What's it for?">
        <div className="grid grid-cols-2 gap-2">
          {(["practice", "match"] as const).map((option) => (
            <Button
              key={option}
              type="button"
              variant={kind === option ? "default" : "outline"}
              size="lg"
              onClick={() => setKind(option)}
            >
              {option === "practice" ? "Practice" : "Match"}
            </Button>
          ))}
        </div>
      </Field>
      {kind === "match" && (
        <>
          <Field label="Match type">
            <div className="grid grid-cols-3 gap-2">
              {(["practice", "qualification", "playoff"] as const).map((level) => (
                <Button
                  key={level}
                  type="button"
                  variant={matchLevel === level ? "default" : "outline"}
                  onClick={() => setMatchLevel(level)}
                >
                  {level === "practice" ? "Practice" : MATCH_LEVEL_LABELS[level]}
                </Button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Match #">
              <Input
                value={matchNumber}
                onChange={(event) => setMatchNumber(event.target.value)}
                inputMode="numeric"
                className="h-11 text-base"
                required
              />
            </Field>
            <Field label="Event code">
              <Input
                value={eventValue}
                onChange={(event) => setEventCode(event.target.value)}
                placeholder="2026casj"
                className="h-11 text-base"
              />
            </Field>
          </div>
        </>
      )}
      <BeakFields charge={charge} setCharge={setCharge} ir={ir} setIr={setIr} />
      <Field label="Notes">
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
      </Field>
      <Button type="submit" size="lg" disabled={busy || !batteryId}>
        <Bot /> Log into robot
      </Button>
    </form>
  );
}

function OutForm({
  writer,
  batteries,
  battery,
  onDone,
}: {
  writer: Writer;
  batteries: BatterySummary[];
  battery?: DetailBattery;
  onDone: () => void;
}) {
  const endUse = useMutation(api.batteries.endUseWeb);
  const inRobot = batteries.filter((item) => item.state === "in_robot");
  const [batteryId, setBatteryId] = useState<string>(battery?._id ?? (inRobot.length === 1 ? inRobot[0]._id : ""));
  const [charge, setCharge] = useState("");
  const [ir, setIr] = useState("");
  const { busy, run } = useSubmit(onDone);

  if (inRobot.length === 0) {
    return <p className="text-sm text-muted-foreground">No batteries are logged into the robot right now.</p>;
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          const result = await endUse({
            ...writer.credentials,
            batteryId: batteryId as Id<"batteries">,
            chargePercent: parseOptionalNumber(charge),
            resistanceOhms: parseOptionalNumber(ir),
          });

          return `${result.batteryName} is out after ${result.label}. Now ${result.cycleCount} cycles.`;
        });
      }}
    >
      <BatteryPicker batteries={inRobot} value={batteryId} onChange={setBatteryId} />
      <BeakFields charge={charge} setCharge={setCharge} ir={ir} setIr={setIr} optional />
      <Button type="submit" size="lg" disabled={busy || !batteryId}>
        <BatteryCharging /> Log out of robot
      </Button>
    </form>
  );
}

function CheckForm({
  writer,
  batteries,
  battery,
  onDone,
}: {
  writer: Writer;
  batteries: BatterySummary[];
  battery?: DetailBattery;
  onDone: () => void;
}) {
  const logCheck = useMutation(api.batteries.logCheckWeb);
  const active = batteries.filter((item) => !item.retired);
  const [batteryId, setBatteryId] = useState<string>(battery?._id ?? "");
  const [charge, setCharge] = useState("");
  const [ir, setIr] = useState("");
  const { busy, run } = useSubmit(onDone);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          const result = await logCheck({
            ...writer.credentials,
            batteryId: batteryId as Id<"batteries">,
            chargePercent: parseOptionalNumber(charge),
            resistanceOhms: parseOptionalNumber(ir),
          });

          return `Saved the reading for ${result.batteryName}.`;
        });
      }}
    >
      <BatteryPicker batteries={active} value={batteryId} onChange={setBatteryId} />
      <BeakFields charge={charge} setCharge={setCharge} ir={ir} setIr={setIr} />
      <Button type="submit" size="lg" disabled={busy || !batteryId}>
        <Gauge /> Save reading
      </Button>
    </form>
  );
}

function AnalyzerForm({
  writer,
  batteries,
  battery,
  onDone,
}: {
  writer: Writer;
  batteries: BatterySummary[];
  battery?: DetailBattery;
  onDone: () => void;
}) {
  const logRun = useMutation(api.batteries.logAnalyzerRunWeb);
  const uploadUrl = useMutation(api.batteries.generateAnalyzerUploadUrl);
  const active = batteries.filter((item) => !item.retired);
  const [batteryId, setBatteryId] = useState<string>(battery?._id ?? "");
  const [capacity, setCapacity] = useState("");
  const [ir, setIr] = useState("");
  const [amps, setAmps] = useState("");
  const [notes, setNotes] = useState("");
  const [countsAsCycle, setCountsAsCycle] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const { busy, run } = useSubmit(onDone);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          let fileStorageId: Id<"_storage"> | undefined;

          if (file) {
            const url = await uploadUrl(writer.credentials);
            const response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": file.type || "application/octet-stream" },
              body: file,
            });

            if (!response.ok) throw new Error("The file didn't upload. Try again.");
            fileStorageId = ((await response.json()) as { storageId: Id<"_storage"> }).storageId;
          }

          const result = await logRun({
            ...writer.credentials,
            batteryId: batteryId as Id<"batteries">,
            capacityAh: parseOptionalNumber(capacity),
            resistanceOhms: parseOptionalNumber(ir),
            dischargeAmps: parseOptionalNumber(amps),
            notes: notes || undefined,
            countsAsCycle,
            fileStorageId,
            fileName: file?.name,
          });

          return `Saved the analyzer run for ${result.batteryName}.`;
        });
      }}
    >
      <BatteryPicker batteries={active} value={batteryId} onChange={setBatteryId} />
      <div className="grid grid-cols-3 gap-3">
        <Field label="Capacity (Ah)">
          <Input value={capacity} onChange={(e) => setCapacity(e.target.value)} inputMode="decimal" placeholder="17.4" className="h-11 text-base" />
        </Field>
        <Field label="IR (Ω)">
          <Input value={ir} onChange={(e) => setIr(e.target.value)} inputMode="decimal" placeholder="0.012" className="h-11 text-base" />
        </Field>
        <Field label="Load (A)">
          <Input value={amps} onChange={(e) => setAmps(e.target.value)} inputMode="decimal" placeholder="10" className="h-11 text-base" />
        </Field>
      </div>
      <Field label="Analyzer graph or export" hint="Photo of the screen, a screenshot, or the exported file.">
        <Input type="file" accept="image/*,.csv,.txt,.pdf,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </Field>
      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" checked={countsAsCycle} onChange={(e) => setCountsAsCycle(e.target.checked)} />
        Count this run as a full cycle
      </label>
      <Button type="submit" size="lg" disabled={busy || !batteryId}>
        <FlaskConical /> Save analyzer run
      </Button>
    </form>
  );
}

function BatteryFields({
  value,
  onChange,
}: {
  value: { name: string; nickname: string; pool: BatteryPool; manufacturer: string; purchasedOn: string; notes: string };
  onChange: (next: Partial<typeof value>) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" hint='Printed label, e.g. "Comp 3"'>
          <Input value={value.name} onChange={(e) => onChange({ name: e.target.value })} className="h-11 text-base" required />
        </Field>
        <Field label="Nickname">
          <Input value={value.nickname} onChange={(e) => onChange({ nickname: e.target.value })} className="h-11 text-base" />
        </Field>
      </div>
      <Field label="Pool">
        <div className="grid grid-cols-2 gap-2">
          {(["competition", "practice"] as const).map((pool) => (
            <Button key={pool} type="button" variant={value.pool === pool ? "default" : "outline"} onClick={() => onChange({ pool })}>
              {pool === "competition" ? "Competition" : "Practice"}
            </Button>
          ))}
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Brand / model">
          <Input value={value.manufacturer} onChange={(e) => onChange({ manufacturer: e.target.value })} className="h-11 text-base" />
        </Field>
        <Field label="Purchased">
          <Input type="date" value={value.purchasedOn} onChange={(e) => onChange({ purchasedOn: e.target.value })} className="h-11 text-base" />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={value.notes} onChange={(e) => onChange({ notes: e.target.value })} rows={2} />
      </Field>
    </>
  );
}

function EditForm({ writer, battery, onDone }: { writer: Writer; battery: DetailBattery; onDone: () => void }) {
  const update = useMutation(api.batteries.updateBattery);
  const [fields, setFields] = useState({
    name: battery.name,
    nickname: battery.nickname ?? "",
    pool: battery.pool,
    manufacturer: battery.manufacturer ?? "",
    purchasedOn: battery.purchasedOn ?? "",
    notes: battery.notes ?? "",
  });
  const [retired, setRetired] = useState(battery.retired);
  const { busy, run } = useSubmit(onDone);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          await update({ ...writer.credentials, batteryId: battery._id, ...fields, retired });
          return "Battery updated.";
        });
      }}
    >
      <BatteryFields value={fields} onChange={(next) => setFields((current) => ({ ...current, ...next }))} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" checked={retired} onChange={(e) => setRetired(e.target.checked)} />
        Retired (hidden from logging, history kept)
      </label>
      <Button type="submit" size="lg" disabled={busy}>
        Save changes
      </Button>
    </form>
  );
}

function AdjustForm({ writer, battery, onDone }: { writer: Writer; battery: DetailBattery; onDone: () => void }) {
  const adjust = useMutation(api.batteries.adjustCycles);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const { busy, run } = useSubmit(onDone);
  const parsed = parseOptionalNumber(delta);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          await adjust({ ...writer.credentials, batteryId: battery._id, cycleDelta: Math.round(parsed ?? 0), reason });
          return "Cycle count updated.";
        });
      }}
    >
      <p className="text-sm">
        Currently <strong>{battery.cycleCount}</strong> cycles
        {parsed ? (
          <>
            {" "}
            → <strong>{Math.max(0, battery.cycleCount + Math.round(parsed))}</strong>
          </>
        ) : null}
        .
      </p>
      <Field label="Cycles to add" hint="Use a negative number to remove, e.g. -2.">
        <Input value={delta} onChange={(e) => setDelta(e.target.value)} inputMode="numeric" className="h-11 text-base" required />
      </Field>
      <Field label="Reason">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Two analyzer cycles before we had the app" className="h-11 text-base" required />
      </Field>
      <Button type="submit" size="lg" disabled={busy}>
        Save adjustment
      </Button>
    </form>
  );
}

function AddForm({ writer, program, onDone }: { writer: Writer; program: Program; onDone: () => void }) {
  const create = useMutation(api.batteries.createBattery);
  const [fields, setFields] = useState({
    name: "",
    nickname: "",
    pool: "competition" as BatteryPool,
    manufacturer: "",
    purchasedOn: "",
    notes: "",
  });
  const [startingCycles, setStartingCycles] = useState("");
  const { busy, run } = useSubmit(onDone);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          await create({ ...writer.credentials, program, ...fields, startingCycles: parseOptionalNumber(startingCycles) });
          return `Added ${fields.name}.`;
        });
      }}
    >
      <BatteryFields value={fields} onChange={(next) => setFields((current) => ({ ...current, ...next }))} />
      <Field label="Starting cycle count" hint="Your best estimate for a battery that's already been used.">
        <Input value={startingCycles} onChange={(e) => setStartingCycles(e.target.value)} inputMode="numeric" placeholder="0" className="h-11 text-base" />
      </Field>
      <Button type="submit" size="lg" disabled={busy}>
        <Plus /> Add battery
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Shared action controller (PIN gate → form)
// ---------------------------------------------------------------------------

function useActions() {
  const writer = useWriter();
  const [pending, setPending] = useState<ActionKind | null>(null);
  const [active, setActive] = useState<ActionKind | null>(null);
  const [pinOpen, setPinOpen] = useState(false);

  return {
    writer,
    active,
    close: () => setActive(null),
    unlock() {
      setPending(null);
      setPinOpen(true);
    },
    open(kind: ActionKind) {
      if (writer.ready) {
        setActive(kind);
      } else {
        setPending(kind);
        setPinOpen(true);
      }
    },
    pinSheet: (
      <PinSheet
        writer={writer}
        open={pinOpen}
        onOpenChange={setPinOpen}
        onReady={() => {
          setActive(pending);
          setPending(null);
        }}
      />
    ),
  };
}

function LoggerLine({ writer }: { writer: Writer }) {
  if (writer.signedInAs) {
    return <p className="text-xs text-muted-foreground">Logging as {writer.signedInAs}</p>;
  }

  if (writer.ready) {
    return (
      <p className="text-xs text-muted-foreground">
        Logging as {writer.name} ·{" "}
        <button type="button" className="underline" onClick={writer.forget}>
          lock this phone
        </button>
      </p>
    );
  }

  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground">
      <KeyRound className="size-3" /> Viewing. You'll need the pit PIN to log.
    </p>
  );
}

// ---------------------------------------------------------------------------
// Fleet list: /batteries
// ---------------------------------------------------------------------------

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) {
    toast.message("No uses logged yet.");
    return;
  }

  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function BatteryCard({ battery }: { battery: BatterySummary }) {
  return (
    <Link
      to={`/batteries/${battery._id}`}
      className={cn(
        "grid gap-3 rounded-lg border bg-card p-4 shadow-xs transition hover:border-brand-aqua/50 hover:shadow-sm",
        battery.health === "bad" && "border-red-300 dark:border-red-900",
        battery.health === "watch" && "border-amber-300 dark:border-amber-900",
        battery.retired && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-lg font-semibold leading-tight">{battery.name}</p>
          <p className="truncate text-sm text-muted-foreground">{battery.nickname ? `"${battery.nickname}"` : "No nickname"}</p>
        </div>
        <StatePill battery={battery} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Cycles" value={battery.cycleCount} />
        <Stat label="Charge" value={formatPercent(battery.lastChargePercent)} />
        <Stat label="IR" value={formatResistance(battery.lastResistanceOhms)} className={HEALTH_STYLES[battery.health]} />
      </div>
    </Link>
  );
}

export function BatteriesPage() {
  const [program, setProgramState] = useState<Program>(() => (readStored(STORAGE.program) === "frc_9271" ? "frc_9271" : "frc_5199"));
  const batteries = useQuery(api.batteries.list, { program });
  const exportRows = useQuery(api.batteries.exportUses, { program });
  const actions = useActions();
  const list = batteries ?? [];
  const active = list.filter((battery) => !battery.retired);
  const counts = {
    inRobot: active.filter((battery) => battery.state === "in_robot").length,
    ready: active.filter((battery) => battery.state === "ready").length,
    charge: active.filter((battery) => battery.state === "needs_charge").length,
    flagged: active.filter((battery) => battery.health === "watch" || battery.health === "bad").length,
  };
  const groups: { label: string; items: BatterySummary[] }[] = [
    { label: "Competition", items: active.filter((battery) => battery.pool === "competition") },
    { label: "Practice", items: active.filter((battery) => battery.pool === "practice") },
    { label: "Retired", items: list.filter((battery) => battery.retired) },
  ];

  function setProgram(next: Program) {
    setProgramState(next);
    writeStored(STORAGE.program, next);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] leading-tight font-bold sm:text-[2rem]">Which batteries are ready</h1>
          <LoggerLine writer={actions.writer} />
        </div>
        <div className="inline-flex rounded-lg border bg-card p-1">
          {(["frc_5199", "frc_9271"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setProgram(option)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                program === option ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {option === "frc_5199" ? "5199" : "9271"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button size="lg" variant="cta" className="h-12" onClick={() => actions.open("into")}>
          <Bot /> Into robot
        </Button>
        <Button size="lg" variant="outline" className="h-12" onClick={() => actions.open("out")}>
          <BatteryCharging /> Out of robot
        </Button>
        <Button size="lg" variant="outline" className="h-12" onClick={() => actions.open("check")}>
          <Gauge /> Beak check
        </Button>
        <Button size="lg" variant="outline" className="h-12" onClick={() => actions.open("analyzer")}>
          <FlaskConical /> Analyzer run
        </Button>
      </div>

      {batteries !== undefined && active.length > 0 && (
        <div className="grid grid-cols-4 gap-2 rounded-lg border bg-card p-3 text-center">
          <Stat label="In robot" value={counts.inRobot} />
          <Stat label="Charged" value={counts.ready} className="text-emerald-700 dark:text-emerald-400" />
          <Stat label="Need charge" value={counts.charge} className="text-amber-700 dark:text-amber-400" />
          <Stat label="Flagged" value={counts.flagged} className={counts.flagged ? "text-red-700 dark:text-red-400" : undefined} />
        </div>
      )}

      {batteries === undefined && <ListSkeleton label="Loading batteries" />}

      {batteries !== undefined && list.length === 0 && (
        <div className="rounded-lg border border-dashed bg-card p-6 text-center">
          <p className="font-medium">No batteries yet for {program === "frc_5199" ? "5199" : "9271"}.</p>
          <p className="mt-1 text-sm text-muted-foreground">Add them one at a time, or have a mentor run the seed command.</p>
        </div>
      )}

      {groups.map(
        (group) =>
          group.items.length > 0 && (
            <section key={group.label} className="grid gap-2">
              <h2 className="text-base font-semibold">{group.label}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((battery) => (
                  <BatteryCard key={battery._id} battery={battery} />
                ))}
              </div>
            </section>
          ),
      )}

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button variant="outline" onClick={() => actions.open("add")}>
          <Plus /> Add battery
        </Button>
        <Button
          variant="outline"
          disabled={!exportRows}
          onClick={() =>
            downloadCsv(
              (exportRows ?? []).map((row) => ({
                ...row,
                startedAt: new Date(row.startedAt).toISOString(),
                endedAt: row.endedAt ? new Date(row.endedAt).toISOString() : "",
              })),
              `battery-uses-${program === "frc_5199" ? "5199" : "9271"}.csv`,
            )
          }
        >
          <Download /> Download use log (CSV)
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          IR above {formatResistance(BATTERY_THRESHOLDS.watchResistanceOhms)} is flagged to watch; above{" "}
          {formatResistance(BATTERY_THRESHOLDS.badResistanceOhms)} suggests practice-only.
        </p>
      </div>

      <ActionSheet kind={actions.active} onClose={actions.close} writer={actions.writer} program={program} batteries={list} />
      {actions.pinSheet}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Battery detail: /batteries/:batteryId
// ---------------------------------------------------------------------------

function ResistanceChart({ readings }: { readings: { takenAt: number; resistanceOhms?: number }[] }) {
  const points = readings.filter((reading) => reading.resistanceOhms !== undefined) as { takenAt: number; resistanceOhms: number }[];

  if (points.length < 2) {
    return <p className="text-sm text-muted-foreground">The IR trend shows up after a couple of readings.</p>;
  }

  const width = 320;
  const height = 120;
  const pad = 6;
  const values = points.map((point) => point.resistanceOhms * 1000);
  const max = Math.max(...values, BATTERY_THRESHOLDS.badResistanceOhms * 1000 + 2);
  const min = Math.max(0, Math.min(...values) - 2);
  const x = (index: number) => pad + (index / (points.length - 1)) * (width - pad * 2);
  const y = (milliohms: number) => height - pad - ((milliohms - min) / (max - min || 1)) * (height - pad * 2);
  const path = values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const watchY = y(BATTERY_THRESHOLDS.watchResistanceOhms * 1000);
  const badY = y(BATTERY_THRESHOLDS.badResistanceOhms * 1000);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full" role="img" aria-label="Internal resistance over time">
        <line x1={pad} x2={width - pad} y1={badY} y2={badY} className="stroke-red-400" strokeDasharray="4 4" />
        <line x1={pad} x2={width - pad} y1={watchY} y2={watchY} className="stroke-amber-400" strokeDasharray="4 4" />
        <path d={path} fill="none" className="stroke-brand-blue" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {values.map((value, index) => (
          <circle key={index} cx={x(index)} cy={y(value)} r={2.5} className="fill-brand-blue" />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatDay(points[0].takenAt)}</span>
        <span>
          <span className="text-amber-600">— watch</span> · <span className="text-red-600">— high</span>
        </span>
        <span>{formatDay(points[points.length - 1].takenAt)}</span>
      </div>
    </div>
  );
}

function Section({ title, icon, children, action }: { title: string; icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function BatteryDetailPage() {
  const { batteryId } = useParams();
  const data = useQuery(api.batteries.detail, batteryId ? { batteryId: batteryId as Id<"batteries"> } : "skip");
  const program: Program = data?.battery.program ?? "frc_5199";
  const fleet = useQuery(api.batteries.list, data ? { program } : "skip");
  const actions = useActions();
  const deleteUse = useMutation(api.batteries.deleteUse);
  const deleteRun = useMutation(api.batteries.deleteAnalyzerRun);
  const [historyTab, setHistoryTab] = useState<"uses" | "analyzer" | "changes">("uses");

  const fleetForForms = useMemo(() => {
    if (!data) return [];
    return fleet ?? [data.battery];
  }, [data, fleet]);

  if (data === undefined) {
    return <ListSkeleton label="Loading" />;
  }

  if (data === null) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <p className="font-medium">That battery doesn't exist.</p>
        <Link to="/batteries" className="text-sm text-primary underline">
          Back to batteries
        </Link>
      </div>
    );
  }

  const { battery, latestAnalyzerRun: run } = data;
  const isImage = run?.fileName ? /\.(png|jpe?g|gif|webp|heic)$/i.test(run.fileName) : false;

  async function remove(work: () => Promise<unknown>, label: string) {
    if (!actions.writer.ready) {
      actions.unlock();
      return;
    }

    if (!window.confirm(`Delete this ${label}? Its cycle comes off the count.`)) return;

    try {
      await work();
      toast.success(`Deleted the ${label}.`);
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <Link to="/batteries" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All batteries
      </Link>

      <div className="grid gap-3 rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">
              {battery.program === "frc_5199" ? "5199" : "9271"} · {battery.pool === "competition" ? "Competition" : "Practice"}
            </p>
            <h1 className="text-[1.75rem] leading-tight font-bold">{battery.name}</h1>
            {battery.nickname && <p className="text-muted-foreground">"{battery.nickname}"</p>}
          </div>
          <StatePill battery={battery} />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Cycles" value={battery.cycleCount} />
          <Stat label="Matches" value={battery.matchCount} />
          <Stat label="Practice" value={battery.practiceCount} />
          <Stat label="Analyzer" value={battery.analyzerCount} />
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/60 p-3">
          <Stat label="Last charge" value={formatPercent(battery.lastChargePercent)} />
          <Stat
            label={`Last IR · ${HEALTH_LABELS[battery.health]}`}
            value={formatResistance(battery.lastResistanceOhms)}
            className={HEALTH_STYLES[battery.health]}
          />
          <p className="col-span-2 text-xs text-muted-foreground">Last reading {formatWhen(battery.lastReadingAt)}</p>
        </div>
        {!battery.retired && (
          <div className="grid grid-cols-2 gap-2">
            {battery.state === "in_robot" ? (
              <Button size="lg" className="h-12" onClick={() => actions.open("out")}>
                <BatteryCharging /> Out of robot
              </Button>
            ) : (
              <Button size="lg" variant="cta" className="h-12" onClick={() => actions.open("into")}>
                <Bot /> Into robot
              </Button>
            )}
            <Button size="lg" variant="outline" className="h-12" onClick={() => actions.open("check")}>
              <Gauge /> Beak check
            </Button>
          </div>
        )}
        <LoggerLine writer={actions.writer} />
      </div>

      <Section
        title="Last analyzer run"
        icon={<FlaskConical className="size-4 text-brand-aqua" />}
        action={
          <Button size="sm" variant="outline" onClick={() => actions.open("analyzer")}>
            <Plus /> Log run
          </Button>
        }
      >
        {run ? (
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-2">
              <Stat
                label="Capacity"
                value={run.capacityAh !== undefined ? `${run.capacityAh} Ah` : "—"}
                className={
                  run.capacityAh !== undefined && run.capacityAh < BATTERY_THRESHOLDS.watchCapacityAh
                    ? "text-amber-700 dark:text-amber-400"
                    : undefined
                }
              />
              <Stat label="IR" value={formatResistance(run.resistanceOhms)} />
              <Stat label="Load" value={run.dischargeAmps !== undefined ? `${run.dischargeAmps} A` : "—"} />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatWhen(run.ranAt)} · logged by {run.loggedBy}
              {run.countsAsCycle ? " · counted as a cycle" : ""}
            </p>
            {run.notes && <p className="text-sm">{run.notes}</p>}
            {run.fileUrl &&
              (isImage ? (
                <a href={run.fileUrl} target="_blank" rel="noreferrer">
                  <img src={run.fileUrl} alt="Analyzer result" className="max-h-72 w-full rounded-md border object-contain" />
                </a>
              ) : (
                <a href={run.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                  Open {run.fileName ?? "analyzer file"}
                </a>
              ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No analyzer runs yet.</p>
        )}
      </Section>

      <Section title="Internal resistance" icon={<Activity className="size-4 text-brand-blue" />}>
        <ResistanceChart readings={data.readings} />
      </Section>

      <Section title="History" icon={<Zap className="size-4 text-brand-orange" />}>
        <div className="inline-flex w-fit rounded-md border p-1 text-sm">
          {(
            [
              ["uses", `Uses (${data.uses.length})`],
              ["analyzer", `Analyzer (${data.analyzerRuns.length})`],
              ["changes", `Adjustments (${data.adjustments.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setHistoryTab(key)}
              className={cn("rounded px-2.5 py-1 font-medium", historyTab === key ? "bg-secondary" : "text-muted-foreground")}
            >
              {label}
            </button>
          ))}
        </div>

        {historyTab === "uses" && (
          <ul className="divide-y">
            {data.uses.length === 0 && <li className="py-2 text-sm text-muted-foreground">No uses logged yet.</li>}
            {data.uses.map((use) => (
              <li key={use._id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">
                    {use.label}
                    {use.eventCode && <span className="font-normal text-muted-foreground"> · {use.eventCode}</span>}
                    {!use.endedAt && <span className="ml-2 text-xs font-semibold text-brand-blue">in robot</span>}
                  </p>
                  <p className="text-muted-foreground">
                    {formatWhen(use.startedAt)}
                    {use.endedAt ? ` → ${new Date(use.endedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : ""}
                  </p>
                  <p className="tabular-nums text-muted-foreground">
                    {formatPercent(use.startChargePercent)} / {formatResistance(use.startResistanceOhms)}
                    {use.endedAt && ` → ${formatPercent(use.endChargePercent)} / ${formatResistance(use.endResistanceOhms)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {use.loggedBy}
                    {use.notes ? ` · ${use.notes}` : ""}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Delete this use"
                  onClick={() => remove(() => deleteUse({ ...actions.writer.credentials, useId: use._id }), "use")}
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {historyTab === "analyzer" && (
          <ul className="divide-y">
            {data.analyzerRuns.length === 0 && <li className="py-2 text-sm text-muted-foreground">No analyzer runs yet.</li>}
            {data.analyzerRuns.map((item) => (
              <li key={item._id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-semibold">
                    {item.capacityAh !== undefined ? `${item.capacityAh} Ah` : "No capacity"} · {formatResistance(item.resistanceOhms)}
                  </p>
                  <p className="text-muted-foreground">
                    {formatWhen(item.ranAt)} · {item.loggedBy}
                    {item.fileUrl && (
                      <>
                        {" · "}
                        <a className="underline" href={item.fileUrl} target="_blank" rel="noreferrer">
                          file
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Delete this analyzer run"
                  onClick={() => remove(() => deleteRun({ ...actions.writer.credentials, runId: item._id }), "analyzer run")}
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {historyTab === "changes" && (
          <ul className="divide-y">
            {data.adjustments.length === 0 && <li className="py-2 text-sm text-muted-foreground">No manual changes.</li>}
            {data.adjustments.map((item) => (
              <li key={item._id} className="py-2.5 text-sm">
                <p className="font-semibold">
                  {item.cycleDelta > 0 ? "+" : ""}
                  {item.cycleDelta} cycles
                </p>
                <p className="text-muted-foreground">
                  {item.reason} · {item.loggedBy} · {formatWhen(item.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => actions.open("edit")}>
          <Pencil /> Edit battery
        </Button>
        <Button variant="outline" onClick={() => actions.open("adjust")}>
          Adjust cycles
        </Button>
      </div>

      <ActionSheet
        kind={actions.active}
        onClose={actions.close}
        writer={actions.writer}
        program={program}
        batteries={fleetForForms}
        battery={battery}
      />
      {actions.pinSheet}
    </div>
  );
}
