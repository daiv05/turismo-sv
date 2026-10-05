import { describe, expect, it } from 'vitest';
import {
  CAMERA_FOV_DEGREES,
  CAMERA_LIMITS,
  applyPan,
  applyRotate,
  applyTilt,
  applyZoom,
  cameraPosition,
  easeInOut,
  framePoint,
  initialCameraState,
  interpolateCamera,
  visibleBounds,
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

describe('visibleBounds', () => {
  const state: CameraState = { target: { x: 1000, z: -500 }, distance: 10_000, tilt: 45, yaw: 0 };

  it('contains the target', () => {
    const b = visibleBounds(state, 16 / 9);
    expect(b.minX).toBeLessThan(1000);
    expect(b.maxX).toBeGreaterThan(1000);
    expect(b.minZ).toBeLessThan(-500);
    expect(b.maxZ).toBeGreaterThan(-500);
  });

  it('grows with distance', () => {
    const near = visibleBounds({ ...state, distance: 2_000 }, 1.5);
    const far = visibleBounds({ ...state, distance: 20_000 }, 1.5);
    expect(far.maxX - far.minX).toBeGreaterThan(near.maxX - near.minX);
  });

  it('is wider on wider screens', () => {
    const narrow = visibleBounds(state, 0.6);
    const wide = visibleBounds(state, 2);
    expect(wide.maxX - wide.minX).toBeGreaterThan(narrow.maxX - narrow.minX);
  });

  it('stays finite at the flattest tilt', () => {
    const b = visibleBounds({ ...state, tilt: 35 }, 2);
    for (const v of Object.values(b)) expect(Number.isFinite(v)).toBe(true);
  });

  it('rejects invalid aspect ratios', () => {
    expect(() => visibleBounds(state, 0)).toThrow(RangeError);
  });
});

describe('interpolateCamera', () => {
  const a: CameraState = { target: { x: 0, z: 0 }, distance: 100_000, tilt: 40, yaw: -20 };
  const b: CameraState = { target: { x: 10_000, z: -4_000 }, distance: 1_000, tilt: 55, yaw: 20 };

  it('returns the endpoints at t=0 and t=1', () => {
    expect(interpolateCamera(a, b, 0)).toEqual(a);
    expect(interpolateCamera(a, b, 1)).toEqual(b);
  });

  it('interpolates distance geometrically so zoom feels even', () => {
    expect(interpolateCamera(a, b, 0.5).distance).toBeCloseTo(10_000, 3);
  });

  it('clamps t to the unit interval', () => {
    expect(interpolateCamera(a, b, 2)).toEqual(b);
    expect(interpolateCamera(a, b, -1)).toEqual(a);
  });
});

describe('easeInOut', () => {
  it('starts at zero, ends at one and is monotonic', () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    let last = 0;
    for (let i = 1; i <= 20; i++) {
      const v = easeInOut(i / 20);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });
});

describe('framePoint', () => {
  it('targets a scene point at the requested distance keeping tilt and yaw', () => {
    const next = framePoint(base, { x: 500, z: 700 }, 2_000);
    expect(next.target).toEqual({ x: 500, z: 700 });
    expect(next.distance).toBe(2_000);
    expect(next.tilt).toBe(base.tilt);
  });

  it('clamps the distance to the camera limits', () => {
    expect(framePoint(base, { x: 0, z: 0 }, 1).distance).toBe(CAMERA_LIMITS.minDistance);
  });
});

describe('camera elevation', () => {
  it('lifts the camera by the terrain elevation under the target', () => {
    const flat = cameraPosition(base);
    const raised = cameraPosition({ ...base, elevation: 1_500 });

    expect(raised.y).toBeCloseTo(flat.y + 1_500, 6);
    expect(raised.x).toBeCloseTo(flat.x, 6);
    expect(raised.z).toBeCloseTo(flat.z, 6);
  });

  it('defaults to sea level', () => {
    expect(cameraPosition({ ...base, elevation: 0 })).toEqual(cameraPosition(base));
  });

  it('computes visible bounds against the raised ground plane', () => {
    const sea = visibleBounds({ ...base, distance: 4_000 }, 1.5);
    const high = visibleBounds({ ...base, distance: 4_000, elevation: 3_000 }, 1.5);

    expect(high.maxX - high.minX).toBeCloseTo(sea.maxX - sea.minX, 3);
    expect((high.minZ + high.maxZ) / 2).toBeCloseTo((sea.minZ + sea.maxZ) / 2, 3);
  });
});
