import { catalog } from "@/data/catalog";
import type { Band, Place, Region, Shelter, Target } from "@/data/types";

export type Assessment = {
  band: Band;
  title: string;
  summary: string;
  reasons: string[];
  placeLabel: string;
  nearestPrimary: { name: string; km: number; state: string } | null;
  nearestShelter: { name: string; km: number; city: string; state: string } | null;
  zones: Region[];
};

const COPY: Record<Band, { title: string; summary: string }> = {
  worst: {
    title: "Worst ground",
    summary:
      "This is among the worst places to be if a strike follows the usual counterforce list. The aim point is here, or you are inside the first minutes of a ground-burst field.",
  },
  severe: {
    title: "Severe fallout ground",
    summary:
      "Not necessarily the aim point, but inside the heavy fallout picture when the wind blows west to east, which it usually does. The danger arrives after the flashes, and it can last days.",
  },
  elevated: {
    title: "Elevated",
    summary:
      "A listed target, a nuclear plant, a port, a refinery, or a major data-center cluster is close. Quiet on a limited counterforce strike, a poor bet in a full exchange.",
  },
  moderate: {
    title: "Quieter, not safe",
    summary:
      "No listed aim point is close, and this spot is outside the marked fallout fans. That is a better starting position than the missile fields. It is not a guarantee, and it is not a reason to drive.",
  },
  lower: {
    title: "Lower relative exposure",
    summary:
      "This sits in one of the lower-exposure boxes: fewer aim points, and off the main silo-fallout fan on a normal west wind. Lower is not safe. A wind shift, a later strike, or the loss of fuel, power, and medicine can erase the advantage.",
  },
};

export function kmBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a1 = (lat1 * Math.PI) / 180;
  const a2 = (lat2 * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a1) * Math.cos(a2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

function inside(lat: number, lon: number, ring: number[][]): boolean {
  let on = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i]![0];
    const xi = ring[i]![1];
    const yj = ring[j]![0];
    const xj = ring[j]![1];
    const hit =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
    if (hit) on = !on;
  }
  return on;
}

function nearest<T extends { lat: number; lon: number }>(
  lat: number,
  lon: number,
  rows: T[],
): { row: T; km: number } | null {
  let best: { row: T; km: number } | null = null;
  for (const row of rows) {
    const km = kmBetween(lat, lon, row.lat, row.lon);
    if (!best || km < best.km) best = { row, km };
  }
  return best;
}

function miles(km: number): string {
  const mi = km * 0.621371;
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

export function assess(lat: number, lon: number, label: string): Assessment {
  const zones = catalog.regions.filter((r) => inside(lat, lon, r.ring));
  const primaries = catalog.targets.filter((t) => t.priority === "Primary");
  const secondaries = catalog.targets.filter((t) => t.priority === "Secondary");
  const tertiaries = catalog.targets.filter((t) => t.priority === "Tertiary");
  const np = nearest(lat, lon, primaries);
  const ns = nearest(lat, lon, secondaries);
  const nt = nearest(lat, lon, tertiaries);
  const nd = nearest(lat, lon, catalog.datacenters);
  const nsh = nearest(lat, lon, catalog.shelters);

  const inWorst = zones.some((z) => z.band === "worst");
  const inSevere = zones.some((z) => z.band === "severe");
  const inLower = zones.some((z) => z.band === "lower");

  let band: Band;
  if (inWorst || (np && np.km < 45)) band = "worst";
  else if (inSevere || (np && np.km < 110)) band = "severe";
  else if (
    (ns && ns.km < 40) ||
    (nd && nd.km < 30) ||
    (nt && nt.km < 25)
  )
    band = "elevated";
  else if (inLower) band = "lower";
  else band = "moderate";

  const reasons: string[] = [];
  if (np) {
    reasons.push(
      `Nearest primary aim point: ${np.row.name} (${np.row.state}), ${miles(np.km)} away.`,
    );
  }
  if (ns && ns.km < 200) {
    reasons.push(
      `Nearest secondary site: ${ns.row.name} (${ns.row.state}), ${miles(ns.km)}.`,
    );
  }
  if (nt && nt.km < 120) {
    reasons.push(
      `Nearest metro or airport marker: ${nt.row.name}, ${miles(nt.km)}.`,
    );
  }
  if (nd && nd.km < 150) {
    reasons.push(`${nd.row.name} is ${miles(nd.km)} away.`);
  }
  for (const z of zones) reasons.push(z.why);
  if (nsh) {
    reasons.push(
      `Nearest shelter on the FEMA open list: ${nsh.row.name} in ${nsh.row.city}, ${nsh.row.state} (${miles(nsh.km)}). That is an ordinary disaster shelter reported open on ${catalog.shelterSnapshot}, not a nuclear bunker.`,
    );
  }
  reasons.push(
    "For almost everyone, the better move is to shelter inside a solid building for the first two or three days, not to drive toward a greener part of the map.",
  );

  return {
    band,
    title: COPY[band].title,
    summary: COPY[band].summary,
    reasons,
    placeLabel: label,
    nearestPrimary: np
      ? { name: np.row.name, km: np.km, state: np.row.state }
      : null,
    nearestShelter: nsh
      ? {
          name: nsh.row.name,
          km: nsh.km,
          city: nsh.row.city,
          state: nsh.row.state,
        }
      : null,
    zones,
  };
}

export function placeKey(p: Pick<Place, "name" | "state">): string {
  return `${p.name}, ${p.state}`;
}

export function findPlace(name: string, state: string): Place | undefined {
  return catalog.places.find((p) => p.name === name && p.state === state);
}

export function targetById(id: string): Target | undefined {
  return catalog.targets.find((t) => t.id === id);
}

export function shelterById(id: string): Shelter | undefined {
  return catalog.shelters.find((s) => s.id === id);
}

export function regionById(id: string): Region | undefined {
  return catalog.regions.find((r) => r.id === id);
}
