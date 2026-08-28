"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { AI_STATUS_DEFAULT_CADENCE_MS, formatElapsed, resolveStatusMessage } from "../lib/status-line";
import { AiIcon } from "./ai-icon";

const TICK_MS = 1000;

export type AiStatusLineProps = {
  /** Flipping this true starts the timer; flipping it false and back resets it to zero. */
  isActive: boolean;
  /** Phases, in the order they happen. */
  messages: readonly string[];
  /**
   * Drive the phase explicitly when the surface knows its real progress (a stream reporting which
   * question it is on). Omit it and the component advances through `messages` on `cadenceMs`, which
   * is what a surface with no progress signal — an ordinary blocking request — should do.
   */
  activeIndex?: number;
  cadenceMs?: number;
  showTimer?: boolean;
  className?: string;
};

/**
 * The house "AI is working" indicator: animated mark, a status phrase, and how long it has been
 * going. One component for every generative surface, so a feature gets a credible waiting state
 * without inventing its own.
 */
export const AiStatusLine = ({
  isActive,
  messages,
  activeIndex,
  cadenceMs = AI_STATUS_DEFAULT_CADENCE_MS,
  showTimer = true,
  className,
}: Readonly<AiStatusLineProps>) => {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      startedAtRef.current = null;
      setElapsedMs(0);
      return;
    }

    startedAtRef.current = Date.now();
    setElapsedMs(0);

    const interval = setInterval(() => {
      const startedAt = startedAtRef.current;
      if (startedAt !== null) {
        setElapsedMs(Date.now() - startedAt);
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  const message = resolveStatusMessage({ messages, activeIndex, elapsedMs, cadenceMs });

  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <AiIcon animated />
      {/*
        The live region is the message alone. The timer is deliberately outside it and aria-hidden:
        an aria-atomic region wrapping a counter re-announces the whole line every second, which
        makes the component unusable with a screen reader.

        `key` on the message makes React remount the span each time the phase changes, so the new
        text fades in. Deliberately a fade on change rather than a continuous pulse: the icon is
        already breathing, and two elements pulsing opacity at once beat against each other — and
        text that never settles is harder to read, which is the opposite of the point.
      */}
      <span role="status" aria-live="polite" aria-atomic="true">
        <span key={message} className="ai-shimmer-text inline-block animate-ai-phase-in">
          {message}
        </span>
      </span>
      {showTimer ? (
        <span aria-hidden="true" className="text-slate-400 tabular-nums">
          · {formatElapsed(elapsedMs)}
        </span>
      ) : null}
    </div>
  );
};
