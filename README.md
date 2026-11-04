# Clear Ground

A relative-exposure atlas of a bad hit on the United States.

It shows likely aim points (military, command, ports, energy, logistics, metros), major public data-center clusters, a simplified west-to-east fallout picture from the three Minuteman fields, and shelters the FEMA National Shelter System listed as open on 4 November 2026. Search a town or click the map. Quieter is not the same as safe.

This is an open-source planning picture, not a prediction and not official guidance. The United States does not publish a standing public fallout-shelter network. The green rings are ordinary disaster shelters, not bunkers.

## Run it

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
