export const CAMERA_FOV_DEGREES = 25;

export const CAMERA_LIMITS = Object.freeze({
  minTilt: 35,
  maxTilt: 60,
  maxYaw: 45,
  minDistance: 150,
  maxDistance: 450_000,
  worldRadius: 200_000,
});

export interface CameraState {
  target: { x: number; z: number };
  distance: number;
  tilt: number;
  yaw: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function initialCameraState(): CameraState {
  return { target: { x: 0, z: 0 }, distance: CAMERA_LIMITS.maxDistance, tilt: 50, yaw: 0 };
}

export function applyTilt(state: CameraState, deltaDegrees: number): CameraState {
  return { ...state, tilt: clamp(state.tilt + deltaDegrees, CAMERA_LIMITS.minTilt, CAMERA_LIMITS.maxTilt) };
}

export function applyRotate(state: CameraState, deltaDegrees: number): CameraState {
  return { ...state, yaw: clamp(state.yaw + deltaDegrees, -CAMERA_LIMITS.maxYaw, CAMERA_LIMITS.maxYaw) };
}

/**
 * Scales the camera distance, so factors below one zoom in.
 *
 * @throws {RangeError} When the factor is not a positive finite number.
 */
export function applyZoom(state: CameraState, factor: number): CameraState {
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new RangeError(`Zoom factor must be positive and finite, received ${factor}`);
  }
  return { ...state, distance: clamp(state.distance * factor, CAMERA_LIMITS.minDistance, CAMERA_LIMITS.maxDistance) };
}

/**
 * Moves the target by a screen drag, converted to scene meters and rotated by the current yaw.
 * Dragging the map left moves the target east, so the scene follows the pointer.
 *
 * @param drag Pointer delta in pixels.
 * @param viewportHeight Viewport height in pixels, used to derive meters per pixel.
 */
export function applyPan(state: CameraState, drag: { dx: number; dy: number }, viewportHeight: number): CameraState {
  const visibleHeight = 2 * state.distance * Math.tan((CAMERA_FOV_DEGREES * Math.PI) / 360);
  const metersPerPixel = visibleHeight / Math.max(1, viewportHeight);
  const right = -drag.dx * metersPerPixel;
  const forwardSouth = -drag.dy * metersPerPixel;
  const yaw = (state.yaw * Math.PI) / 180;
  const x = state.target.x + right * Math.cos(yaw) + forwardSouth * Math.sin(yaw);
  const z = state.target.z - right * Math.sin(yaw) + forwardSouth * Math.cos(yaw);
  const { worldRadius } = CAMERA_LIMITS;
  return { ...state, target: { x: clamp(x, -worldRadius, worldRadius), z: clamp(z, -worldRadius, worldRadius) } };
}

/**
 * Computes the camera position in scene coordinates, with y up and the camera south of the target at yaw zero.
 */
export function cameraPosition(state: CameraState): Vec3 {
  const tilt = (state.tilt * Math.PI) / 180;
  const yaw = (state.yaw * Math.PI) / 180;
  const horizontal = state.distance * Math.cos(tilt);
  return {
    x: state.target.x + horizontal * Math.sin(yaw),
    y: state.distance * Math.sin(tilt),
    z: state.target.z + horizontal * Math.cos(yaw),
  };
}

export interface GroundBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Approximates the ground rectangle seen by the camera at sea level by intersecting the four screen corner rays
 * with the plane y = 0. Rays that miss the plane, or hit it too far away, are cut at six times the camera distance.
 *
 * @param aspect Viewport width divided by height.
 * @throws {RangeError} When the aspect ratio is not positive and finite.
 */
export function visibleBounds(state: CameraState, aspect: number): GroundBounds {
  if (!Number.isFinite(aspect) || aspect <= 0) {
    throw new RangeError(`Aspect ratio must be positive and finite, received ${aspect}`);
  }
  const eye = cameraPosition(state);
  const toTarget = { x: state.target.x - eye.x, y: -eye.y, z: state.target.z - eye.z };
  const length = Math.hypot(toTarget.x, toTarget.y, toTarget.z);
  const forward = { x: toTarget.x / length, y: toTarget.y / length, z: toTarget.z / length };
  const rightRaw = { x: -forward.z, y: 0, z: forward.x };
  const rightLength = Math.hypot(rightRaw.x, rightRaw.z);
  const right = { x: rightRaw.x / rightLength, y: 0, z: rightRaw.z / rightLength };
  const up = {
    x: right.y * forward.z - right.z * forward.y,
    y: right.z * forward.x - right.x * forward.z,
    z: right.x * forward.y - right.y * forward.x,
  };
  const half = Math.tan((CAMERA_FOV_DEGREES * Math.PI) / 360);
  const maxReach = state.distance * 6;
  const bounds: GroundBounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };

  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const dir = {
      x: forward.x + right.x * sx * half * aspect + up.x * sy * half,
      y: forward.y + right.y * sx * half * aspect + up.y * sy * half,
      z: forward.z + right.z * sx * half * aspect + up.z * sy * half,
    };
    const norm = Math.hypot(dir.x, dir.y, dir.z);
    let t = dir.y < -1e-6 ? -eye.y / dir.y : Infinity;
    if (!(t * norm <= maxReach)) t = maxReach / norm;
    bounds.minX = Math.min(bounds.minX, eye.x + dir.x * t);
    bounds.maxX = Math.max(bounds.maxX, eye.x + dir.x * t);
    bounds.minZ = Math.min(bounds.minZ, eye.z + dir.z * t);
    bounds.maxZ = Math.max(bounds.maxZ, eye.z + dir.z * t);
  }
  return bounds;
}

/**
 * Blends two camera states. Distance changes geometrically so a long zoom feels even.
 *
 * @param t Progress, clamped to the unit interval.
 */
export function interpolateCamera(from: CameraState, to: CameraState, t: number): CameraState {
  if (t <= 0) return { ...from, target: { ...from.target } };
  if (t >= 1) return { ...to, target: { ...to.target } };
  const lerp = (a: number, b: number): number => a + (b - a) * t;
  return {
    target: { x: lerp(from.target.x, to.target.x), z: lerp(from.target.z, to.target.z) },
    distance: from.distance * Math.pow(to.distance / from.distance, t),
    tilt: lerp(from.tilt, to.tilt),
    yaw: lerp(from.yaw, to.yaw),
  };
}

export function easeInOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5 ? 4 * clamped ** 3 : 1 - (-2 * clamped + 2) ** 3 / 2;
}

/**
 * Centers the camera on a scene point at a distance, keeping tilt and yaw.
 */
export function framePoint(state: CameraState, point: { x: number; z: number }, distance: number): CameraState {
  return { ...state, target: { x: point.x, z: point.z }, distance: clamp(distance, CAMERA_LIMITS.minDistance, CAMERA_LIMITS.maxDistance) };
}
