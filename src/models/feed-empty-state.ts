import type { FilteringCounts, GeneratorDiagnostic } from "./feed-debug-snapshot";

function generatorLabel(name: string): string {
  switch (name) {
    case "followed_users":
      return "Following";
    case "network_likes":
      return "Liked by Following";
    case "two_tower":
      return "Authors & Topics";
    case "popularity":
      return "Popular";
    default:
      return name.split("_").join(" ");
  }
}

function diagnosticExplanation(diagnostic: GeneratorDiagnostic): string {
  const source = generatorLabel(diagnostic.name);
  switch (diagnostic.reason) {
    case "no_followed_users":
      return `${source} found no followed accounts.`;
    case "no_recent_followed_posts":
      return `${source} found no recent followed posts in the indexed time window.`;
    case "no_recent_network_likes":
      return `${source} found no recent likes by followed accounts in the indexed time window.`;
    case "liked_posts_unavailable":
      return `${source} found likes, but their posts were missing from the indexed posts corpus.`;
    case "history_exclusions":
      return `${source} only found posts already excluded by feed history.`;
    case "missing_candidate_embeddings":
      return `${source} found posts, but none had the embeddings required for ranking.`;
    case "ranking_removed_all":
      return `${source} found posts, but ranking removed all of them.`;
    case "quality_filters_removed_all":
      return `${source} found posts, but quality filters removed all of them.`;
    case "hydration_removed_all":
      return `${source} ranked posts, but Bluesky could not load any of them for display.`;
    case "pipeline_removed_all":
      return `${source} found posts, but the feed pipeline removed all of them.`;
    case "generator_timeout":
    case "generator_error":
    case "follow_lookup_failed":
      return `${source} could not be loaded for this refresh.`;
    default:
      return `${source} returned no candidates for this refresh.`;
  }
}

export function emptySnapshotExplanation(
  counts: FilteringCounts | null,
  diagnostics: GeneratorDiagnostic[],
): string {
  if (counts && counts.storedItemCount > 0 && counts.displayedItemCount === 0) {
    const removals: string[] = [];
    if (counts.publiclyFilteredCount > 0) {
      removals.push(
        `${String(counts.publiclyFilteredCount)} ${counts.publiclyFilteredCount === 1 ? "was" : "were"} filtered`,
      );
    }
    if (counts.unavailableCount > 0) {
      removals.push(
        `${String(counts.unavailableCount)} ${counts.unavailableCount === 1 ? "was" : "were"} unavailable`,
      );
    }
    const reason = removals.length > 0 ? `: ${removals.join(" and ")}` : "";
    return `This refresh ranked ${String(counts.storedItemCount)} ${counts.storedItemCount === 1 ? "post" : "posts"}, but none could be displayed${reason}.`;
  }

  const active = diagnostics.filter((diagnostic) => diagnostic.weight > 0);
  const downstreamRemovalReasons = new Set([
    "missing_candidate_embeddings",
    "ranking_removed_all",
    "quality_filters_removed_all",
    "hydration_removed_all",
    "pipeline_removed_all",
  ]);
  const downstreamExplanations = [
    ...new Set(
      active
        .filter((diagnostic) => downstreamRemovalReasons.has(diagnostic.reason ?? ""))
        .map(diagnosticExplanation),
    ),
  ];
  if (downstreamExplanations.length > 0) return downstreamExplanations.join(" ");

  const returnedCount = active.reduce((total, diagnostic) => total + diagnostic.returnedCount, 0);
  if (returnedCount > 0) {
    return "This refresh found candidate posts, but none passed embedding, ranking, or quality filters.";
  }

  const explanations = [...new Set(active.map(diagnosticExplanation))];
  if (explanations.length > 0) return explanations.join(" ");
  return "This refresh completed and returned zero ranked posts.";
}
