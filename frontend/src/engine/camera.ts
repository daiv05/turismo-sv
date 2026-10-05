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
