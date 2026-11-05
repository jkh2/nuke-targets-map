export type WindId = "usual" | "summer" | "south";

export const WINDS: { id: WindId; short: string; label: string }[] = [
  {
    id: "usual",
    short: "Usual winter",
    label:
      "Usual winter wind: from the west or west-northwest, so the dust goes east to east-southeast. This is the strong wind, and it travels farthest.",
  },
  {
    id: "summer",
    short: "Weaker summer",
    label:
      "Weaker summer wind: the same direction, about half as far. The same attack does not reach as many towns.",
  },
  {
    id: "south",
    short: "From the south",
    label:
      "Wind from the south: the same dust goes north instead of east. The fans turn. This is not a forecast.",
  },
];

const ORIGIN: Record<string, [number, number]> = {
  "r-plume-mt": [47.5067, -111.1861],
  "r-plume-nd": [48.4158, -101.3387],
  "r-plume-wy": [41.1397, -104.8202],
  "r-plume-lakes": [48.4158, -101.3387],
};

export const QUIET_COST: Record<string, string> = {
  "r-slv":
    "The cost is water, a high-altitude winter, and a road that does not run toward Colorado Springs.",
  "r-gila": "The cost is water and distance. A missing crater does not stock a town.",
  "r-bend": "The cost is heat, water, and supply lines. Harsh country if the trucks stop.",
  "r-utah": "The cost is water and a canyon winter. Salt Lake is north, not inside this box.",
  "r-maine": "The cost is isolation: fuel, medicine, and a long winter a long way from anything.",
  "r-wv": "The cost is mountain roads. Quiet hills still need a hospital that is still there.",
  "r-oregon":
    "The cost is water and emptiness. A high desert is quiet on this list and hard if the trucks stop.",
  "r-seak": "The cost is ferries and fuel. The panhandle is quiet because it is hard to reach.",
};

export function windById(id: WindId) {
  return WINDS.find((w) => w.id === id) ?? WINDS[0]!;
}

function toRad(n: number) {
  return (n * Math.PI) / 180;
}

function toDeg(n: number) {
  return (n * 180) / Math.PI;
}

function kmBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function dest(lat: number, lon: number, brg: number, distKm: number): [number, number] {
  const r = 6371;
  const d = distKm / r;
  const th = toRad(brg);
  const p1 = toRad(lat);
  const l1 = toRad(lon);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(th));
  const l2 =
    l1 +
    Math.atan2(
      Math.sin(th) * Math.sin(d) * Math.cos(p1),
      Math.cos(d) - Math.sin(p1) * Math.sin(p2),
    );
  return [toDeg(p2), ((toDeg(l2) + 540) % 360) - 180];
}

export function shapeFallout(id: string, ring: number[][], wind: WindId): number[][] {
  if (wind === "usual") return ring;
  const origin = ORIGIN[id];
  if (!origin) return ring;
  const rotate = wind === "south" ? -90 : 0;
  const scale = wind === "summer" ? 0.55 : 1;
  const [olat, olon] = origin;
  return ring.map((point) => {
    const lat = point[0] ?? olat;
    const lon = point[1] ?? olon;
    const dist = kmBetween(olat, olon, lat, lon) * scale;
    const brg = (bearing(olat, olon, lat, lon) + rotate + 360) % 360;
    return dest(olat, olon, brg, dist);
  });
}
