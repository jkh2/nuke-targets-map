# Clear Ground

**Live:** [nuke-targets-map.vercel.app](https://nuke-targets-map.vercel.app)

A relative-exposure atlas for anyone in the United States. Search a town or click the map. The reading gives miles to the nearest listed site, whether that danger is blast, fallout, or a later strike, and the nearer quieter ground. Quieter is not safe. The list is compiled, not official.

Fallout fans follow the wind you pick. Usual winter is west to west-northwest. A weaker summer wind is the same direction, about half as far. A south wind turns the fans north. None of these is a forecast. Shelter dots stay off until asked for. They are ordinary disaster shelters, not bunkers.

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
- Fallout fans follow the wind you pick. Usual winter is west to west-northwest. A weaker summer wind is the same direction, about half as far. A south wind turns the fans north. None of these is a forecast.
