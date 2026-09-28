// Shared by the call lists (StaffCalls, BranchCallRecords).

/** When a call rang, e.g. "28 Sept, 3:05 pm". */
export function formatRangAt(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Call length: "45s", "3m 07s" or "1h 02m". */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest}s`;
  if (minutes < 60) return `${minutes}m ${rest.toString().padStart(2, '0')}s`;
  return `${Math.floor(minutes / 60)}h ${(minutes % 60).toString().padStart(2, '0')}m`;
}
