import { buildDailySeries, getLatestAndDelta, sortData } from "./data.js";

describe("data helpers", () => {
  test("sortData orders countries by metric descending", () => {
    const countries = [
      { country: "A", cases: 10, vaccinations: 40 },
      { country: "B", cases: 50, vaccinations: 10 },
      { country: "C", cases: 20, vaccinations: 60 },
    ];

    const sortedByCases = sortData(countries, "cases");
    const sortedByVaccinations = sortData(countries, "vaccinations");

    expect(sortedByCases.map((item) => item.country)).toEqual(["B", "C", "A"]);
    expect(sortedByVaccinations.map((item) => item.country)).toEqual(["C", "A", "B"]);
  });

  test("getLatestAndDelta returns latest total and positive daily change", () => {
    const timeline = {
      "1/1/24": 100,
      "1/2/24": 160,
      "1/3/24": 150,
    };

    expect(getLatestAndDelta(timeline)).toEqual({
      total: 150,
      today: 0,
    });
  });

  test("buildDailySeries converts cumulative values to daily values", () => {
    const timelineData = {
      vaccinations: {
        "1/1/24": 100,
        "1/2/24": 180,
        "1/3/24": 220,
      },
    };

    expect(buildDailySeries(timelineData, "vaccinations")).toEqual([
      { x: "1/2/24", y: 80 },
      { x: "1/3/24", y: 40 },
    ]);
  });
});
