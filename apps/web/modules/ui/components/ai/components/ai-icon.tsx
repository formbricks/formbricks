import { type LucideProps, SparklesIcon } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

/**
 * The single glyph that means "AI" in the product. Exported raw for the handful of call sites that
 * need the bare component rather than a rendered element (`OnboardingOptionsContainer` types its
 * `icon` prop as a lucide component and applies its own sizing). Change the mark here and every AI
 * surface follows.
 */
export const AiGlyph = SparklesIcon;

const AI_ICON_SIZE = {
  /** Inline in a button, menu item or label. */
  sm: "size-4",
  /** Entry-point card. */
  md: "size-8",
  /** Featured tile. */
  lg: "size-12",
} as const;

export type AiIconProps = Omit<LucideProps, "size"> & {
  size?: keyof typeof AI_ICON_SIZE;
  /** Twinkles while a generation is in flight. Decorative — the status text carries the meaning. */
  animated?: boolean;
  /**
   * Which ground the mark sits on. `ai-dark` is the default and is for light surfaces (white cards,
   * menus); `ai-light` is for dark ones (a filled primary button); `inherit` hands the colour back
   * to the parent for cases where the mark should read like any other icon beside it.
   */
  tone?: "ai-dark" | "ai-light" | "inherit";
};

/**
 * Renders the lucide `<svg>` directly, with no wrapper element: `DialogHeader` styles its icon
 * through `[&>svg]` and `Button` sizes its through `[&_svg]:size-4`, and a wrapping `<span>` would
 * silently break both.
 */
export const AiIcon = forwardRef<SVGSVGElement, Readonly<AiIconProps>>(
  ({ size = "sm", animated = false, tone = "ai-dark", className, ...props }, ref) => (
    <AiGlyph
      ref={ref}
      aria-hidden="true"
      // Lucide's proportional stroke reads bloated above ~24px, which is why the featured tile
      // hand-set strokeWidth today. At sm we keep the default so the mark matches the other inline
      // icons sitting next to it.
      {...(size === "sm" ? {} : { strokeWidth: 1.5, absoluteStrokeWidth: true })}
      className={cn(
        AI_ICON_SIZE[size],
        tone === "ai-dark" && "text-ai-dark",
        tone === "ai-light" && "text-ai",
        animated && "animate-ai-twinkle",
        className
      )}
      {...props}
    />
  )
);

AiIcon.displayName = "AiIcon";
