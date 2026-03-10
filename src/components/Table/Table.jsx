import React from "react";
import "./Table.css";
import numeral from "numeral";

function Table({ countries, metric = "cases", metricLabel = "cases", valueMode = "total", accentColor = "#1f6feb" }) {
  const formatValue = (value) => {
    if (valueMode === "per100k") {
      return numeral(value).format("0,0.[0]");
    }

    return numeral(value).format("0,0");
  };

  return (
    <div className="table" role="region" aria-label="Country rankings">
      <table>
        <thead>
          <tr>
            <th scope="col" className="table__rankHeader">#</th>
            <th scope="col">Country</th>
            <th scope="col" className="table__metricHeader">{metricLabel}</th>
          </tr>
        </thead>
        <tbody>
          {countries.length === 0 ? (
            <tr>
              <td className="table__empty" colSpan={3}>No countries match your search.</td>
            </tr>
          ) : null}
          {countries.slice(0, 80).map((country, index) => (
            <tr key={country.countryInfo?.iso3 || country.country}>
              <td className="table__rank">{index + 1}</td>
              <td className="table__countryCell">
                <img src={country.countryInfo?.flag} alt="" loading="lazy" className="table__flag" />
                <span>{country.country}</span>
              </td>
              <td className="table__metricValue" style={{ color: accentColor }}>
                <strong>
                  {formatValue(country[metric])}
                  {valueMode === "per100k" ? " /100k" : ""}
                </strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
