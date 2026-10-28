/*
 * The mock page the creative is drawn on. It is laid out at a fixed device width and scaled down to the
 * space the host gives the view, so a creative looks the same in a 320 px chat column as in a wide pane.
 */

export type TDevice = "desktop" | "phone";

export const DEVICE_FRAMES: Record<TDevice, { width: number; height: number }> = {
  desktop: { width: 880, height: 460 },
  phone: { width: 375, height: 600 },
};

/** Never smaller than this: a creative below a third of its size stops being readable. */
const MIN_SCALE = 0.3;

/** The factor that fits a frame of `frameWidth` into `available` px, never enlarging it. */
export const fitScale = (available: number, frameWidth: number): number => {
  if (!Number.isFinite(available) || available <= 0) return 1;
  return Math.min(1, Math.max(MIN_SCALE, available / frameWidth));
};

export const getScaledSize = (
  device: TDevice,
  available: number
): { scale: number; width: number; height: number } => {
  const frame = DEVICE_FRAMES[device];
  const scale = fitScale(available, frame.width);
  return { scale, width: Math.round(frame.width * scale), height: Math.round(frame.height * scale) };
};
