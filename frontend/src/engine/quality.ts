export const QUALITY_LIMITS = Object.freeze({
  minPixelRatio: 0.75,
  maxPixelRatio: 2,
  targetFps: 55,
  headroomFps: 58,
  step: 0.25,
});

/**
 * Adjusts the render pixel ratio from the measured frame rate: down when under target, up when there is headroom.
 *
 * @param current Pixel ratio in use.
 * @param fps Measured frames per second.
 * @param deviceRatio Native device pixel ratio, an upper bound.
 */
export function nextPixelRatio(current: number, fps: number, deviceRatio: number = QUALITY_LIMITS.maxPixelRatio): number {
  const ceiling = Math.min(deviceRatio, QUALITY_LIMITS.maxPixelRatio);
  let next = current;
  if (fps < QUALITY_LIMITS.targetFps - 3) next = current - QUALITY_LIMITS.step;
  else if (fps >= QUALITY_LIMITS.headroomFps) next = current + QUALITY_LIMITS.step;
  return Math.min(ceiling, Math.max(QUALITY_LIMITS.minPixelRatio, next));
}
