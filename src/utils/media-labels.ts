import type { FeedItemView } from "../models/feed-debug-snapshot";

const COUNTED_MEDIA_LABEL = /^(?:(\d+)\s+)?(images?|videos?|links?)$/i;

type MediaLabelItem = Pick<
  FeedItemView,
  "mediaLabels" | "imageUrls" | "videoUrl" | "linkCard"
>;

export function countedMediaLabels(item: MediaLabelItem): string[] {
  const bareCounts = new Map<string, number>();
  for (const label of item.mediaLabels) {
    const match = COUNTED_MEDIA_LABEL.exec(label.trim());
    if (!match?.[2] || match[1]) continue;
    const singular = match[2].toLowerCase().replace(/s$/, "");
    bareCounts.set(singular, (bareCounts.get(singular) ?? 0) + 1);
  }

  const emittedBareLabels = new Set<string>();
  return item.mediaLabels.flatMap((label) => {
    const match = COUNTED_MEDIA_LABEL.exec(label.trim());
    if (!match?.[2]) return [label];

    const singular = match[2].toLowerCase().replace(/s$/, "");
    const explicitCount = match[1] ? Number.parseInt(match[1], 10) : null;
    if (explicitCount === null && emittedBareLabels.has(singular)) return [];

    const repeatedLabelCount = bareCounts.get(singular) ?? 0;
    const itemCount =
      singular === "image"
        ? item.imageUrls.length
        : singular === "video"
          ? item.videoUrl
            ? 1
            : 0
          : item.linkCard
            ? 1
            : 0;
    const count = explicitCount ?? (repeatedLabelCount > 1 ? repeatedLabelCount : itemCount);
    if (explicitCount === null) emittedBareLabels.add(singular);
    if (count <= 0) return [];

    return [`${String(count)} ${singular}${count === 1 ? "" : "s"}`];
  });
}
