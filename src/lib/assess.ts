import { catalog } from "@/data/catalog";
import type { Band, Place, Region, Shelter, Target } from "@/data/types";
import { QUIET_COST, shapeFallout, windById, type WindId } from "@/lib/wind";

export type NearSite = {
  name: string;
  state: string;
  category: string;
  km: number;
  milesLabel: string;
  blast: string;
};

export type QuieterRead = {
  name: string;
  line: string;
};

export type Assessment = {
  band: Band;
  title: string;
  summary: string;
  reasons: string[];
  placeLabel: string;
  nearestSite: NearSite | null;
  primaryLine: string | null;
  quieter: QuieterRead | null;
  ring: { lat: number; lon: number } | null;
  nearestPrimary: { name: string; km: number; state: string } | null;
  nearestShelter: { name: string; km: number; city: string; state: string } | null;
  zones: Region[];
  blast: string;
  fallout: string;
  later: string | null;
  rule: string;
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
      "Not necessarily the aim point. You are inside a fallout fan for the wind you picked, or still close to an opening-strike site. The dust arrives after the flashes, and it can last days.",
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
    title: "Quieter on this list",
    summary:
      "This sits in one of the quieter boxes: fewer aim points, and off the main silo-fallout fan on a normal west wind. Quieter is not safe. A wind shift, a later strike, or the loss of fuel, power, and medicine can erase the advantage.",
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

function milesNumber(km: number): number {
  return km * 0.621371;
}

function blastLine(mi: number, name: string): string {
  if (mi < 1.5) {
    return `Inside the ground-zero picture of ${name}: about the first 1.5 miles of one large burst. Do not count on an open-air escape.`;
  }
  if (mi < 3) {
    return `Inside the heavy-blast picture of ${name}, roughly 1.5 to 3 miles. Most houses come down.`;
  }
  if (mi < 6) {
    return `Inside the burn-and-blast picture of ${name}, roughly 3 to 6 miles. A solid wall, and not a window, is what a few minutes of warning can buy.`;
  }
  if (mi < 12) {
    return `Inside the broken-glass picture of ${name}, roughly 6 to 12 miles. Indoors, away from glass.`;
  }
  return `Outside the 12-mile blast picture of ${name}. That circle is only the near damage from one large burst. Ground bursts on the missile fields can throw fallout hundreds of miles downwind.`;
}

function ringCentroid(ring: number[][]): [number, number] {
  let lat = 0;
  let lon = 0;
  const n = Math.max(ring.length - 1, 1);
  for (let i = 0; i < n; i++) {
    lat += ring[i]![0];
    lon += ring[i]![1];
  }
  return [lat / n, lon / n];
}

const RULE: Record<Band, string> = {
  worst:
    "The color is a rule, not physics: inside a worst-ground box, or within about 28 miles of an opening-strike site.",
  severe:
    "The color is a rule, not physics: inside a fallout fan for the wind you picked, or within about 68 miles of an opening-strike site.",
  elevated:
    "The color is a rule, not physics: a port, plant, or base within about 25 miles, a data center within about 19, or a city within about 16.",
  lower:
    "The color means a quieter box: fewer listed aim points, and off the fan for this wind. It is not a safety grade.",
  moderate:
    "The color means nothing on this list is close, and you are outside the fans for this wind. A hole in the list makes this too calm.",
};

function burstNote(target: Target): string {
  const text = `${target.category} ${target.name}`.toLowerCase();
  if (/icbm|silo|minuteman|missile field/.test(text)) {
    return " The silos are buried, so a strike here is a ground burst. That is what throws the long fallout.";
  }
  if (target.priority === "Tertiary" || /metro|airport|air base|bomber|port|airlift/.test(text)) {
    return " A city or an airfield, if struck, is more likely an airburst: bad nearby, much less long fallout.";
  }
  return "";
}

function withCost(id: string, line: string): string {
  const cost = QUIET_COST[id];
  return cost ? `${line} ${cost}` : line;
}

function laterLine(
  any: { row: Target; km: number } | null,
  data: { row: { name: string }; km: number } | null,
): string | null {
  if (!any) return null;
  const text = `${any.row.category} ${any.row.name}`.toLowerCase();
  const cityish =
    any.row.priority !== "Primary" &&
    (any.row.priority === "Tertiary" || /metro|airport|port|refin|plant|dam|army|marine/.test(text));
  if (cityish) {
    return `${any.row.name} is later on the list: a city, a port, a plant, a dam, or a base. Quiet if the strike stays on the weapons. A poor bet if the aim becomes breaking the country.`;
  }
  if (data && data.km < 80) {
    return `${data.row.name} is ${miles(data.km)} away. A data-center hub is quiet on a limited strike and a poor bet in a full exchange.`;
  }
  return null;
}

export function assess(lat: number, lon: number, label: string, wind: WindId = "usual"): Assessment {
  const windInfo = windById(wind);
  const shaped = catalog.regions.map((region) =>
    region.kind === "fallout"
      ? { ...region, ring: shapeFallout(region.id, region.ring, wind) }
      : region,
  );
  const zones = shaped.filter((region) => inside(lat, lon, region.ring));
  const primaries = catalog.targets.filter((t) => t.priority === "Primary");
  const secondaries = catalog.targets.filter((t) => t.priority === "Secondary");
  const tertiaries = catalog.targets.filter((t) => t.priority === "Tertiary");
  const np = nearest(lat, lon, primaries);
  const ns = nearest(lat, lon, secondaries);
  const nt = nearest(lat, lon, tertiaries);
  const nd = nearest(lat, lon, catalog.datacenters);
  const nsh = nearest(lat, lon, catalog.shelters);
  const any = nearest(lat, lon, catalog.targets);

  const inWorst = zones.some((z) => z.band === "worst");
  const inSevere = zones.some((z) => z.band === "severe");
  const inLower = zones.some((z) => z.band === "lower");

  let band: Band;
  if (inWorst || (np && np.km < 45)) band = "worst";
  else if (inSevere || (np && np.km < 110)) band = "severe";
  else if ((ns && ns.km < 40) || (nd && nd.km < 30) || (nt && nt.km < 25)) band = "elevated";
  else if (inLower) band = "lower";
  else band = "moderate";

  const nearestSite: NearSite | null = any
    ? {
        name: any.row.name,
        state: any.row.state,
        category: any.row.category,
        km: any.km,
        milesLabel: miles(any.km),
        blast: blastLine(milesNumber(any.km), any.row.name) + burstNote(any.row),
      }
    : null;

  const fans = zones.filter((z) => z.kind === "fallout");
  const fallout = fans.length
    ? `You are inside ${fans.map((fan) => fan.name).join(", ")}. ${windInfo.label} The dust arrives after the flashes and can last days. This is not the same as standing on the aim point.`
    : `You are outside the marked fans for this wind. ${windInfo.label}`;

  const later = laterLine(any, nd);

  const primaryLine =
    np && any && np.row.id !== any.row.id
      ? `Nearest opening-strike site: ${np.row.name} (${np.row.state}), ${miles(np.km)}.`
      : null;

  const lowerZones = catalog.regions.filter((r) => r.band === "lower");
  const insideLower = zones.find((z) => z.band === "lower");
  let quieter: QuieterRead | null = null;
  if (insideLower && inSevere) {
    quieter = {
      name: insideLower.name,
      line: withCost(
        insideLower.id,
        `${insideLower.name} is a quieter box on the usual wind. For the wind you picked, a fallout fan covers it, so it is not the safer ground right now.`,
      ),
    };
  } else if (insideLower) {
    quieter = {
      name: insideLower.name,
      line: withCost(
        insideLower.id,
        `You are already in quieter ground: ${insideLower.name}. Stay in a solid building. Leaving after the flashes can put you in the open, or downwind.`,
      ),
    };
  } else if (lowerZones.length) {
    let best: { id: string; name: string; km: number } | null = null;
    for (const region of lowerZones) {
      const [clat, clon] = ringCentroid(region.ring);
      const d = kmBetween(lat, lon, clat, clon);
      if (!best || d < best.km) best = { id: region.id, name: region.name, km: d };
    }
    if (best) {
      quieter = {
        name: best.name,
        line: withCost(
          best.id,
          `Closest safer ground on this map: ${best.name}, ${miles(best.km)} away. Be there before a crisis if you are going to be there at all. After the flashes, that drive can put you in the open or downwind, and the road may cross worse ground.`,
        ),
      };
    }
  }

  const reasons: string[] = [];
  if (np && (!any || np.row.id === any.row.id)) {
    reasons.push(
      `Nearest primary aim point: ${np.row.name} (${np.row.state}), ${miles(np.km)} away.`,
    );
  }
  if (ns && ns.km < 200 && (!any || ns.row.id !== any.row.id)) {
    reasons.push(
      `Nearest secondary site: ${ns.row.name} (${ns.row.state}), ${miles(ns.km)}.`,
    );
  }
  if (nt && nt.km < 120 && (!any || nt.row.id !== any.row.id)) {
    reasons.push(`Nearest metro or airport marker: ${nt.row.name}, ${miles(nt.km)}.`);
  }
  if (nd && nd.km < 150) {
    reasons.push(`${nd.row.name} is ${miles(nd.km)} away.`);
  }
  for (const zone of zones) {
    if (zone.band === "lower" || zone.kind === "fallout") continue;
    reasons.push(zone.why);
  }

  return {
    band,
    title: COPY[band].title,
    summary: COPY[band].summary,
    reasons,
    placeLabel: label,
    nearestSite,
    primaryLine,
    quieter,
    ring: any ? { lat: any.row.lat, lon: any.row.lon } : null,
    nearestPrimary: np ? { name: np.row.name, km: np.km, state: np.row.state } : null,
    nearestShelter: nsh
      ? { name: nsh.row.name, km: nsh.km, city: nsh.row.city, state: nsh.row.state }
      : null,
    zones,
    blast:
      nearestSite?.blast ??
      "No listed site to measure a blast picture from. That is not the same as no danger.",
    fallout,
    later,
    rule: RULE[band],
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
