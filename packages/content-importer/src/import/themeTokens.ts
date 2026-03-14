export type ThemeTokenType = "colors" | "typography" | "radius" | "shadow";

export type ThemeTokenRegistry = {
  colors: Record<string, string>;
  typography: Record<string, string>;
  radius: Record<string, string>;
  shadow: Record<string, string>;
};

export const COLOR_ACCEPT_THRESHOLD = 5;
export const COLOR_SOFT_THRESHOLD = 10;

export const defaultThemeTokenRegistry: ThemeTokenRegistry = {
  colors: {
    primary: "#0057ff",
    accent: "#112233",
    surface: "#ffffff",
    neutral: "#6b7280",
    ink: "#0f172a"
  },
  typography: {
    bodySize: "16px",
    bodyWeight: "400",
    headingWeight: "700",
    bodyLineHeight: "1.5"
  },
  radius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    pill: "9999px"
  },
  shadow: {
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 6px rgba(0,0,0,0.1),0 2px 4px rgba(0,0,0,0.06)",
    lg: "0 10px 15px rgba(0,0,0,0.1),0 4px 6px rgba(0,0,0,0.05)"
  }
};

export type ThemeTokenMatch =
  | {
      status: "exact";
      tokenType: ThemeTokenType;
      tokenKey: string;
    }
  | {
      status: "soft";
      tokenType: "colors";
      tokenKey: string;
      deltaE: number;
    }
  | {
      status: "hard-failure";
      tokenType: "colors";
      reason: string;
      deltaE?: number;
    }
  | {
      status: "unknown";
      tokenType: Exclude<ThemeTokenType, "colors">;
      reason: string;
    };

export type ColorMatchResult = {
  matchedTokenKey: string;
  deltaE: number;
  status: "accept" | "soft" | "reject";
};

export function normalizeThemeKey(theme: string | undefined): string {
  const fallback = "default";
  if (!theme || !theme.trim()) {
    return fallback;
  }

  const normalized = theme
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_\s]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || fallback;
}

export function buildThemeScopeClass(themeKey: string): string {
  return `theme-${normalizeThemeKey(themeKey)}`;
}

export function findNearestColorToken(
  rawColor: string,
  registry: ThemeTokenRegistry = defaultThemeTokenRegistry,
  distanceFn: (leftHex: string, rightHex: string) => number = calculateDeltaE00
): ColorMatchResult | null {
  const source = normalizeHexColor(rawColor);
  if (!source) {
    return null;
  }

  const colorEntries = Object.entries(registry.colors).sort(([left], [right]) => left.localeCompare(right));
  if (colorEntries.length === 0) {
    return null;
  }

  let nearestKey = colorEntries[0][0];
  let nearestDelta = Number.POSITIVE_INFINITY;

  for (const [tokenKey, tokenValue] of colorEntries) {
    const candidate = normalizeHexColor(tokenValue);
    if (!candidate) {
      continue;
    }

    const delta = distanceFn(source, candidate);
    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearestKey = tokenKey;
    }
  }

  if (!Number.isFinite(nearestDelta)) {
    return null;
  }

  if (nearestDelta <= COLOR_ACCEPT_THRESHOLD) {
    return {
      matchedTokenKey: nearestKey,
      deltaE: nearestDelta,
      status: "accept"
    };
  }

  if (nearestDelta <= COLOR_SOFT_THRESHOLD) {
    return {
      matchedTokenKey: nearestKey,
      deltaE: nearestDelta,
      status: "soft"
    };
  }

  return {
    matchedTokenKey: nearestKey,
    deltaE: nearestDelta,
    status: "reject"
  };
}

export function matchThemeToken(
  tokenType: ThemeTokenType,
  rawValue: string,
  registry: ThemeTokenRegistry = defaultThemeTokenRegistry,
  distanceFn: (leftHex: string, rightHex: string) => number = calculateDeltaE00
): ThemeTokenMatch {
  const normalizedRaw = normalizeTokenValue(rawValue);

  if (tokenType === "colors") {
    const nearest = findNearestColorToken(normalizedRaw, registry, distanceFn);
    if (!nearest) {
      return {
        status: "hard-failure",
        tokenType,
        reason: `Invalid color value: ${rawValue}`
      };
    }

    if (nearest.status === "accept") {
      return {
        status: "exact",
        tokenType,
        tokenKey: nearest.matchedTokenKey
      };
    }

    if (nearest.status === "soft") {
      return {
        status: "soft",
        tokenType,
        tokenKey: nearest.matchedTokenKey,
        deltaE: nearest.deltaE
      };
    }

    return {
      status: "hard-failure",
      tokenType,
      reason: `deltaE ${nearest.deltaE.toFixed(3)} exceeds ${COLOR_SOFT_THRESHOLD}`,
      deltaE: nearest.deltaE
    };
  }

  const entries = Object.entries(registry[tokenType]).sort(([left], [right]) => left.localeCompare(right));
  const match = entries.find(([, tokenValue]) => normalizeTokenValue(tokenValue) === normalizedRaw);

  if (match) {
    return {
      status: "exact",
      tokenType,
      tokenKey: match[0]
    };
  }

  return {
    status: "unknown",
    tokenType,
    reason: `No ${tokenType} token matches value: ${rawValue}`
  };
}

function normalizeTokenValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeHexColor(value: string): string | null {
  const raw = value.trim().toLowerCase();

  const hex3 = raw.match(/^#([0-9a-f]{3})$/i);
  if (hex3) {
    const [r, g, b] = hex3[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  if (/^#[0-9a-f]{6}$/i.test(raw)) {
    return raw;
  }

  const rgb = raw.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  if (rgb) {
    const red = clampRgb(Number(rgb[1]));
    const green = clampRgb(Number(rgb[2]));
    const blue = clampRgb(Number(rgb[3]));
    return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
  }

  return null;
}

function clampRgb(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function calculateDeltaE00(leftHex: string, rightHex: string): number {
  const leftLab = rgbToLab(hexToRgb(leftHex));
  const rightLab = rgbToLab(hexToRgb(rightHex));
  return deltaE00(leftLab, rightLab);
}

type Lab = {
  l: number;
  a: number;
  b: number;
};

type Rgb = {
  r: number;
  g: number;
  b: number;
};

function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHexColor(hex);
  if (!normalized) {
    return { r: 0, g: 0, b: 0 };
  }

  const value = normalized.slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function rgbToLab(rgb: Rgb): Lab {
  const xyz = rgbToXyz(rgb);
  const x = xyz.x / 95.047;
  const y = xyz.y / 100;
  const z = xyz.z / 108.883;

  const fx = xyzPivot(x);
  const fy = xyzPivot(y);
  const fz = xyzPivot(z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
}

function rgbToXyz(rgb: Rgb): { x: number; y: number; z: number } {
  const red = rgbPivot(rgb.r / 255);
  const green = rgbPivot(rgb.g / 255);
  const blue = rgbPivot(rgb.b / 255);

  return {
    x: (red * 0.4124 + green * 0.3576 + blue * 0.1805) * 100,
    y: (red * 0.2126 + green * 0.7152 + blue * 0.0722) * 100,
    z: (red * 0.0193 + green * 0.1192 + blue * 0.9505) * 100
  };
}

function rgbPivot(value: number): number {
  if (value > 0.04045) {
    return ((value + 0.055) / 1.055) ** 2.4;
  }
  return value / 12.92;
}

function xyzPivot(value: number): number {
  if (value > 0.008856) {
    return value ** (1 / 3);
  }
  return 7.787 * value + 16 / 116;
}

function deltaE00(left: Lab, right: Lab): number {
  const avgL = (left.l + right.l) / 2;
  const c1 = Math.sqrt(left.a ** 2 + left.b ** 2);
  const c2 = Math.sqrt(right.a ** 2 + right.b ** 2);
  const avgC = (c1 + c2) / 2;

  const g = 0.5 * (1 - Math.sqrt((avgC ** 7) / (avgC ** 7 + 25 ** 7)));
  const a1Prime = (1 + g) * left.a;
  const a2Prime = (1 + g) * right.a;

  const c1Prime = Math.sqrt(a1Prime ** 2 + left.b ** 2);
  const c2Prime = Math.sqrt(a2Prime ** 2 + right.b ** 2);
  const avgCPrime = (c1Prime + c2Prime) / 2;

  const h1Prime = toHueAngle(left.b, a1Prime);
  const h2Prime = toHueAngle(right.b, a2Prime);

  const deltaLPrime = right.l - left.l;
  const deltaCPrime = c2Prime - c1Prime;

  let deltaHPrime = 0;
  if (c1Prime * c2Prime !== 0) {
    const diff = h2Prime - h1Prime;
    if (Math.abs(diff) <= 180) {
      deltaHPrime = diff;
    } else if (diff > 180) {
      deltaHPrime = diff - 360;
    } else {
      deltaHPrime = diff + 360;
    }
  }

  const deltaBigHPrime = 2 * Math.sqrt(c1Prime * c2Prime) * Math.sin(toRadians(deltaHPrime / 2));

  let avgHPrime = h1Prime + h2Prime;
  if (c1Prime * c2Prime !== 0) {
    if (Math.abs(h1Prime - h2Prime) > 180) {
      avgHPrime += 360;
    }
    avgHPrime /= 2;
  }

  const t =
    1 -
    0.17 * Math.cos(toRadians(avgHPrime - 30)) +
    0.24 * Math.cos(toRadians(2 * avgHPrime)) +
    0.32 * Math.cos(toRadians(3 * avgHPrime + 6)) -
    0.2 * Math.cos(toRadians(4 * avgHPrime - 63));

  const deltaTheta = 30 * Math.exp(-1 * (((avgHPrime - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt((avgCPrime ** 7) / (avgCPrime ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (avgL - 50) ** 2) / Math.sqrt(20 + (avgL - 50) ** 2);
  const sc = 1 + 0.045 * avgCPrime;
  const sh = 1 + 0.015 * avgCPrime * t;
  const rt = -Math.sin(toRadians(2 * deltaTheta)) * rc;

  const dl = deltaLPrime / sl;
  const dc = deltaCPrime / sc;
  const dh = deltaBigHPrime / sh;

  return Math.sqrt(dl ** 2 + dc ** 2 + dh ** 2 + rt * dc * dh);
}

function toHueAngle(b: number, aPrime: number): number {
  if (aPrime === 0 && b === 0) {
    return 0;
  }
  const angle = (Math.atan2(b, aPrime) * 180) / Math.PI;
  return angle >= 0 ? angle : angle + 360;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
