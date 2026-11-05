import { useEffect, useMemo } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polygon,
  Popup,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import { catalog } from "@/data/catalog";
import type { Layers, Picked } from "@/data/types";
import { mapInk } from "@/lib/tokens";
import { shapeFallout, windById, type WindId } from "@/lib/wind";
import { BasemapLayers } from "./BasemapLayers";
import "leaflet/dist/leaflet.css";

export type Focus = { lat: number; lon: number; zoom: number; n: number };

type Props = {
  layers: Layers;
  focus: Focus | null;
  ring: { lat: number; lon: number } | null;
  onPick: (picked: Picked) => void;
  onLand: (lat: number, lon: number) => void;
  wind: WindId;
};

function Wake() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    fix();
    const early = window.setTimeout(fix, 150);
    const later = window.setTimeout(fix, 700);
    window.addEventListener("resize", fix);
    return () => {
      window.clearTimeout(early);
      window.clearTimeout(later);
      window.removeEventListener("resize", fix);
    };
  }, [map]);
  return null;
}

function Fly({ focus }: { focus: Focus | null }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lon], focus.zoom, { duration: 0.7 });
  }, [focus, map]);
  return null;
}

function LandClick({ onLand }: { onLand: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event) {
      const raw = event.originalEvent.target;
      if (raw instanceof Element && raw.closest(".leaflet-interactive, .leaflet-popup")) {
        return;
      }
      onLand(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

const ZONE_COLOR = {
  worst: mapInk.danger,
  severe: mapInk.severe,
  lower: mapInk.lower,
} as const;

const BLAST_RINGS = [
  { miles: 12, color: "#c4a574", opacity: 0.05 },
  { miles: 6, color: "#d08a45", opacity: 0.07 },
  { miles: 3, color: "#d4533a", opacity: 0.1 },
  { miles: 1.5, color: "#d4533a", opacity: 0.18 },
] as const;

export function MapCanvas({ layers, focus, ring, onPick, onLand, wind }: Props) {
  const zones = useMemo(
    () =>
      [...catalog.regions]
        .map((zone) =>
          zone.kind === "fallout"
            ? { ...zone, ring: shapeFallout(zone.id, zone.ring, wind) }
            : zone,
        )
        .sort((a, b) => {
          const rank = { severe: 0, lower: 1, worst: 2 };
          return rank[a.band] - rank[b.band];
        }),
    [wind],
  );
  const windLabel = windById(wind).short;

  return (
    <MapContainer
      center={[39.4, -96.5]}
      zoom={4}
      minZoom={3}
      maxZoom={13}
      zoomControl={false}
      className="atlas-map"
    >
      <Wake />
      <BasemapLayers />
      <ZoomControl position="bottomright" />
      <Fly focus={focus} />
      <LandClick onLand={onLand} />
      {ring
        ? BLAST_RINGS.map((band) => (
            <Circle
              key={band.miles}
              center={[ring.lat, ring.lon]}
              radius={band.miles * 1609.344}
              pathOptions={{
                color: band.color,
                weight: 1,
                fillColor: band.color,
                fillOpacity: band.opacity,
                interactive: false,
              }}
            />
          ))
        : null}
      {layers.fallout || layers.zones
        ? zones
            .filter((zone) =>
              zone.kind === "fallout" ? layers.fallout : layers.zones,
            )
            .map((zone) => (
              <Polygon
                key={zone.id}
                positions={zone.ring.map((p) => [p[0] ?? 0, p[1] ?? 0] as [number, number])}
                pathOptions={{
                  color: ZONE_COLOR[zone.band],
                  weight: 1,
                  fillColor: ZONE_COLOR[zone.band],
                  fillOpacity: zone.band === "lower" ? 0.16 : 0.28,
                }}
                eventHandlers={{
                  click: () => onPick({ kind: "region", id: zone.id }),
                }}
              >
                <Popup>
                  <strong>{zone.name}</strong>
                  <br />
                  {zone.band === "lower"
                    ? "Lower relative exposure"
                    : zone.band === "severe"
                      ? `Fallout fan · ${windLabel}`
                      : "Worst ground"}
                </Popup>
              </Polygon>
            ))
        : null}
      {layers.tertiary
        ? catalog.targets
            .filter((t) => t.priority === "Tertiary")
            .map((t) => (
              <CircleMarker
                key={t.id}
                center={[t.lat, t.lon]}
                radius={4}
                pathOptions={{
                  color: mapInk.ink,
                  weight: 1,
                  fillColor: mapInk.tertiary,
                  fillOpacity: 0.85,
                }}
                eventHandlers={{ click: () => onPick({ kind: "target", id: t.id }) }}
              >
                <Popup>
                  <strong>{t.name}</strong>
                  <br />
                  Tertiary · {t.category}
                </Popup>
              </CircleMarker>
            ))
        : null}
      {layers.secondary
        ? catalog.targets
            .filter((t) => t.priority === "Secondary")
            .map((t) => (
              <CircleMarker
                key={t.id}
                center={[t.lat, t.lon]}
                radius={5.5}
                pathOptions={{
                  color: mapInk.paper,
                  weight: 1,
                  fillColor: mapInk.severe,
                  fillOpacity: 0.9,
                }}
                eventHandlers={{ click: () => onPick({ kind: "target", id: t.id }) }}
              >
                <Popup>
                  <strong>{t.name}</strong>
                  <br />
                  Secondary · {t.category}
                </Popup>
              </CircleMarker>
            ))
        : null}
      {layers.primary
        ? catalog.targets
            .filter((t) => t.priority === "Primary")
            .map((t) => (
              <CircleMarker
                key={t.id}
                center={[t.lat, t.lon]}
                radius={8}
                pathOptions={{
                  color: mapInk.paper,
                  weight: 1.5,
                  fillColor: mapInk.danger,
                  fillOpacity: 0.95,
                }}
                eventHandlers={{ click: () => onPick({ kind: "target", id: t.id }) }}
              >
                <Popup>
                  <strong>{t.name}</strong>
                  <br />
                  Primary · {t.category}
                </Popup>
              </CircleMarker>
            ))
        : null}
      {layers.datacenters
        ? catalog.datacenters.map((d) => (
            <CircleMarker
              key={d.id}
              center={[d.lat, d.lon]}
              radius={6}
              pathOptions={{
                color: mapInk.paper,
                weight: 1,
                fillColor: mapInk.data,
                fillOpacity: 0.92,
              }}
              eventHandlers={{
                click: () => onPick({ kind: "datacenter", id: d.id }),
              }}
            >
              <Popup>
                <strong>{d.name}</strong>
                <br />
                Data center · {d.scale}
              </Popup>
            </CircleMarker>
          ))
        : null}
      {layers.shelters
        ? catalog.shelters.map((s) => (
            <CircleMarker
              key={s.id}
              center={[s.lat, s.lon]}
              radius={7}
              pathOptions={{
                color: mapInk.lower,
                weight: 2,
                fillColor: mapInk.ink,
                fillOpacity: 0.9,
              }}
              eventHandlers={{
                click: () => onPick({ kind: "shelter", id: s.id }),
              }}
            >
              <Popup>
                <strong>{s.name}</strong>
                <br />
                Open disaster shelter · {s.city}, {s.state}
              </Popup>
            </CircleMarker>
          ))
        : null}
    </MapContainer>
  );
}
