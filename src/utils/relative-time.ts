export function relativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();

  if (Number.isNaN(then)) return "";

  const diffMs = now - then;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return `${String(diffSeconds)}s`;
  if (diffMinutes < 60) return `${String(diffMinutes)}m`;
  if (diffHours < 24) return `${String(diffHours)}h`;
  if (diffDays < 7) return `${String(diffDays)}d`;

  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
