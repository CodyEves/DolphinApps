import { cn } from "@/lib/utils";

/**
 * The team number, set heavy like the numerals on the team logo. Use it only
 * where it tells you which team you're looking at.
 *
 * tone="onBrand" is for the blue app bar and the blue home band: white plate,
 * blue numerals when selected; a faint outline when not.
 */
export function TeamPlate({
  number,
  size = "md",
  muted = false,
  tone = "default",
  className,
}: {
  number: string;
  size?: "sm" | "md" | "lg";
  /** An unselected team in a switcher. */
  muted?: boolean;
  tone?: "default" | "onBrand";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-heading font-bold leading-none tabular-nums select-none",
        tone === "default" &&
          (muted
            ? "bg-card text-muted-foreground shadow-[inset_0_0_0_1.5px_var(--border)]"
            : "bg-plate text-plate-foreground shadow-[inset_0_-2px_0_rgb(0_0_0/0.22)]"),
        tone === "onBrand" &&
          (muted
            ? "bg-white/8 text-white/70 shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.28)]"
            : "bg-white text-[#16478e] shadow-[inset_0_-3px_0_rgb(22_71_142/0.18)]"),
        size === "sm" && "h-6 rounded-[6px] px-1.5 text-[12px] tracking-[0.02em]",
        size === "md" && "h-9 rounded-[9px] px-2.5 text-[17px] tracking-[0.01em]",
        size === "lg" && "h-14 rounded-[12px] px-3.5 text-[2rem] tracking-[-0.01em] sm:h-16 sm:text-[2.375rem]",
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
  tone = "default",
  label = "Team",
  className,
}: {
  options: { value: T; teamNumber: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "onBrand";
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
              "outline-none transition-transform focus-visible:ring-[3px] active:scale-[0.97]",
              tone === "onBrand" ? "focus-visible:ring-white/60" : "focus-visible:ring-ring/45",
              size === "lg" ? "rounded-[12px]" : size === "md" ? "rounded-[9px]" : "rounded-[6px]",
            )}
          >
            <TeamPlate
              number={option.teamNumber}
              size={size}
              tone={tone}
              muted={!isSelected}
              className={cn(!isSelected && (tone === "onBrand" ? "hover:text-white" : "hover:text-foreground"))}
            />
          </button>
        );
      })}
    </div>
  );
}
