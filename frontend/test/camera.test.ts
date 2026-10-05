import { describe, expect, it } from 'vitest';
import {
  CAMERA_FOV_DEGREES,
  CAMERA_LIMITS,
  applyPan,
  applyRotate,
  applyTilt,
  applyZoom,
  cameraPosition,
  initialCameraState,
  type CameraState,
} from '../src/engine/camera';

const base: CameraState = { target: { x: 0, z: 0 }, distance: 10_000, tilt: 45, yaw: 0 };

describe('camera constants', () => {
  it('uses a narrow isometric style field of view', () => {
    expect(CAMERA_FOV_DEGREES).toBe(25);
    expect(CAMERA_LIMITS.minTilt).toBe(35);
    expect(CAMERA_LIMITS.maxTilt).toBe(60);
  });
});

describe('applyTilt', () => {
  it('clamps the tilt to the allowed range', () => {
    expect(applyTilt(base, 100).tilt).toBe(60);
    expect(applyTilt(base, -100).tilt).toBe(35);
    expect(applyTilt(base, 5).tilt).toBe(50);
  });
});

describe('applyZoom', () => {
  it('scales the distance and clamps it to the limits', () => {
    expect(applyZoom(base, 0.5).distance).toBe(5_000);
    expect(applyZoom(base, 1e-9).distance).toBe(CAMERA_LIMITS.minDistance);
    expect(applyZoom(base, 1e9).distance).toBe(CAMERA_LIMITS.maxDistance);
  });

  it('rejects non positive factors', () => {
    expect(() => applyZoom(base, 0)).toThrow(RangeError);
    expect(() => applyZoom(base, -1)).toThrow(RangeError);
  });
});

describe('applyRotate', () => {
  it('limits yaw to the allowed span around north', () => {
    expect(applyRotate(base, 500).yaw).toBe(CAMERA_LIMITS.maxYaw);
    expect(applyRotate(base, -500).yaw).toBe(-CAMERA_LIMITS.maxYaw);
  });
});

describe('applyPan', () => {
  it('moves the target east when dragging left at yaw zero', () => {
    const moved = applyPan(base, { dx: -100, dy: 0 }, 1);
    expect(moved.target.x).toBeGreaterThan(0);
    expect(Math.abs(moved.target.z)).toBeLessThan(1e-9);
  });

  it('moves the target south when dragging up at yaw zero', () => {
    const moved = applyPan(base, { dx: 0, dy: -100 }, 1);
    expect(moved.target.z).toBeGreaterThan(0);
  });

  it('moves further for the same drag when zoomed out', () => {
    const near = applyPan({ ...base, distance: 1_000 }, { dx: -100, dy: 0 }, 1);
    const far = applyPan({ ...base, distance: 10_000 }, { dx: -100, dy: 0 }, 1);
    expect(far.target.x).toBeGreaterThan(near.target.x);
  });

  it('keeps the target inside the world limit', () => {
    const moved = applyPan({ ...base, target: { x: CAMERA_LIMITS.worldRadius, z: 0 } }, { dx: -1e6, dy: 0 }, 1);
    expect(moved.target.x).toBe(CAMERA_LIMITS.worldRadius);
  });
});

describe('cameraPosition', () => {
  it('places the camera south of the target looking north at yaw zero', () => {
    const p = cameraPosition(base);
    expect(p.z).toBeGreaterThan(0);
    expect(p.y).toBeGreaterThan(0);
    expect(Math.abs(p.x)).toBeLessThan(1e-9);
  });

  it('keeps the camera at the requested distance from the target', () => {
    const p = cameraPosition(base);
    expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(base.distance, 6);
  });
});

describe('initialCameraState', () => {
  it('starts at country level', () => {
    expect(initialCameraState().distance).toBe(CAMERA_LIMITS.maxDistance);
  });
});
