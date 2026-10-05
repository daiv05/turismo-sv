export interface DeviceProfile {
  isMobile: boolean;
  deviceMemoryGb: number | undefined;
}

export interface TileBudget {
  errorTarget: number;
  minBytes: number;
  maxBytes: number;
}

const MB = 1024 * 1024;

/**
 * Chooses the tile refinement target and cache size from the device. A higher error target means coarser tiles.
 */
export function tileBudget(profile: DeviceProfile): TileBudget {
  const memory = profile.deviceMemoryGb ?? 4;
  const base = profile.isMobile ? 160 : 512;
  const scale = Math.min(2, Math.max(0.5, memory / 4));
  const maxBytes = Math.round(base * scale) * MB;
  return {
    errorTarget: profile.isMobile ? 14 : 6,
    minBytes: Math.round(maxBytes * 0.6),
    maxBytes,
  };
}
