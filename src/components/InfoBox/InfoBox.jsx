import React, { useEffect, useRef, useState } from "react";
import numeral from "numeral";
import "./infoBox.css";

function InfoBox({ title, cases, total = 0, trendPercent = null, active, isRed, color, onClick }) {
  const classNames = ["infoBox"];
  const [displayTotal, setDisplayTotal] = useState(Number(total || 0));
  const previousTotalRef = useRef(Number(total || 0));

  if (active) {
    classNames.push("infoBox--selected");
  }

  if (isRed) {
    classNames.push("infoBox--red");
  }

  useEffect(() => {
    const startValue = Number(previousTotalRef.current || 0);
    const endValue = Number(total || 0);

    if (!Number.isFinite(endValue)) {
      return;
    }

    if (startValue === endValue) {
      setDisplayTotal(endValue);
      return;
    }

    let frameId;
    const duration = 650;
    const startTime = performance.now();

    const animate = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const easedProgress = 1 - (1 - progress) ** 3;
      const nextValue = startValue + (endValue - startValue) * easedProgress;

      setDisplayTotal(nextValue);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    previousTotalRef.current = endValue;

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [total]);

  const trendDirection =
    trendPercent === null ? "flat" : trendPercent > 0 ? "up" : trendPercent < 0 ? "down" : "flat";
  const trendArrow = trendDirection === "up" ? "▲" : trendDirection === "down" ? "▼" : "■";
  const trendText =
    trendPercent === null
      ? "Insufficient trend data"
      : `${trendArrow} ${numeral(Math.abs(trendPercent)).format("0.[0]")}% vs prior week`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames.join(" ")}
      aria-pressed={active}
      style={{
        borderColor: active ? color : undefined,
        boxShadow: active ? `0 10px 26px ${color}33` : undefined,
      }}
    >
      <p className="infoBox__title">{title}</p>
      <p className="infoBox__cases" style={{ color }}>
        {cases}
      </p>
      <p className="infoBox__total">{numeral(displayTotal).format("0,0")} total</p>
      <p className={`infoBox__trend infoBox__trend--${trendDirection}`}>{trendText}</p>
    </button>
  );
}

export default InfoBox;
