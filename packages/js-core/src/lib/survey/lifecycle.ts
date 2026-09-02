import { Logger } from "@/lib/common/logger";
import type {
  TSurveyLifecycleEvent,
  TSurveyLifecycleEventHandler,
  TSurveyLifecycleEventType,
} from "@/types/survey";

/**
 * Fan-out of survey lifecycle events ("displayed" / "responded" / "closed") to the host application.
 *
 * The renderer already reports these moments to js-core (onDisplayCreated / onResponseCreated /
 * onClose); this is the public edge of that channel, so an embedding app can run its own frequency
 * capping off what was actually shown rather than off what `track()` was called with — an eligible
 * survey can be skipped by displayPercentage, by a language mismatch, or by a failed identification,
 * and none of those reach the screen.
 *
 * Host handlers run inside the renderer's callbacks, so a throwing handler must not take the survey
 * down with it: `emit` isolates each call and logs instead of propagating.
 */
export class SurveyLifecycleEmitter {
  private static instance: SurveyLifecycleEmitter | undefined;
  private readonly handlers = new Map<TSurveyLifecycleEventType, Set<TSurveyLifecycleEventHandler>>();

  static getInstance(): SurveyLifecycleEmitter {
    SurveyLifecycleEmitter.instance ??= new SurveyLifecycleEmitter();
    return SurveyLifecycleEmitter.instance;
  }

  /** Registers a handler and returns the matching unsubscribe function. */
  public on(eventType: TSurveyLifecycleEventType, handler: TSurveyLifecycleEventHandler): () => void {
    const handlers = this.handlers.get(eventType) ?? new Set<TSurveyLifecycleEventHandler>();
    handlers.add(handler);
    this.handlers.set(eventType, handlers);

    return () => {
      this.off(eventType, handler);
    };
  }

  public off(eventType: TSurveyLifecycleEventType, handler: TSurveyLifecycleEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (!handlers) return;

    handlers.delete(handler);
    if (handlers.size === 0) {
      this.handlers.delete(eventType);
    }
  }

  public emit(event: TSurveyLifecycleEvent): void {
    const handlers = this.handlers.get(event.type);
    if (!handlers?.size) return;

    // Iterate a snapshot: a handler is allowed to unsubscribe itself (a one-shot listener is the
    // obvious way to capture "the first display of this journey leg") while we are still notifying.
    [...handlers].forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        Logger.getInstance().error(
          `Survey lifecycle handler for "${event.type}" threw an error: ${String(error)}`
        );
      }
    });
  }

  public resetInstance(): void {
    SurveyLifecycleEmitter.instance = undefined;
  }
}
