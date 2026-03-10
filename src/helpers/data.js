export const CASE_TYPE_COLORS = {
  cases: {
    hex: "#d7263d",
    half_op: "rgba(215, 38, 61, 0.45)",
  },
  recovered: {
    hex: "#2a9d5b",
    half_op: "rgba(42, 157, 91, 0.45)",
  },
  deaths: {
    hex: "#2f3640",
    half_op: "rgba(47, 54, 64, 0.45)",
  },
  vaccinations: {
    hex: "#1f6feb",
    half_op: "rgba(31, 111, 235, 0.4)",
  },
};

export const METRIC_LABELS = {
  cases: "cases",
  recovered: "recoveries",
  deaths: "deaths",
  vaccinations: "vaccinations",
};

export const TIME_RANGE_OPTIONS = [
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
  { label: "180 days", value: "180" },
  { label: "All time", value: "all" },
];

export const MAP_DENSITY_OPTIONS = [
  { label: "All countries", value: "all" },
  { label: "Focused (top 35)", value: "focused" },
  { label: "Balanced (top 90)", value: "balanced" },
  { label: "High detail (top 160)", value: "full" },
];

export const sortData = (data, metric = "cases") => {
  const sortedData = [...data];
  return sortedData.sort((a, b) => (Number(b?.[metric] || 0) - Number(a?.[metric] || 0)));
};

export const getLatestAndDelta = (timeline = {}) => {
  const values = Object.values(timeline).map((value) => Number(value || 0));

  if (values.length === 0) {
    return { total: 0, today: 0 };
  }

  const total = values[values.length - 1];
  const previous = values[values.length - 2] || 0;

  return {
    total,
    today: Math.max(total - previous, 0),
  };
};

export const buildDailySeries = (timelineData, metric) => {
  const source = timelineData?.[metric];

  if (!source) {
    return [];
  }

  const chartData = [];
  let lastValue;

  Object.entries(source).forEach(([date, value]) => {
    const currentValue = Number(value || 0);

    if (typeof lastValue === "number") {
      chartData.push({
        x: date,
        y: Math.max(currentValue - lastValue, 0),
      });
    }

    lastValue = currentValue;
  });

  return chartData;
};

const getTimelineValues = (timeline = {}) =>
  Object.values(timeline).map((value) => Number(value || 0));

export const getWeekOverWeekChange = (timeline = {}) => {
  const values = getTimelineValues(timeline);

  if (values.length < 15) {
    return null;
  }

  const current = values[values.length - 1];
  const weekAgo = values[values.length - 8];
  const twoWeeksAgo = values[values.length - 15];
  const currentWeekDelta = Math.max(current - weekAgo, 0);
  const previousWeekDelta = Math.max(weekAgo - twoWeeksAgo, 0);

  if (previousWeekDelta <= 0) {
    return null;
  }

  return ((currentWeekDelta - previousWeekDelta) / previousWeekDelta) * 100;
};

export const getSevenDayDelta = (timeline = {}) => {
  const values = getTimelineValues(timeline);

  if (values.length < 2) {
    return 0;
  }

  return Math.max(values[values.length - 1] - values[0], 0);
};
