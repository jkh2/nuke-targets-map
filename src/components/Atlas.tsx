import { useEffect, useMemo, useState } from "react";
import { catalog } from "@/data/catalog";
import type { Layers, Picked } from "@/data/types";
import { assess, placeKey, type Assessment } from "@/lib/assess";
import type { Focus } from "./MapCanvas";
import "leaflet/dist/leaflet.css";

const PRESETS = {
  full: {
    primary: true,
    secondary: true,
    tertiary: true,
    datacenters: true,
    shelters: true,
    fallout: true,
    zones: true,
  },
  counterforce: {
    primary: true,
    secondary: false,
    tertiary: false,
    datacenters: true,
    shelters: true,
    fallout: true,
    zones: true,
  },
  standing: {
    primary: true,
    secondary: false,
    tertiary: false,
    datacenters: false,
    shelters: true,
    fallout: true,
    zones: true,
  },
} satisfies Record<string, Layers>;

const SUGGESTED = [
  ["New York", "NY"],
  ["Los Angeles", "CA"],
  ["Chicago", "IL"],
  ["Houston", "TX"],
  ["Great Falls", "MT"],
  ["Seattle", "WA"],
] as const;

function bandClass(band: Assessment["band"]): string {
  if (band === "worst") return "band-worst";
  if (band === "severe") return "band-severe";
  if (band === "elevated") return "band-elevated";
  if (band === "lower") return "band-lower";
  return "band-moderate";
}

export function Atlas() {
  const [MapView, setMapView] = useState<typeof import("./MapCanvas").MapCanvas | null>(null);
  const [layers, setLayers] = useState<Layers>(PRESETS.full);
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<Focus | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [reading, setReading] = useState<Assessment | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    void import("./MapCanvas").then((mod) => setMapView(() => mod.MapCanvas));
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const places = catalog.places
      .filter((p) => `${p.name} ${p.state}`.toLowerCase().includes(q))
      .slice(0, 6)
      .map((p) => ({ kind: "place" as const, label: placeKey(p), place: p }));
    const targets = catalog.targets
      .filter((t) => `${t.name} ${t.city} ${t.state} ${t.category}`.toLowerCase().includes(q))
      .slice(0, 6)
      .map((t) => ({ kind: "target" as const, label: t.name, target: t }));
    const shelters = catalog.shelters
      .filter((s) => `${s.name} ${s.city} ${s.state}`.toLowerCase().includes(q))
      .slice(0, 4)
      .map((s) => ({ kind: "shelter" as const, label: s.name, shelter: s }));
    return [...places, ...targets, ...shelters].slice(0, 10);
  }, [query]);

  function go(lat: number, lon: number, zoom: number) {
    setTick((n) => n + 1);
    setFocus({ lat, lon, zoom, n: tick + 1 });
  }

  function checkPlace(name: string, state: string, lat: number, lon: number) {
    setPicked({ kind: "place", name, state });
    setReading(assess(lat, lon, `${name}, ${state}`));
    go(lat, lon, name === "Juneau" || state === "AK" || state === "HI" ? 6 : 7);
    setQuery("");
  }

  function toggle(key: keyof Layers) {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const worst = catalog.regions.filter((r) => r.band === "worst");
  const lower = catalog.regions.filter((r) => r.band === "lower");
  const detail = describePick(picked);

  return (
    <div className="atlas-shell">
      <aside className="atlas-panel">
        <header className="atlas-head">
          <p className="eyebrow">Relative exposure atlas</p>
          <h1>Clear Ground</h1>
          <p className="lede">
            For anyone in the United States. Search your town, or click where you
            are. The map shows the aim points on this list, where fallout usually
            travels, and which ground is quieter. Quieter is not safe, and the
            time to be on quieter ground is before a crisis, not after the flashes.
          </p>
        </header>

        <form
          className="search"
          onSubmit={(event) => {
            event.preventDefault();
            const first = results[0];
            if (!first) return;
            if (first.kind === "place") {
              checkPlace(first.place.name, first.place.state, first.place.lat, first.place.lon);
            } else if (first.kind === "target") {
              setPicked({ kind: "target", id: first.target.id });
              setReading(assess(first.target.lat, first.target.lon, first.target.name));
              go(first.target.lat, first.target.lon, 8);
              setQuery("");
            } else {
              setPicked({ kind: "shelter", id: first.shelter.id });
              setReading(assess(first.shelter.lat, first.shelter.lon, first.shelter.name));
              go(first.shelter.lat, first.shelter.lon, 9);
              setQuery("");
            }
          }}
        >
          <label htmlFor="place-search">Check a place</label>
          <input
            id="place-search"
            value={query}
            placeholder="City, base, or shelter"
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </form>
        {results.length > 0 ? (
          <ul className="results">
            {results.map((row) => (
              <li key={row.label}>
                <button
                  type="button"
                  onClick={() => {
                    if (row.kind === "place") {
                      checkPlace(row.place.name, row.place.state, row.place.lat, row.place.lon);
                    } else if (row.kind === "target") {
                      setPicked({ kind: "target", id: row.target.id });
                      setReading(assess(row.target.lat, row.target.lon, row.target.name));
                      go(row.target.lat, row.target.lon, 8);
                      setQuery("");
                    } else {
                      setPicked({ kind: "shelter", id: row.shelter.id });
                      setReading(assess(row.shelter.lat, row.shelter.lon, row.shelter.name));
                      go(row.shelter.lat, row.shelter.lon, 9);
                      setQuery("");
                    }
                  }}
                >
                  <span>{row.label}</span>
                  <small>
                    {row.kind === "place"
                      ? "Place"
                      : row.kind === "target"
                        ? row.target.priority
                        : "Open shelter"}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="chips">
          {SUGGESTED.map(([name, state]) => (
            <button
              key={name}
              type="button"
              className="chip"
              onClick={() => {
                const place = catalog.places.find((p) => p.name === name && p.state === state);
                if (place) checkPlace(place.name, place.state, place.lat, place.lon);
              }}
            >
              {name}
            </button>
          ))}
        </div>

        {reading ? (
          <section className={`verdict ${bandClass(reading.band)}`}>
            <p className="eyebrow">{reading.placeLabel}</p>
            <h2>{reading.title}</h2>
            {reading.nearestSite ? (
              <div className="distance">
                <p>
                  <strong>{reading.nearestSite.milesLabel}</strong> from{" "}
                  {reading.nearestSite.name}
                  <span className="fine">
                    {" "}
                    · {reading.nearestSite.category}
                  </span>
                </p>
                <p>{reading.nearestSite.blast}</p>
                {reading.primaryLine ? <p>{reading.primaryLine}</p> : null}
                {reading.quieter ? <p>{reading.quieter.line}</p> : null}
              </div>
            ) : null}
            <p>{reading.summary}</p>
            <ul>
              {reading.reasons.slice(0, 5).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="verdict band-moderate">
            <h2>Check the ground, then decide</h2>
            <p>
              Search your town, or click the map. The reading is distance from
              your spot to the aim points on this list, and whether that spot sits
              in a fallout fan drawn for a normal west wind.

            </p>
          </section>
        )}

        {detail ? (
          <section className="detail">
            <p className="eyebrow">{detail.kicker}</p>
            <h3>{detail.title}</h3>
            <p>{detail.body}</p>
          </section>
        ) : null}

        <section>
          <div className="row-between">
            <h3>What to show</h3>
          </div>
          <div className="presets">
            <button type="button" onClick={() => setLayers(PRESETS.full)}>
              Full exchange
            </button>
            <button type="button" onClick={() => setLayers(PRESETS.counterforce)}>
              Counterforce
            </button>
            <button type="button" onClick={() => setLayers(PRESETS.standing)}>
              Where to stand
            </button>
          </div>
          <ul className="toggles">
            <Toggle on={layers.primary} label="Primary aim points" count={32} swatch="danger" onClick={() => toggle("primary")} />
            <Toggle on={layers.secondary} label="Ports, plants, bases" count={catalog.targets.filter((t) => t.priority === "Secondary").length} swatch="severe" onClick={() => toggle("secondary")} />
            <Toggle on={layers.tertiary} label="Cities and airports" count={catalog.targets.filter((t) => t.priority === "Tertiary").length} swatch="tertiary" onClick={() => toggle("tertiary")} />
            <Toggle on={layers.datacenters} label="Data-center hubs" count={catalog.datacenters.length} swatch="data" onClick={() => toggle("datacenters")} />
            <Toggle on={layers.fallout} label="Fallout fans" count={catalog.regions.filter((r) => r.kind === "fallout").length} swatch="severe" onClick={() => toggle("fallout")} />
            <Toggle on={layers.zones} label="Worst and lower zones" count={catalog.regions.filter((r) => r.kind !== "fallout").length} swatch="lower" onClick={() => toggle("zones")} />
            <Toggle on={layers.shelters} label="Shelters open now" count={catalog.shelters.length} swatch="lower" onClick={() => toggle("shelters")} />
          </ul>
        </section>

        <section>
          <h3>Worst places</h3>
          <ul className="place-list">
            {worst.map((region) => (
              <li key={region.id}>
                <button
                  type="button"
                  onClick={() => {
                    const [lat, lon] = centroid(region.ring);
                    setPicked({ kind: "region", id: region.id });
                    setReading(assess(lat, lon, region.name));
                    go(lat, lon, 6);
                  }}
                >
                  <span>{region.name}</span>
                  <small>Worst</small>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Lower relative exposure</h3>
          <p className="fine">
            These boxes have no aim point from this list inside them, and they sit
            off the main silo-fallout fan. They are quieter places to already be.
            They are not a destination to drive toward once an attack has started.
            If you can choose where to be, choose before anything happens, and
            then stay put.
          </p>
          <ul className="place-list">
            {lower.map((region) => (
              <li key={region.id}>
                <button
                  type="button"
                  onClick={() => {
                    const [lat, lon] = centroid(region.ring);
                    setPicked({ kind: "region", id: region.id });
                    setReading(assess(lat, lon, region.name));
                    go(lat, lon, region.id === "r-seak" ? 5 : 7);
                  }}
                >
                  <span>{region.name}</span>
                  <small>Lower</small>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Shelters that are actually open</h3>
          <p className="fine">
            FEMA's National Shelter System listed {catalog.shelters.length} shelters
            open on {catalog.shelterSnapshot}. They are Red Cross and local
            disaster shelters, synced for ordinary emergencies. The United States
            does not publish a standing public fallout-shelter network. Cold War
            shelter signs are not maintained space. Do not treat a green ring as
            a bunker.
          </p>
          <ul className="place-list">
            {catalog.shelters.map((shelter) => (
              <li key={shelter.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked({ kind: "shelter", id: shelter.id });
                    setReading(assess(shelter.lat, shelter.lon, shelter.name));
                    go(shelter.lat, shelter.lon, 9);
                  }}
                >
                  <span>
                    {shelter.name}
                    <em>
                      {shelter.city}, {shelter.state}
                    </em>
                  </span>
                  <small>Open</small>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <footer className="fine colophon">
          Aim points come from the 2025 full-scale target list loaded for this
          atlas ({catalog.targets.length} sites). It is for wherever you are, not for one region. Data centers are public
          commercial clusters, not a classified inventory. Fallout fans are a
          west-to-east simplification, not a forecast. Shelter dots are a snapshot
          of {catalog.shelterSource}. This is a planning picture, not a prediction
          and not official guidance.
        </footer>
      </aside>
      <div className="atlas-stage">
        {MapView ? (
          <MapView
            layers={layers}
            focus={focus}
            ring={reading?.ring ?? null}
            onPick={setPicked}
            onLand={onLand}
          />
        ) : (
          <div className="map-pending">
            <p>Loading the map of the lower forty-eight, Alaska, and Hawaii.</p>
          </div>
        )}
        <div className="map-legend">
          <span><i className="swatch danger" /> Primary</span>
          <span><i className="swatch severe" /> Secondary</span>
          <span><i className="swatch tertiary" /> City</span>
          <span><i className="swatch data" /> Data</span>
          <span><i className="swatch severe" /> 12 mi ring</span>
          <span><i className="swatch lower hollow" /> Shelter open</span>
        </div>
      </div>
    </div>
  );

  function onLand(lat: number, lon: number) {
    setPicked(null);
    setReading(assess(lat, lon, "Clicked ground"));
  }
}

function centroid(ring: number[][]): [number, number] {
  let lat = 0;
  let lon = 0;
  const n = Math.max(ring.length - 1, 1);
  for (let i = 0; i < n; i++) {
    lat += ring[i]![0];
    lon += ring[i]![1];
  }
  return [lat / n, lon / n];
}

function describePick(picked: Picked | null): { kicker: string; title: string; body: string } | null {
  if (!picked) return null;
  if (picked.kind === "target") {
    const t = catalog.targets.find((row) => row.id === picked.id);
    if (!t) return null;
    return {
      kicker: `${t.priority} · ${t.category}`,
      title: t.name,
      body: [
        [t.city, t.state].filter(Boolean).join(", "),
        t.multiple ? "Listed for more than one weapon." : "",
        t.notes,
      ]
        .filter(Boolean)
        .join(" "),
    };
  }
  if (picked.kind === "shelter") {
    const s = catalog.shelters.find((row) => row.id === picked.id);
    if (!s) return null;
    return {
      kicker: "Open disaster shelter, not a fallout bunker",
      title: s.name,
      body: `${s.address}, ${s.city}, ${s.state} ${s.zip}. Status ${s.status}. ${s.org || "FEMA National Shelter System"}${s.capacity ? `. Listed capacity ${s.capacity}.` : "."}`,
    };
  }
  if (picked.kind === "datacenter") {
    const d = catalog.datacenters.find((row) => row.id === picked.id);
    if (!d) return null;
    return { kicker: `Data center · ${d.scale}`, title: d.name, body: d.note };
  }
  if (picked.kind === "region") {
    const r = catalog.regions.find((row) => row.id === picked.id);
    if (!r) return null;
    return { kicker: r.band === "lower" ? "Lower relative exposure" : r.band === "severe" ? "Fallout fan" : "Worst ground", title: r.name, body: r.why };
  }
  return null;
}

function Toggle({
  on,
  label,
  count,
  swatch,
  onClick,
}: {
  on: boolean;
  label: string;
  count: number;
  swatch: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button type="button" aria-pressed={on} onClick={onClick}>
        <i className={`swatch ${swatch}`} />
        <span>{label}</span>
        <small>{on ? count : "off"}</small>
      </button>
    </li>
  );
}
