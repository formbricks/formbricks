import { cn } from "@/lib/cn";

/**
 * A hairline that sweeps the top edge of the surface currently being generated.
 *
 * Requires a `relative overflow-hidden` parent. Sitting at `-top-px` it lands *on* the card's own
 * border and replaces it for the duration, so the surface still carries exactly one stroke.
 *
 * There is no idle state and no `active` prop: mount it to start, unmount it to stop. That also
 * means a regenerate restarts the animation from frame 0 for free.
 *
 * Decorative and `aria-hidden` — `AiStatusLine` is the accessible signal.
 */
export const AiActivityBar = ({ className }: Readonly<{ className?: string }>) => (
  <div
    aria-hidden="true"
    className={cn("pointer-events-none absolute inset-x-0 -top-px h-px overflow-hidden", className)}>
    {/*
      motion-reduce:w-full is the one hand-rolled reduced-motion override in the kit, and it earns
      its place. The global kill-switch collapses animations to 0.01ms rather than removing them,
      which would strand this bar at translateX(0) — a segment sitting over the left third of the
      edge, reading as "33% done". A full-width static hairline says "this surface is active" with
      no progress implication, which is the honest resting state.
    */}
    <div className="h-px w-1/3 animate-ai-sweep bg-ai motion-reduce:w-full" />
  </div>
);
