import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../config/api';
import type { CallStats, CallStatsPeriod } from '../../types/calls';
import { Card } from '../ui/Card';
import styles from './CallStatsCard.module.css';

const PERIODS: { value: CallStatsPeriod; label: string; caption: string }[] = [
  { value: 'day', label: 'Day', caption: 'last 24 hours' },
  { value: 'week', label: 'Week', caption: 'last 7 days' },
  { value: 'month', label: 'Month', caption: 'last 30 days' },
];

// Donut geometry: r = 15.9155 makes the circumference 100, so a slice's
// dash length is simply its percentage.
const RADIUS = 15.9155;
const STROKE = 3.6;
// Surface-colored gap between the two slices, in the same 0–100 units.
const GAP = 1.2;

type Slice = 'accepted' | 'other';

/**
 * Overview chart for a staff member: of the calls that rang for them in the
 * period, how many they answered. The rest is labelled "Not answered by you",
 * not "Missed": it includes calls another responder took first and callers
 * who hung up.
 */
export function CallStatsCard({ className }: { className?: string }) {
  const [period, setPeriod] = useState<CallStatsPeriod>('week');
  const [stats, setStats] = useState<CallStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<Slice | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    // The previous period's numbers stay on screen until these arrive, so the card doesn't jump.
    apiFetch<CallStats>(`/staff/me/call-stats?period=${period}`)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again');
      });

    return () => {
      cancelled = true;
    };
  }, [period]);

  const caption = PERIODS.find((p) => p.value === period)!.caption;

  const filter = (
    <div className={styles.segmented} role="group" aria-label="Period">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          className={`${styles.segment} ${p.value === period ? styles.segmentActive : ''}`}
          aria-pressed={p.value === period}
          onClick={() => setPeriod(p.value)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  function renderBody() {
    if (error) {
      return (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      );
    }
    if (!stats) return <p className={styles.empty}>Loading…</p>;
    if (stats.rung === 0) return <p className={styles.empty}>No calls rang for you in the {caption}.</p>;

    const notAnswered = stats.rung - stats.accepted;
    const acceptedPct = (stats.accepted / stats.rung) * 100;

    return (
      <div className={styles.body}>
        <figure className={styles.chart}>
          <svg
            viewBox="0 0 42 42"
            className={styles.donut}
            role="img"
            aria-label={`${stats.accepted} of ${stats.rung} calls answered in the ${caption}`}
          >
            <circle cx="21" cy="21" r={RADIUS} className={styles.track} strokeWidth={STROKE} fill="none" />
            <DonutSlice
              start={0}
              size={acceptedPct}
              className={styles.sliceAccepted}
              dimmed={hovered === 'other'}
              onHover={(on) => setHovered(on ? 'accepted' : null)}
            />
            <DonutSlice
              start={acceptedPct}
              size={100 - acceptedPct}
              className={styles.sliceOther}
              dimmed={hovered === 'accepted'}
              onHover={(on) => setHovered(on ? 'other' : null)}
            />
          </svg>
          <figcaption className={styles.center}>
            <span className={styles.total}>{stats.rung}</span>
            <span className={styles.totalLabel}>{stats.rung === 1 ? 'call rang' : 'calls rang'}</span>
          </figcaption>
        </figure>

        <div className={styles.legend}>
          <dl className={styles.legendList}>
            <LegendRow
              swatch={styles.swatchAccepted}
              label="Answered by you"
              value={stats.accepted}
              pct={acceptedPct}
              active={hovered === 'accepted'}
            />
            <LegendRow
              swatch={styles.swatchOther}
              label="Not answered by you"
              value={notAnswered}
              pct={100 - acceptedPct}
              active={hovered === 'other'}
            />
          </dl>
          <p className={styles.note}>
            "Not answered by you" includes calls another responder took first and callers who hung up. Figures cover
            the {caption}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card title="Calls answered" action={filter} className={className}>
      {renderBody()}
    </Card>
  );
}

function DonutSlice({
  start,
  size,
  className,
  dimmed,
  onHover,
}: {
  start: number;
  size: number;
  className: string;
  dimmed: boolean;
  onHover: (on: boolean) => void;
}) {
  if (size <= 0) return null;
  // A lone full ring needs no gap; otherwise trim half a gap off each end.
  const full = size >= 100;
  const visible = full ? 100 : Math.max(size - GAP, 0.5);
  const offset = full ? 0 : start + GAP / 2;

  return (
    <circle
      cx="21"
      cy="21"
      r={RADIUS}
      fill="none"
      strokeWidth={STROKE}
      className={`${styles.slice} ${className} ${dimmed ? styles.dimmed : ''}`}
      strokeDasharray={`${visible} ${100 - visible}`}
      // Starts at 12 o'clock (25 = a quarter turn back), then runs clockwise.
      strokeDashoffset={25 - offset}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
    />
  );
}

function LegendRow({
  swatch,
  label,
  value,
  pct,
  active,
}: {
  swatch: string;
  label: string;
  value: number;
  pct: number;
  active: boolean;
}) {
  return (
    <div className={`${styles.legendRow} ${active ? styles.legendActive : ''}`}>
      <dt className={styles.legendLabel}>
        <span className={`${styles.swatch} ${swatch}`} aria-hidden="true" />
        {label}
      </dt>
      <dd className={styles.legendValue}>
        {value}
        <span className={styles.legendPct}>{Math.round(pct)}%</span>
      </dd>
    </div>
  );
}
