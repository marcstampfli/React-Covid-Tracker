import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import numeral from "numeral";
import "leaflet/dist/leaflet.css";
import "./App.css";
import InfoBox from "./components/InfoBox/InfoBox.jsx";
import Table from "./components/Table/Table.jsx";
import { prettyPrintStat } from "./helpers/util.jsx";
import {
  CASE_TYPE_COLORS,
  MAP_DENSITY_OPTIONS,
  getLatestAndDelta,
  getSevenDayDelta,
  getWeekOverWeekChange,
  METRIC_LABELS,
  sortData,
  TIME_RANGE_OPTIONS,
} from "./helpers/data";

const LineGraph = lazy(() => import("./components/LineGraph/LineGraph.jsx"));
const Map = lazy(() => import("./components/Map/Map.jsx"));

const WORLDWIDE_CODE = "worldwide";
const WORLD_CENTER = [20, 0];
const DEFAULT_RANGE = "180";
const DEFAULT_CASES_TYPE = "cases";
const AUTO_REFRESH_MS = 5 * 60 * 1000;

const normalizePer100k = (value, population) => {
  if (!population) {
    return 0;
  }

  return (Number(value || 0) / Number(population)) * 100000;
};

const requestJson = async (url) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
};

const mergeCountriesVaccinations = (countries, vaccineCountries = []) => {
  const vaccineMap = vaccineCountries.reduce((accumulator, item) => {
    const key = item.country?.toLowerCase();

    if (!key) {
      return accumulator;
    }

    const timeline = item.timeline || {};
    const latest = Object.values(timeline).pop() || 0;

    return {
      ...accumulator,
      [key]: Number(latest || 0),
    };
  }, {});

  return countries.map((country) => ({
    ...country,
    vaccinations: vaccineMap[country.country.toLowerCase()] || 0,
  }));
};

const parseInitialParams = () => {
  const params = new URLSearchParams(window.location.search);
  const requestedCountry = (params.get("country") || WORLDWIDE_CODE).toLowerCase();
  const requestedRange = params.get("range") || DEFAULT_RANGE;
  const requestedMetric = params.get("metric") || DEFAULT_CASES_TYPE;

  const validRange = TIME_RANGE_OPTIONS.some((option) => option.value === requestedRange)
    ? requestedRange
    : DEFAULT_RANGE;
  const validMetric = Object.keys(CASE_TYPE_COLORS).includes(requestedMetric)
    ? requestedMetric
    : DEFAULT_CASES_TYPE;

  return {
    country: requestedCountry,
    range: validRange,
    metric: validMetric,
  };
};

const loadDashboardData = async (selectedCountry, selectedRange) => {
  const isWorldwide = selectedCountry === WORLDWIDE_CODE;
  const countryPath = isWorldwide ? "all" : `countries/${selectedCountry}`;
  const historicalPath = isWorldwide
    ? `historical/all?lastdays=${selectedRange}`
    : `historical/${selectedCountry}?lastdays=${selectedRange}`;
  const globalVaccinationsPath = `vaccine/coverage?lastdays=${selectedRange}`;
  const countryVaccinationsPath = isWorldwide
    ? globalVaccinationsPath
    : `vaccine/coverage/countries/${selectedCountry}?lastdays=${selectedRange}`;

  const [
    summaryData,
    countriesList,
    historicalData,
    globalVaccinations,
    vaccineCountries,
    countryVaccinations,
    countriesHistorical,
    vaccineCountriesMovers,
  ] = await Promise.all([
    requestJson(`https://disease.sh/v3/covid-19/${countryPath}`),
    requestJson("https://disease.sh/v3/covid-19/countries"),
    requestJson(`https://disease.sh/v3/covid-19/${historicalPath}`),
    requestJson(`https://disease.sh/v3/covid-19/${globalVaccinationsPath}`),
    requestJson("https://disease.sh/v3/covid-19/vaccine/coverage/countries?lastdays=8"),
    requestJson(`https://disease.sh/v3/covid-19/${countryVaccinationsPath}`),
    requestJson("https://disease.sh/v3/covid-19/historical?lastdays=8"),
    requestJson("https://disease.sh/v3/covid-19/vaccine/coverage/countries?lastdays=8"),
  ]);

  const enrichedCountries = mergeCountriesVaccinations(countriesList, vaccineCountries);
  const normalizedHistorical = historicalData.timeline || historicalData;
  const vaccinationsTimeline = countryVaccinations.timeline || countryVaccinations;
  const mergedTimeline = {
    ...normalizedHistorical,
    vaccinations: vaccinationsTimeline,
  };

  const vaccinationStats = getLatestAndDelta(mergedTimeline.vaccinations);
  const countryWithVaccinations = {
    ...summaryData,
    vaccinations: vaccinationStats.total,
    todayVaccinations: vaccinationStats.today,
  };

  if (isWorldwide) {
    const globalVaccinationStats = getLatestAndDelta(globalVaccinations);
    countryWithVaccinations.vaccinations = globalVaccinationStats.total;
    countryWithVaccinations.todayVaccinations = globalVaccinationStats.today;
    mergedTimeline.vaccinations = globalVaccinations;
  }

  return {
    countryInfo: countryWithVaccinations,
    countriesData: enrichedCountries,
    timelineData: mergedTimeline,
    sourceUpdatedAt: countryWithVaccinations.updated || summaryData.updated || null,
    countriesHistorical,
    vaccineCountriesMovers,
    countries: enrichedCountries
      .map((item) => ({
        name: item.country,
        value: item.countryInfo.iso2,
      }))
      .filter((item) => item.value)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
};

const App = () => {
  const initialParams = useMemo(() => parseInitialParams(), []);
  const [country, setCountry] = useState(initialParams.country);
  const [countryInfo, setCountryInfo] = useState({});
  const [countries, setCountries] = useState([]);
  const [countriesData, setCountriesData] = useState([]);
  const [casesType, setCasesType] = useState(initialParams.metric);
  const [timeRange, setTimeRange] = useState(initialParams.range);
  const [mapDensity, setMapDensity] = useState("all");
  const [mapCenter, setMapCenter] = useState(WORLD_CENTER);
  const [mapZoom, setMapZoom] = useState(3);
  const [timelineData, setTimelineData] = useState(null);
  const [search, setSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [valueMode, setValueMode] = useState("total");
  const [mapLiveZoom, setMapLiveZoom] = useState(3);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [sourceUpdatedAt, setSourceUpdatedAt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCountryLoading, setIsCountryLoading] = useState(false);
  const [error, setError] = useState("");
  const [isChartAnimated, setIsChartAnimated] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [compareCountries, setCompareCountries] = useState([]);
  const [compareSeries, setCompareSeries] = useState([]);
  const [moverHistory, setMoverHistory] = useState([]);
  const [moverVaccinations, setMoverVaccinations] = useState([]);
  const chartRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("country", country);
    params.set("range", timeRange);
    params.set("metric", casesType);
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  }, [country, timeRange, casesType]);

  const syncDashboardState = (nextData) => {
    setCountryInfo(nextData.countryInfo);
    setCountriesData(nextData.countriesData);
    setTimelineData(nextData.timelineData);
    setCountries(nextData.countries);
    setSourceUpdatedAt(nextData.sourceUpdatedAt);
    setMoverHistory(Array.isArray(nextData.countriesHistorical) ? nextData.countriesHistorical : []);
    setMoverVaccinations(Array.isArray(nextData.vaccineCountriesMovers) ? nextData.vaccineCountriesMovers : []);
    setLastUpdatedAt(new Date().toISOString());
  };

  const retryLoad = async () => {
    try {
      setIsCountryLoading(true);
      setError("");
      const nextData = await loadDashboardData(country, timeRange);
      syncDashboardState(nextData);
    } catch (loadError) {
      setError(loadError.message || "Retry failed.");
    } finally {
      setIsCountryLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        setError("");
        const nextData = await loadDashboardData(initialParams.country, initialParams.range);
        syncDashboardState(nextData);
        if (initialParams.country !== WORLDWIDE_CODE) {
          const nextCountry = nextData.countriesData.find(
            (item) => item.countryInfo?.iso2?.toLowerCase() === initialParams.country
          );
          if (nextCountry?.countryInfo?.lat && nextCountry?.countryInfo?.long) {
            setMapCenter([nextCountry.countryInfo.lat, nextCountry.countryInfo.long]);
            setMapZoom(4);
            setMapLiveZoom(4);
          }
        }
      } catch (loadError) {
        setError(loadError.message || "Something went wrong while loading data.");
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, [initialParams.country, initialParams.range]);

  const onCountryChange = async (event) => {
    const countryCode = event.target.value;

    try {
      setIsChartAnimated(true);
      setIsCountryLoading(true);
      setError("");
      const nextData = await loadDashboardData(countryCode, timeRange);
      setCountry(countryCode);
      syncDashboardState(nextData);

      if (countryCode === WORLDWIDE_CODE) {
        setMapCenter(WORLD_CENTER);
        setMapZoom(3);
        setMapLiveZoom(3);
      } else if (nextData.countryInfo.countryInfo?.lat && nextData.countryInfo.countryInfo?.long) {
        setMapCenter([nextData.countryInfo.countryInfo.lat, nextData.countryInfo.countryInfo.long]);
        setMapZoom(4);
        setMapLiveZoom(4);
      }
    } catch (loadError) {
      setError(loadError.message || "Failed to update country details.");
    } finally {
      setIsCountryLoading(false);
    }
  };

  const onRangeChange = async (event) => {
    const nextRange = event.target.value;

    try {
      setIsChartAnimated(true);
      setIsCountryLoading(true);
      setError("");
      setTimeRange(nextRange);

      const nextData = await loadDashboardData(country, nextRange);
      syncDashboardState(nextData);
    } catch (loadError) {
      setError(loadError.message || "Failed to update selected time range.");
    } finally {
      setIsCountryLoading(false);
    }
  };

  const countriesWithNormalized = useMemo(() => {
    return countriesData.map((item) => ({
      ...item,
      casesPer100k: normalizePer100k(item.cases, item.population),
      recoveredPer100k: normalizePer100k(item.recovered, item.population),
      deathsPer100k: normalizePer100k(item.deaths, item.population),
      vaccinationsPer100k: normalizePer100k(item.vaccinations, item.population),
    }));
  }, [countriesData]);

  const countryByCode = useMemo(() => {
    return countries.reduce((accumulator, item) => ({
      ...accumulator,
      [item.value.toLowerCase()]: item.name,
    }), {});
  }, [countries]);

  const metricKey = useMemo(() => {
    if (valueMode === "total") {
      return casesType;
    }

    return `${casesType}Per100k`;
  }, [valueMode, casesType]);

  const searchSuggestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return countries
      .filter((item) => item.name.toLowerCase().includes(query))
      .slice(0, 8);
  }, [countries, search]);

  const filteredAndSortedCountries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const data = normalizedSearch
      ? countriesWithNormalized.filter((item) => item.country.toLowerCase().includes(normalizedSearch))
      : countriesWithNormalized;

    return sortData(data, metricKey);
  }, [search, countriesWithNormalized, metricKey]);

  const selectedColor = CASE_TYPE_COLORS[casesType]?.hex || CASE_TYPE_COLORS.cases.hex;
  const activeRegionLabel = country === WORLDWIDE_CODE ? "worldwide" : countryInfo.country || country;

  const insightItems = useMemo(() => {
    const deathRatio = countryInfo.cases
      ? (Number(countryInfo.deaths || 0) / Number(countryInfo.cases || 0)) * 100
      : 0;
    const recoveryRatio = countryInfo.cases
      ? (Number(countryInfo.recovered || 0) / Number(countryInfo.cases || 0)) * 100
      : 0;

    return [
      {
        label: "Case fatality",
        value: `${numeral(deathRatio).format("0.00")}%`,
      },
      {
        label: "Recovery ratio",
        value: `${numeral(recoveryRatio).format("0.00")}%`,
      },
      {
        label: "Population",
        value: numeral(countryInfo.population || 0).format("0,0"),
      },
      {
        label: "Map zoom",
        value: `${mapLiveZoom.toFixed(1)}x`,
      },
    ];
  }, [countryInfo, mapLiveZoom]);

  const trendByMetric = useMemo(() => {
    if (!timelineData) {
      return {};
    }

    return {
      cases: getWeekOverWeekChange(timelineData.cases),
      recovered: getWeekOverWeekChange(timelineData.recovered),
      deaths: getWeekOverWeekChange(timelineData.deaths),
      vaccinations: getWeekOverWeekChange(timelineData.vaccinations),
    };
  }, [timelineData]);

  const topMovers = useMemo(() => {
    if (casesType === "vaccinations") {
      return moverVaccinations
        .map((item) => ({
          country: item.country,
          delta: getSevenDayDelta(item.timeline),
          flag: countriesData.find((countryItem) => countryItem.country === item.country)?.countryInfo?.flag,
        }))
        .filter((item) => item.delta > 0)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 8);
    }

    return moverHistory
      .map((item) => ({
        country: item.country,
        delta: getSevenDayDelta(item.timeline?.[casesType]),
        flag: countriesData.find((countryItem) => countryItem.country === item.country)?.countryInfo?.flag,
      }))
      .filter((item) => item.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 8);
  }, [casesType, moverHistory, moverVaccinations, countriesData]);

  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        setIsChartAnimated(false);
        const nextData = await loadDashboardData(country, timeRange);
        syncDashboardState(nextData);
      } catch (loadError) {
        setError(loadError.message || "Background refresh failed.");
      }
    }, AUTO_REFRESH_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [country, timeRange]);

  useEffect(() => {
    if (!compareMode || compareCountries.length === 0) {
      setCompareSeries([]);
      return;
    }

    const loadCompareData = async () => {
      try {
        const requests = compareCountries
          .filter((code) => code.toLowerCase() !== country)
          .map(async (code) => {
            const timelinePayload = await requestJson(
              `https://disease.sh/v3/covid-19/historical/${code}?lastdays=${timeRange}`
            );

            return {
              code,
              label: countryByCode[code.toLowerCase()] || code,
              timeline: timelinePayload.timeline || {},
            };
          });

        const result = await Promise.all(requests);
        setCompareSeries(result.slice(0, 3));
      } catch {
        setCompareSeries([]);
      }
    };

    loadCompareData();
  }, [compareCountries, compareMode, country, countryByCode, timeRange]);

  const infoCards = [
    {
      key: "cases",
      title: "Cases",
      todayKey: "todayCases",
      totalKey: "cases",
      isRed: true,
    },
    {
      key: "recovered",
      title: "Recovered",
      todayKey: "todayRecovered",
      totalKey: "recovered",
    },
    {
      key: "deaths",
      title: "Deaths",
      todayKey: "todayDeaths",
      totalKey: "deaths",
      isRed: true,
    },
    {
      key: "vaccinations",
      title: "Vaccinations",
      todayKey: "todayVaccinations",
      totalKey: "vaccinations",
    },
  ];

  const handleCasesTypeChange = (nextType) => {
    setIsChartAnimated(true);
    setCasesType(nextType);
  };

  const handleExportChart = () => {
    const chart = chartRef.current;

    if (!chart || typeof chart.toBase64Image !== "function") {
      return;
    }

    const url = chart.toBase64Image("image/png", 1);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `covid-${casesType}-${country}-${timeRange}.png`;
    anchor.click();
  };

  return (
    <div className="app">
      <header className="app__topbar">
        <div className="app__titleBlock">
          <p className="app__eyebrow">Pandemic intelligence network</p>
          <h1>COVID-19 Command Center</h1>
        </div>

        <div className="app__controls">
          <div className="app__controlGroup">
            <label className="app__controlLabel" htmlFor="countrySelect">
              Region
            </label>
            <select
              id="countrySelect"
              className="app__select"
              value={country}
              onChange={onCountryChange}
              disabled={isLoading || isCountryLoading}
            >
              <option value={WORLDWIDE_CODE}>Worldwide</option>
              {countries.map((item) => (
                <option key={item.value} value={item.value.toLowerCase()}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="app__controlGroup">
            <label className="app__controlLabel" htmlFor="rangeSelect">
              Time range
            </label>
            <select
              id="rangeSelect"
              className="app__select"
              value={timeRange}
              onChange={onRangeChange}
              disabled={isLoading || isCountryLoading}
            >
              {TIME_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="app__controlGroup app__controlGroup--search">
            <label className="app__controlLabel" htmlFor="countrySearch">
              Search list
            </label>
            <input
              id="countrySearch"
              className="app__search"
              type="search"
              placeholder="Search countries"
              value={search}
              onFocus={() => setIsSearchOpen(true)}
              onBlur={() => setTimeout(() => setIsSearchOpen(false), 120)}
              onChange={(event) => setSearch(event.target.value)}
            />
            {isSearchOpen && searchSuggestions.length > 0 ? (
              <div className="app__autocomplete">
                {searchSuggestions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className="app__autocompleteItem"
                    onMouseDown={() => {
                      setSearch(item.name);
                      setIsSearchOpen(false);
                    }}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="app__controlGroup">
            <label className="app__controlLabel" htmlFor="mapDensity">
              Map density
            </label>
            <select
              id="mapDensity"
              className="app__select"
              value={mapDensity}
              onChange={(event) => setMapDensity(event.target.value)}
            >
              {MAP_DENSITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="app__status" aria-live="polite">
          <span>Source update: {sourceUpdatedAt ? new Date(sourceUpdatedAt).toLocaleString() : "--"}</span>
          <span>Last sync: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "--"}</span>
        </div>
      </header>

      {error ? (
        <div className="app__error">
          <span>{error}</span>
          <button className="app__retry" type="button" onClick={retryLoad}>
            Retry
          </button>
        </div>
      ) : null}
      {isLoading ? <div className="app__loading">Loading latest dataset...</div> : null}

      <section className="app__statsStrip" aria-label="Metric cards">
        {infoCards.map((card) => (
          <InfoBox
            key={card.key}
            onClick={() => handleCasesTypeChange(card.key)}
            title={card.title}
            isRed={card.isRed}
            active={casesType === card.key}
            color={CASE_TYPE_COLORS[card.key].hex}
            cases={prettyPrintStat(countryInfo[card.todayKey])}
            total={countryInfo[card.totalKey]}
            trendPercent={trendByMetric[card.key]}
          />
        ))}
      </section>

      <section className="app__mapHero app__loadingHost" aria-label="Global map view">
        <Suspense fallback={<div className="app__loadingInline">Loading map...</div>}>
          <Map
            countries={countriesWithNormalized}
            casesType={casesType}
            center={mapCenter}
            zoom={mapLiveZoom || mapZoom}
            density={mapDensity}
            valueKey={metricKey}
            onZoomChange={setMapLiveZoom}
            regionLabel={activeRegionLabel}
            valueMode={valueMode}
          />
        </Suspense>
        {isCountryLoading ? <div className="app__panelOverlay">Updating map data...</div> : null}
      </section>

      <section className="app__panel app__panel--chart app__loadingHost">
        <div className="app__panelHeader">
          <h3>Daily new {METRIC_LABELS[casesType]} ({timeRange === "all" ? "all time" : `${timeRange} days`})</h3>
          <div className="app__chartActions">
            <button
              type="button"
              className={`app__chipButton ${compareMode ? "isActive" : ""}`}
              onClick={() => setCompareMode((value) => !value)}
            >
              Compare countries
            </button>
            <button type="button" className="app__chipButton" onClick={handleExportChart}>
              Export PNG
            </button>
          </div>
        </div>
        {compareMode ? (
          <div className="app__compareControls">
            <label htmlFor="compareCountries">Comparison overlay (up to 3)</label>
            <select
              id="compareCountries"
              multiple
              value={compareCountries}
              onChange={(event) => {
                const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
                setCompareCountries(selected.slice(0, 3));
                setIsChartAnimated(true);
              }}
            >
              {countries.map((item) => (
                <option key={item.value} value={item.value.toLowerCase()}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <Suspense fallback={<div className="app__loadingInline">Loading chart...</div>}>
          <LineGraph
            chartRef={chartRef}
            className="app__graph"
            casesType={casesType}
            timelineData={timelineData}
            compareSeries={compareMode ? compareSeries : []}
            isAnimated={isChartAnimated}
          />
        </Suspense>
        {isCountryLoading ? <div className="app__panelOverlay">Updating chart data...</div> : null}
      </section>

      <section className="app__dataGrid">
        <div className="app__panel app__panel--insight">
          <div className="app__insightMain">
            <h2>Today at a glance</h2>
            <p>
              Monitoring <strong>{activeRegionLabel}</strong> with focus on <strong>{METRIC_LABELS[casesType]}</strong>.
            </p>
            <div className="app__modeToggle" role="group" aria-label="Value mode">
              <button
                type="button"
                className={valueMode === "total" ? "isActive" : ""}
                onClick={() => setValueMode("total")}
              >
                Totals
              </button>
              <button
                type="button"
                className={valueMode === "per100k" ? "isActive" : ""}
                onClick={() => setValueMode("per100k")}
              >
                Per 100k
              </button>
            </div>
          </div>

          <div className="app__insightGrid">
            {insightItems.map((item) => (
              <article key={item.label} className="app__insightCard">
                <p>{item.label}</p>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </div>

        <div className="app__panel app__panel--ranking">
          <h3>Live ranking by {METRIC_LABELS[casesType]}</h3>
          <Table
            countries={filteredAndSortedCountries}
            metric={metricKey}
            metricLabel={METRIC_LABELS[casesType]}
            valueMode={valueMode}
            accentColor={selectedColor}
          />
          <div className="app__movers">
            <h4>Top movers (7 days)</h4>
            <ul>
              {topMovers.map((item) => (
                <li key={item.country}>
                  <span className="app__moverCountry">
                    {item.flag ? <img src={item.flag} alt="" loading="lazy" /> : null}
                    {item.country}
                  </span>
                  <strong>{numeral(item.delta).format("0,0")}</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="app__meta">
        <p className="app__footnote">Showing {activeRegionLabel} data.</p>
        <p className="app__footnote">Source: disease.sh</p>
        <p className="app__footnote">Updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : "--"}</p>
      </footer>
    </div>
  );
};

export default App;
