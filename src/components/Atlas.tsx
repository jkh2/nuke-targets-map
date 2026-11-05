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
            Search your town, or click where you are. The reading says what kind of
            danger that spot is in, and the closest safer ground on this map.
            Quieter is not safe. Be there before a crisis, not after the flashes.
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
                    <strong>Closer safer ground.</strong> {reading.quieter.line}
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
                    <strong>Closer safer ground.</strong> {reading.quieter.line}
                  </p>
                ) : null}
              </div>
            )}
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
              Search your town, or click the map. You get three things: how close
              the nearest listed site is, whether you are in a fallout fan for the
              wind you picked, and the closest safer ground on this map.

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
          <p className="fine">Fallout wind. The fans turn. This is not a forecast.</p>
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
            The biggest cities are not the first thing this map cares about. A
            place is listed because of what it means for the person standing near
            it. This is for reading your own ground. It is not a plan.
          </p>
          <ol className="strike-order">
            <li>
              <strong>Near something that can still shoot back.</strong> The red
              points are missile fields, the two ballistic-missile submarine
              bases, bomber bases, command posts, and the radios that reach
              submarines. If you live near one, you are near an opening-strike
              site. The silos are buried, so bursts there are on the ground, and
              ground bursts are the long fallout. That is why the fans start at
              the missile fields, not at the cities.
            </li>
            <li>
              <strong>Near a plant that builds weapons.</strong> Los Alamos,
              Livermore, Oak Ridge, Savannah River, Hanford, the Kansas City
              weapons plant, and Pantex. These are not cities. They are on the
              map so a town next to one is not scored as quiet.
            </li>
            <li>
              <strong>Near a base, a port, or a dam.</strong> Large Army and
              Marine posts, airlift bases, the Port of New York and New Jersey,
              and dams that cannot be replaced quickly. Close to one of these is
              a different problem from living downwind of a missile field.
            </li>
            <li>
              <strong>In a city, which is the later picture.</strong> New York,
              Los Angeles, Chicago, and the other city markers are not the
              opening picture. Living in one is quiet if a strike stays on the
              weapons. It is a poor bet if the war has become an attempt to break
              the country.
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
            These boxes have fewer aim points on this list, and they sit off the
            main silo-fallout fan on the usual wind. Each one has a cost: water,
            winter, medicine, or a road. They are places to already be. They are
            not a drive to start after the flashes.
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
          Aim points come from the 2025 full-scale target list loaded for this
          atlas ({catalog.targets.length} sites). It is for wherever you are, not for one region. Data centers are public
          commercial clusters, not a classified inventory. Fallout fans follow the
          wind you pick. Usual winter is west to west-northwest, dust east to
          east-southeast, including Chicago and Michigan. A weaker summer wind
          does not travel as far. A south wind turns the fans north. They are not
          a forecast. Shelter dots stay off until you ask for them, and they are
          ordinary disaster shelters, not bunkers. This is a planning picture, not
          a prediction and not official guidance.
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
