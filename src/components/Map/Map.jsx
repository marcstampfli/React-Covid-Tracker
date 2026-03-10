import React from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "./Map.css";
import { showDataOnMap } from "../../helpers/util.jsx";
import { CASE_TYPE_COLORS, METRIC_LABELS } from "../../helpers/data.js";

function ZoomListener({ onZoom }) {
  useMapEvents({
    zoomend(event) {
      onZoom(event.target.getZoom());
    },
  });

  return null;
}

function MapUpdater({ center, zoom }) {
  const map = useMap();

  React.useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 0.4 });
  }, [center, map, zoom]);

  return null;
}

function Map({ countries, casesType, center, zoom, density, valueKey, onZoomChange, regionLabel, valueMode }) {
  return (
    <div className="map">
      <div className="map__viewport">
        <MapContainer center={center} zoom={zoom} minZoom={2} maxZoom={8}>
          <MapUpdater center={center} zoom={zoom} />
          <ZoomListener onZoom={onZoomChange} />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          {showDataOnMap(countries, casesType, density, zoom, valueKey, valueMode)}
        </MapContainer>
      </div>
      <div className="map__legend" role="status" aria-live="polite">
        <span className="map__legendLabel">Outbreak map: {regionLabel} ({valueMode === "total" ? "totals" : "per 100k"})</span>
        {Object.entries(METRIC_LABELS).map(([key, label]) => (
          <span
            key={key}
            className={`map__legendItem ${casesType === key ? "map__legendItem--active" : ""}`}
          >
            <i style={{ backgroundColor: CASE_TYPE_COLORS[key].hex }} />
            {label}
          </span>
        ))}
      </div>
      <p className="map__hint">Tip: circle size is now screen-scaled for cleaner overlap; zoom in for island clusters.</p>
    </div>
  );
}

export default Map;
