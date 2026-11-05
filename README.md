# Clear Ground

**Live:** [nuke-targets-map.vercel.app](https://nuke-targets-map.vercel.app)

A relative-exposure atlas for anyone in the United States. Search a town or click the map and read that place: aim points on this list, a fallout picture from the three Minuteman fields on the usual west to west-northwest wind, and how that spot compares. It is a way to understand your own position. It is not a plan for one valley, and quieter ground is not safe ground.

It shows likely aim points (military, command, ports, energy, logistics, metros), major public data-center clusters, a fallout picture from the three Minuteman fields on the usual west to west-northwest wind, and shelters the FEMA National Shelter System listed as open on 4 November 2026. Search a town or click the map. The reading gives miles to the nearest listed site, a rough 12-mile blast picture for one large burst, and the nearest quieter box. Quieter is not the same as safe, and that box is a place to already be, not a drive to start after the flashes.

This is an open-source planning picture, not a prediction and not official guidance. The United States does not publish a standing public fallout-shelter network. The green rings are ordinary disaster shelters, not bunkers.

## Map backgrounds

Use **Map background** in the map's upper-right corner to switch between:

- **Topographic · USGS** (default): terrain relief, place names, and topographic reference mapping.
- **Satellite / aerial · USGS**: The National Map's imagery background, combining satellite imagery at broad scales and aerial photography where available.
- **Outline · no imagery**: the original state-outline background, which does not request external imagery tiles.

State outlines are transparent over imagery and topographic tiles so the background stays visible. Switching backgrounds keeps the current map position and overlay selection. If tiles fail, the map displays a notice and Outline remains available.

Sources: [USGS Topo](https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer) and [USGS Imagery Only](https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer). Imagery is historical, not live. Capture dates, resolution, and coverage vary by location; a service refresh date is not an image capture date. These backgrounds do not validate any of the atlas's scenario assumptions or establish road passability or shelter access.

## Run locally

```bash
npm install
npm run dev
```

The dev server listens on port 8080.

## Data

- Aim points are compiled in `src/data/catalog.ts` from a 2025 full-scale target list.
- State outlines are `src/data/us-states.json`.
- Shelter dots are a snapshot, not a live feed. They go stale.
- Fallout fans assume a normal west wind. A different wind moves them.
