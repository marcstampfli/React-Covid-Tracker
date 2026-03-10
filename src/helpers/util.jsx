import React from "react";
import numeral from "numeral";
import { CircleMarker, Popup, Tooltip } from "react-leaflet";
import { CASE_TYPE_COLORS } from "./data";

const MAP_DENSITY_LIMITS = {
  all: Number.POSITIVE_INFINITY,
  focused: 35,
  balanced: 90,
  full: 160,
};

const MAP_MARKER_LIMITS = {
  cases: { min: 3.5, max: 21 },
  recovered: { min: 3.5, max: 21 },
  deaths: { min: 3, max: 18 },
  vaccinations: { min: 4, max: 24 },
};

export const prettyPrintStat = (stat) =>
  stat ? `+${numeral(stat).format("0,0")}` : "+0";

const formatPopupValue = (country, metric, valueMode) => {
  if (valueMode === "per100k") {
    const per100kKey = `${metric}Per100k`;
    return `${numeral(country[per100kKey] || 0).format("0,0.[0]")} /100k`;
  }

  return numeral(country[metric] || 0).format("0,0");
};

export const showDataOnMap = (
  data,
  casesType = "cases",
  density = "balanced",
  zoom = 3,
  valueKey = casesType,
  valueMode = "total"
) => {
  const color = CASE_TYPE_COLORS[casesType] || CASE_TYPE_COLORS.cases;
  const radiusRange = MAP_MARKER_LIMITS[casesType] || MAP_MARKER_LIMITS.cases;
  const densityLimit = MAP_DENSITY_LIMITS[density] || MAP_DENSITY_LIMITS.balanced;

  const points = [...data]
    .filter(
      (country) =>
        country.countryInfo?.lat &&
        country.countryInfo?.long &&
        Number(country[casesType] || 0) > 0
    )
    .sort((a, b) => Number(b[casesType] || 0) - Number(a[casesType] || 0))
    .slice(0, densityLimit);

  const maxValue = Number(points[0]?.[casesType] || 0);
  const maxLog = Math.log10(maxValue + 1) || 1;

  const zoomScale = 0.75 + Math.min(Math.max((zoom - 2) / 6, 0), 1) * 0.95;

  return points.map((country) => {
    const rawValue = Number(country[valueKey] || 0);
    const scaled = Math.log10(rawValue + 1) / maxLog;
    const radius =
      (radiusRange.min + scaled * (radiusRange.max - radiusRange.min)) * zoomScale;

      return (
        <CircleMarker
          key={country.countryInfo.iso3 || country.country}
          center={[country.countryInfo.lat, country.countryInfo.long]}
          color={color.hex}
          fillColor={color.hex}
          fillOpacity={0.22}
          opacity={0.75}
          weight={1}
          radius={radius}
        >
          <Tooltip direction="top" offset={[0, -2]} opacity={0.95}>
            <span>
              {country.country}: {numeral(rawValue).format("0,0.[00]")}
              {valueKey.includes("Per100k") ? "/100k" : ""}
            </span>
          </Tooltip>
          <Popup>
            <div className="info-container">
              <div
                className="info-flag"
                style={{ backgroundImage: `url(${country.countryInfo.flag})` }}
              ></div>
              <div className="info-name">{country.country}</div>
              <div className="info-confirmed">
                Cases: {formatPopupValue(country, "cases", valueMode)}
              </div>
              <div className="info-recovered">
                Recovered: {formatPopupValue(country, "recovered", valueMode)}
              </div>
              <div className="info-deaths">
                Deaths: {formatPopupValue(country, "deaths", valueMode)}
              </div>
              <div className="info-vaccinations">
                Vaccinations: {formatPopupValue(country, "vaccinations", valueMode)}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      );
    });
};
