import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import numeral from "numeral";
import "chartjs-adapter-date-fns";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  TimeScale,
  Tooltip,
} from "chart.js";
import { buildDailySeries, CASE_TYPE_COLORS } from "../../helpers/data";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
  TimeScale
);

const COMPARISON_COLORS = ["#f4b942", "#00c2a8", "#d188ff"];

const buildOptions = (isAnimated) => ({
  color: "#e8edf5",
  animation: isAnimated ? { duration: 500 } : false,
  plugins: {
    legend: {
      display: true,
      labels: {
        color: "#c6d7ef",
        boxWidth: 14,
      },
    },
    tooltip: {
      mode: "index",
      intersect: false,
      backgroundColor: "rgba(10, 14, 26, 0.96)",
      borderColor: "#2b3d5d",
      borderWidth: 1,
      titleColor: "#e8edf5",
      bodyColor: "#d6e3f5",
      callbacks: {
        label(tooltipItem) {
          return `${tooltipItem.dataset.label}: ${numeral(tooltipItem.parsed.y || 0).format("+0,0")}`;
        },
      },
    },
  },
  elements: {
    point: {
      radius: 0,
    },
  },
  maintainAspectRatio: false,
  scales: {
    x: {
      type: "time",
      time: {
        tooltipFormat: "PP",
      },
      ticks: {
        color: "#8ea4c4",
        maxRotation: 0,
      },
      grid: {
        color: "rgba(34, 50, 75, 0.6)",
      },
    },
    y: {
      beginAtZero: true,
      grid: {
        color: "rgba(34, 50, 75, 0.45)",
      },
      ticks: {
        color: "#8ea4c4",
        maxTicksLimit: 6,
        callback(value) {
          return numeral(value).format("0a");
        },
      },
    },
  },
});

function LineGraph({
  casesType = "cases",
  timelineData,
  compareSeries = [],
  isAnimated = true,
  chartRef,
  ...props
}) {
  const data = useMemo(() => buildDailySeries(timelineData, casesType), [timelineData, casesType]);
  const options = useMemo(() => buildOptions(isAnimated), [isAnimated]);

  const color = CASE_TYPE_COLORS[casesType] || CASE_TYPE_COLORS.cases;
  const fillColor = color.half_op.replace(/0\.\d+\)/, "0.55)");

  const datasets = [
    {
      label: "Selected region",
      backgroundColor: fillColor,
      borderColor: color.hex,
      data,
      fill: true,
      borderWidth: 2,
      tension: 0.22,
    },
    ...compareSeries.map((series, index) => ({
      label: series.label,
      data: buildDailySeries(series.timeline, casesType),
      borderColor: COMPARISON_COLORS[index % COMPARISON_COLORS.length],
      backgroundColor: "transparent",
      fill: false,
      borderDash: [6, 5],
      borderWidth: 2,
      tension: 0.22,
    })),
  ];

  const hasAnyData = datasets.some((dataset) => dataset.data.length > 0);

  return (
    <div className={props.className}>
      {hasAnyData ? (
        <Line
          ref={chartRef}
          data={{ datasets }}
          options={options}
        />
      ) : (
        <div className="lineGraph__empty">No timeline data available for this range.</div>
      )}
    </div>
  );
}

export default LineGraph;
