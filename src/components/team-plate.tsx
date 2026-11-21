import { cn } from "@/lib/utils";

/**
 * The team number set like the numerals on a robot's bumpers: heavy, condensed,
 * white on navy. It is the one bold brand element in the app, so use it only
 * where it tells you which team you're looking at.
 */
export function TeamPlate({
  number,
  size = "md",
  muted = false,
  className,
}: {
  number: string;
  size?: "sm" | "md" | "lg";
  /** An unselected team in a switcher. */
  muted?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-heading font-extrabold leading-none tabular-nums [font-stretch:87.5%] select-none",
        muted
          ? "bg-transparent text-muted-foreground shadow-[inset_0_0_0_1.5px_var(--border)]"
          : "bg-plate text-plate-foreground shadow-[inset_0_-3px_0_rgb(0_0_0/0.28),inset_0_1px_0_rgb(255_255_255/0.08)]",
        size === "sm" && "h-6 rounded-[5px] px-1.5 text-[13px] tracking-[0.01em]",
        size === "md" && "h-9 rounded-[7px] px-2.5 text-xl tracking-[0.01em]",
        size === "lg" && "h-16 rounded-[11px] px-4 pb-0.5 text-[2.75rem] tracking-[-0.01em] sm:h-[4.5rem] sm:text-[3.25rem]",
        className,
      )}
    >
      {number}
    </span>
  );
}

/**
 * Pick which team's data you're looking at. Each option is a team plate; the
 * selected one is filled, the others are outlined.
 */
export function TeamSwitcher<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  label = "Team",
  className,
}: {
  options: { value: T; teamNumber: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex items-center gap-1.5", className)}>
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isSelected}
            aria-label={`Show team ${option.teamNumber}`}
            className={cn(
              "outline-none transition-transform focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.97]",
              size === "lg" ? "rounded-[11px]" : size === "md" ? "rounded-[7px]" : "rounded-[5px]",
            )}
          >
            <TeamPlate
              number={option.teamNumber}
              size={size}
              muted={!isSelected}
              className={cn(!isSelected && "hover:text-foreground")}
            />
          </button>
        );
      })}
    </div>
  );
}
