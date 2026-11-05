import { useEffect, useMemo, useState } from "react";
import { catalog } from "@/data/catalog";
import type { Layers, Picked } from "@/data/types";
import { assess, placeKey, type Assessment } from "@/lib/assess";
import { QUIET_COST, WINDS, type WindId } from "@/lib/wind";
import type { Focus } from "./MapCanvas";
import "leaflet/dist/leaflet.css";

const PRESETS = {
  full: {
    primary: true,
    secondary: true,
    tertiary: true,
    datacenters: true,
    shelters: false,
    fallout: true,
    zones: true,
  },
  counterforce: {
    primary: true,
    secondary: false,
    tertiary: false,
    datacenters: true,
    shelters: false,
    fallout: true,
    zones: true,
  },
  standing: {
    primary: true,
    secondary: false,
    tertiary: false,
    datacenters: false,
    shelters: false,
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
  const [wind, setWind] = useState<WindId>("usual");
  const [spot, setSpot] = useState<{ lat: number; lon: number; label: string } | null>(null);

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

  function readAt(lat: number, lon: number, label: string, next: WindId = wind) {
    setSpot({ lat, lon, label });
    setReading(assess(lat, lon, label, next));
  }

  function pickWind(id: WindId) {
    setWind(id);
    if (spot) setReading(assess(spot.lat, spot.lon, spot.label, id));
  }

  function go(lat: number, lon: number, zoom: number) {
    setTick((n) => n + 1);
    setFocus({ lat, lon, zoom, n: tick + 1 });
  }

  function checkPlace(name: string, state: string, lat: number, lon: number) {
    setPicked({ kind: "place", name, state });
    readAt(lat, lon, `${name}, ${state}`);
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
            Search your town, or click where you are.
          </p>
          <p className="caveat">
            This list is compiled, not official. A quiet reading can mean we left
            something out. California is still{" "}
            {Math.round(
              (100 * catalog.targets.filter((t) => t.state === "CA").length) /
                catalog.targets.length,
            )}
            % of the sites.
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
              readAt(first.target.lat, first.target.lon, first.target.name);
              go(first.target.lat, first.target.lon, 8);
              setQuery("");
            } else {
              setPicked({ kind: "shelter", id: first.shelter.id });
              readAt(first.shelter.lat, first.shelter.lon, first.shelter.name);
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
                      readAt(row.target.lat, row.target.lon, row.target.name);
                      go(row.target.lat, row.target.lon, 8);
                      setQuery("");
                    } else {
                      setPicked({ kind: "shelter", id: row.shelter.id });
                      readAt(row.shelter.lat, row.shelter.lon, row.shelter.name);
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
            <p className="fine rule">{reading.rule}</p>
            {reading.nearestSite ? (
              <div className="distance">
                <p>
                  <strong>{reading.nearestSite.milesLabel}</strong> from{" "}
                  {reading.nearestSite.name}
                  <span className="fine"> · {reading.nearestSite.category}</span>
                </p>
                <p>
                  <strong>Blast.</strong> {reading.blast}
                </p>
                <p>
                  <strong>Fallout.</strong> {reading.fallout}
                </p>
                {reading.later ? (
                  <p>
                    <strong>Later.</strong> {reading.later}
                  </p>
                ) : null}
                {reading.primaryLine ? <p>{reading.primaryLine}</p> : null}
                {reading.quieter ? (
                  <p>
                    <strong>Quieter ground.</strong> {reading.quieter.line}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="distance">
                <p>
                  <strong>Fallout.</strong> {reading.fallout}
                </p>
                {reading.quieter ? (
                  <p>
                    <strong>Quieter ground.</strong> {reading.quieter.line}
                  </p>
                ) : null}
              </div>
            )}
            {reading.reasons.length > 0 ? (
              <ul>
                {reading.reasons.slice(0, 3).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : (
          <section className="verdict band-moderate">
            <h2>Check a place</h2>
            <p>Search a town, or click the map.</p>
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
              Larger war
            </button>
            <button type="button" onClick={() => setLayers(PRESETS.counterforce)}>
              Smaller war
            </button>
            <button type="button" onClick={() => setLayers(PRESETS.standing)}>
              Where to stand
            </button>
          </div>
          <p className="fine">
            A smaller war is the red points and the fallout they throw. A larger
            war adds the cities, ports, and plants. Old public maps draw this as
            triangles against a carpet of dots. The carpet on the plains is the
            silo fields. Those dots are not copied here.
          </p>
          <p className="fine">
            Fallout wind. The fans are the usual direction, not a forecast. A 2021
            picture of the silo fields, using that year's weather, shows the worst
            day at each place: heaviest on the plains just downwind, lighter by the
            East Coast, and light west of the fields. That envelope is wider than
            these fans. One day can also throw a lobe south off Wyoming.
          </p>
          <div className="presets">
            {WINDS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={wind === item.id ? "is-on" : undefined}
                onClick={() => pickWind(item.id)}
              >
                {item.short}
              </button>
            ))}
          </div>
          <ul className="toggles">
            <Toggle on={layers.primary} label="Primary aim points" count={catalog.targets.filter((t) => t.priority === "Primary").length} swatch="danger" onClick={() => toggle("primary")} />
            <Toggle on={layers.secondary} label="Ports, plants, bases" count={catalog.targets.filter((t) => t.priority === "Secondary").length} swatch="severe" onClick={() => toggle("secondary")} />
            <Toggle on={layers.tertiary} label="Cities and airports" count={catalog.targets.filter((t) => t.priority === "Tertiary").length} swatch="tertiary" onClick={() => toggle("tertiary")} />
            <Toggle on={layers.datacenters} label="Data-center hubs" count={catalog.datacenters.length} swatch="data" onClick={() => toggle("datacenters")} />
            <Toggle on={layers.fallout} label="Fallout fans" count={catalog.regions.filter((r) => r.kind === "fallout").length} swatch="severe" onClick={() => toggle("fallout")} />
            <Toggle on={layers.zones} label="Worst and lower zones" count={catalog.regions.filter((r) => r.kind !== "fallout").length} swatch="lower" onClick={() => toggle("zones")} />
            <Toggle on={layers.shelters} label="Ordinary shelters, not bunkers" count={catalog.shelters.length} swatch="lower" onClick={() => toggle("shelters")} />
          </ul>
        </section>

        <section>
          <h3>Why a place is on the map</h3>
          <p className="fine">
            For reading where you stand. Not a plan.
          </p>
          <ol className="strike-order">
            <li>
              <strong>Near something that can still shoot back.</strong> Red
              points: missile fields, the two submarine bases, bomber bases,
              command posts, and the submarine radios. Buried silos mean ground
              bursts, and those are the long fallout. The fans start there, not
              at the cities.
            </li>
            <li>
              <strong>Near a plant that builds weapons.</strong> Los Alamos,
              Livermore, Oak Ridge, Savannah River, Hanford, Kansas City, and
              Pantex. A town next to one is not quiet.
            </li>
            <li>
              <strong>Near a base, a port, or a dam.</strong> Different from
              living downwind of a missile field.
            </li>
            <li>
              <strong>In a city.</strong> Not the opening picture. It matters if
              the war spreads past the weapons.
            </li>
          </ol>
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
                    readAt(lat, lon, region.name);
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
            Fewer listed sites, and off the main fan on the usual winter wind.
            Each box has a cost. A place to already be, not a drive after the flashes.
          </p>
          <ul className="place-list">
            {lower.map((region) => (
              <li key={region.id}>
                <button
                  type="button"
                  onClick={() => {
                    const [lat, lon] = centroid(region.ring);
                    setPicked({ kind: "region", id: region.id });
                    readAt(lat, lon, region.name);
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

        {layers.shelters ? (
        <section>
          <h3>Ordinary shelters, not bunkers</h3>
          <p className="fine">
            {catalog.shelters.length} ordinary shelters listed open on {catalog.shelterSnapshot}.
            Not fallout bunkers.
          </p>
          <ul className="place-list">
            {catalog.shelters.map((shelter) => (
              <li key={shelter.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked({ kind: "shelter", id: shelter.id });
                    readAt(shelter.lat, shelter.lon, shelter.name);
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
        ) : null}

        <footer className="fine colophon">
          A compiled list, not an official one. The fans follow the wind you pick.
          They are not a forecast. Shelters, if you turn them on, are ordinary
          disaster shelters. Not a prediction.
        </footer>
      </aside>
      <div className="atlas-stage">
        {MapView ? (
          <MapView
            layers={layers}
            focus={focus}
            ring={reading?.ring ?? null}
            wind={wind}
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
    readAt(lat, lon, "Clicked ground");
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
    return {
      kicker: r.band === "lower" ? "Lower relative exposure" : r.band === "severe" ? "Fallout fan" : "Worst ground",
      title: r.name,
      body: r.band === "lower" && QUIET_COST[r.id] ? `${r.why} ${QUIET_COST[r.id]}` : r.why,
    };
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
