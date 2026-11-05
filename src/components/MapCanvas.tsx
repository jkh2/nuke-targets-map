import { useEffect } from "react";
import {
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
import { BasemapLayers } from "./BasemapLayers";
import "leaflet/dist/leaflet.css";

export type Focus = { lat: number; lon: number; zoom: number; n: number };

type Props = {
  layers: Layers;
  focus: Focus | null;
  onPick: (picked: Picked) => void;
  onLand: (lat: number, lon: number) => void;
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

export function MapCanvas({ layers, focus, onPick, onLand }: Props) {
  const zones = [...catalog.regions].sort((a, b) => {
    const rank = { severe: 0, lower: 1, worst: 2 };
    return rank[a.band] - rank[b.band];
  });

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
                      ? "Fallout corridor"
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
