import { useState } from "react";
import { GeoJSON, LayerGroup, LayersControl, TileLayer, useMapEvents } from "react-leaflet";
import type { FeatureCollection } from "geojson";
import states from "@/data/us-states.json";

const USGS = "https://basemap.nationalmap.gov/arcgis/rest/services";
const BOUNDARIES = states as FeatureCollection;

/** Background cartography only; independent of the atlas's data overlays. */
export function BasemapLayers() {
  const [tileError, setTileError] = useState(false);

  useMapEvents({
    baselayerchange() {
      setTileError(false);
    },
  });

  const tileEvents = {
    tileerror() {
      setTileError(true);
    },
  };

  return (
    <>
      <LayersControl position="topright" collapsed={false}>
        <LayersControl.BaseLayer name="Topographic · USGS" checked>
          <LayerGroup>
            <TileLayer
              url={`${USGS}/USGSTopo/MapServer/tile/{z}/{y}/{x}`}
              attribution={'Map services and data: <a href="https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer" target="_blank" rel="noopener noreferrer">USGS, National Geospatial Program</a>'}
              eventHandlers={tileEvents}
            />
            <GeoJSON
              data={BOUNDARIES}
              style={{ color: "#39473e", weight: 1, opacity: 0.6, fillOpacity: 0 }}
              interactive={false}
            />
          </LayerGroup>
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite / aerial · USGS">
          <LayerGroup>
            <TileLayer
              url={`${USGS}/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}`}
              attribution={'Imagery: USDA, <a href="https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer" target="_blank" rel="noopener noreferrer">USGS The National Map</a> · historical imagery; dates and resolution vary'}
              eventHandlers={tileEvents}
            />
            <GeoJSON
              data={BOUNDARIES}
              style={{ color: "#e8efe9", weight: 1, opacity: 0.7, fillOpacity: 0 }}
              interactive={false}
            />
          </LayerGroup>
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Outline · no imagery">
          <GeoJSON
            data={BOUNDARIES}
            style={{ color: "#3d4f44", weight: 1, fillColor: "#1b2822", fillOpacity: 1 }}
            interactive={false}
          />
        </LayersControl.BaseLayer>
      </LayersControl>
      {tileError ? (
        <div className="basemap-status" role="status">
          Some background tiles could not load. Try another background or choose Outline.
        </div>
      ) : null}
    </>
  );
}
