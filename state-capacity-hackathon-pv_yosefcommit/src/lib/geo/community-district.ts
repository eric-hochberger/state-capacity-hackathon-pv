import fs from "node:fs";
import path from "node:path";
import { zapBrowserDir } from "@/lib/geo/zap-browser";

const BORO_PREFIX: Record<number, string> = {
  1: "M",
  2: "X",
  3: "K",
  4: "Q",
  5: "R",
};

const BORO_NAME: Record<number, string> = {
  1: "Manhattan",
  2: "Bronx",
  3: "Brooklyn",
  4: "Queens",
  5: "Staten Island",
};

export interface CommunityDistrict {
  code: string;
  displayName: string;
}

type Position = [number, number];
type Ring = Position[];
type PolygonCoords = Ring[];

interface DistrictFeature {
  properties: { BoroCD: number };
  geometry:
    | { type: "Polygon"; coordinates: PolygonCoords }
    | { type: "MultiPolygon"; coordinates: PolygonCoords[] }
    | { type: string; coordinates: unknown };
}

let features: DistrictFeature[] | null = null;

function loadFeatures(): DistrictFeature[] {
  if (!features) {
    const file = path.join(zapBrowserDir(), "data", "community_districts.geojson");
    const gj = JSON.parse(fs.readFileSync(file, "utf8")) as {
      features: DistrictFeature[];
    };
    features = gj.features;
  }
  return features;
}

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng: number, lat: number, polygon: PolygonCoords): boolean {
  if (!pointInRing(lng, lat, polygon[0])) return false;
  for (const hole of polygon.slice(1)) {
    if (pointInRing(lng, lat, hole)) return false;
  }
  return true;
}

function pointInFeature(lng: number, lat: number, feature: DistrictFeature): boolean {
  const { geometry } = feature;
  if (geometry.type === "Polygon") {
    return pointInPolygon(lng, lat, geometry.coordinates);
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) =>
      pointInPolygon(lng, lat, polygon)
    );
  }
  return false;
}

function describe(borocd: number): CommunityDistrict | null {
  const boro = Math.floor(borocd / 100);
  const num = borocd % 100;
  const prefix = BORO_PREFIX[boro];
  const name = BORO_NAME[boro];
  if (!prefix || !name) return null;
  const code = `${prefix}${String(num).padStart(2, "0")}`;
  const displayName =
    num > 20
      ? `${name} Joint Interest Area ${num}`
      : `${name} Community Board ${num}`;
  return { code, displayName };
}

export function locateCommunityDistrict(
  lng: number,
  lat: number
): CommunityDistrict | null {
  const matches: CommunityDistrict[] = [];
  for (const feature of loadFeatures()) {
    if (!pointInFeature(lng, lat, feature)) continue;
    const district = describe(Number(feature.properties.BoroCD));
    if (district) matches.push(district);
  }
  if (!matches.length) return null;
  return (
    matches.find((match) => Number(match.code.slice(1)) <= 20) ?? matches[0]
  );
}
