import { useState } from 'react';
import type { DashboardDay } from '../../types/dashboard';
import styles from './OrgDashboard.module.css';

/** "28 Sept" — the day is a plain calendar date, so no timezone shifting. */
function formatDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** A round axis top at or above the busiest day: 4, 5, 10, 20, 25, 50, 100… */
function niceMax(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude >= value)!;
  return step * magnitude;
}

/**
 * Last 30 days, one stacked bar per day: calls answered by the org's staff
 * (primary) under calls that reached its staff but weren't answered here
 * (neutral) — the same two colors and meaning as the staff Overview donut.
 * Hover or focus a day for its numbers; every day is also an aria-label, so
 * the chart never relies on color alone.
 */
export function DailyCallsChart({ days }: { days: DashboardDay[] }) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(...days.map((d) => d.reached)));
  const hovered = active === null ? null : days[active];

  return (
    <div className={styles.chartWrap}>
      <div className={styles.legendInline}>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchAnswered}`} aria-hidden="true" />
          Answered by your staff
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchOther}`} aria-hidden="true" />
          Not answered by your staff
        </span>
      </div>

      <div className={styles.plot}>
        <div className={styles.yAxis} aria-hidden="true">
          <span>{top}</span>
          <span>{top / 2}</span>
          <span>0</span>
        </div>

        <div className={styles.bars} onPointerLeave={() => setActive(null)}>
          <div className={styles.gridTop} aria-hidden="true" />
          <div className={styles.gridMid} aria-hidden="true" />

          {days.map((d, i) => {
            const other = d.reached - d.answered;
            return (
              <div
                key={d.day}
                className={`${styles.day} ${active === i ? styles.dayActive : ''}`}
                tabIndex={0}
                aria-label={`${formatDay(d.day)}: ${d.reached} reached your staff, ${d.answered} answered by your staff`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <div className={styles.stack} style={{ height: `${(d.reached / top) * 100}%` }}>
                  {other > 0 && <div className={styles.segOther} style={{ flexGrow: other }} />}
                  {d.answered > 0 && <div className={styles.segAnswered} style={{ flexGrow: d.answered }} />}
                </div>
              </div>
            );
          })}

          {hovered && active !== null && (
            <div
              className={styles.tooltip}
              style={{
                left: `${((active + 0.5) / days.length) * 100}%`,
                // Anchor slides with the day, so the edge days' tooltips stay inside the chart.
                transform: `translateX(-${10 + (active / (days.length - 1)) * 80}%)`,
              }}
              // The focused day's aria-label already says all of this.
              aria-hidden="true"
            >
              <strong>{formatDay(hovered.day)}</strong>
              <span>
                <span className={`${styles.swatch} ${styles.swatchAnswered}`} aria-hidden="true" />
                {hovered.answered} answered
              </span>
              <span>
                <span className={`${styles.swatch} ${styles.swatchOther}`} aria-hidden="true" />
                {hovered.reached - hovered.answered} not answered here
              </span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.xAxis} aria-hidden="true">
        <span>{formatDay(days[0].day)}</span>
        <span>{formatDay(days[Math.floor(days.length / 2)].day)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
