export function relativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();

  if (Number.isNaN(then)) return "";

  const diffMs = now - then;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return `${String(diffSeconds)} sec ago`;
  if (diffMinutes < 60) return `${String(diffMinutes)} min ago`;
  if (diffHours < 24) return `${String(diffHours)} hr ago`;
  if (diffDays < 7) return `${String(diffDays)} days ago`;

  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function compactRelativeTime(isoString: string): string {
  const then = new Date(isoString).getTime();
  if (Number.isNaN(then)) return "";

  const diffSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSeconds < 60) return "now";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${String(diffMinutes)}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${String(diffHours)}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${String(diffDays)}d`;

  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
