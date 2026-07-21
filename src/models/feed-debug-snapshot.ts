import type { GeneratorView } from "./generator-view";
import type { ModelScoreView } from "./model-score-view";
import type { DiversificationView } from "./diversification-view";

export interface FeedSummary {
  requestId: string;
  generatedAt: string;
  feedName: string;
  appliedSocialRadius: number | null;
  generatorDiagnostics: GeneratorDiagnostic[];
}

export interface GeneratorDiagnostic {
  name: string;
  weight: number;
  requestedCount: number;
  returnedCount: number;
  contributedCount: number;
  status: string;
  reason: string | null;
  mode: string;
}

export interface FeedListResponse {
  feeds: FeedSummary[] | null | undefined;
}

export interface ApiAuthorView {
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ApiMediaView {
  imageUrls: string[];
  videoUrl: string | null;
  linkCardUrl: string | null;
  linkCardTitle: string | null;
  linkCardDescription: string | null;
  labels: string[];
}

export interface ApiEngagementView {
  replyCount: number;
  repostCount: number;
  likeCount: number;
}

export interface ApiFeedItem {
  atUri: string;
  rank: number | null;
  rankScore: number | null;
  afterRankPosition: number | null;
  author: ApiAuthorView;
  createdAt: string | null;
  content: string | null;
  generators: GeneratorView[];
  modelScores: ModelScoreView[];
  diversification: DiversificationView | null;
  media: ApiMediaView | null;
  engagement: ApiEngagementView | null;
  postUrl: string | null;
}

export interface FeedDetailResponse {
  requestId: string;
  generatedAt: string;
  items: ApiFeedItem[] | null | undefined;
  filteringCounts: FilteringCounts;
}

export interface FilteringCounts {
  storedItemCount: number;
  displayedItemCount: number;
  publiclyFilteredCount: number;
  unavailableCount: number;
}

export interface FeedItemView {
  atUri: string;
  postUrl: string | null;
  finalPosition: number;
  author: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  content: string;
  mediaLabels: string[];
  imageUrls: string[];
  videoUrl: string | null;
  linkCard: {
    title: string;
    description: string;
    imageUrl: string;
  } | null;
  generators: GeneratorView[];
  rankPosition: number | null;
  rankScore: number | null;
  afterRankPosition: number | null;
  modelScores: ModelScoreView[];
  diversification: DiversificationView | null;
  replyCount: number;
  repostCount: number;
  likeCount: number;
}

export function weightedRankScore(modelScores: ModelScoreView[]): number | null {
  const totalWeight = modelScores.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight <= 0) return null;
  return modelScores.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight;
}

export function scoreAxisPositionPct(score: number): number {
  return Math.min(100, Math.max(0, ((score + 1) / 2) * 100));
}

export function transformFeedItems(apiItems: ApiFeedItem[] | null | undefined): FeedItemView[] {
  return (apiItems ?? []).map((item, index) => ({
    atUri: item.atUri,
    postUrl: item.postUrl,
    finalPosition: index + 1,
    author: item.author.handle ? `@${item.author.handle}` : "unknown author",
    displayName: item.author.displayName ?? "",
    avatarUrl: item.author.avatarUrl ?? null,
    createdAt: item.createdAt ?? "",
    content: item.content ?? "",
    mediaLabels: item.media?.labels ?? [],
    imageUrls: item.media?.imageUrls ?? [],
    videoUrl: item.media?.videoUrl ?? null,
    linkCard: item.media?.linkCardUrl
      ? {
          title: item.media.linkCardTitle ?? "",
          description: item.media.linkCardDescription ?? "",
          imageUrl: "",
        }
      : null,
    generators: item.generators,
    rankPosition: item.rank ?? null,
    rankScore: item.rankScore ?? null,
    afterRankPosition: item.afterRankPosition ?? null,
    modelScores: item.modelScores,
    diversification: item.diversification,
    replyCount: item.engagement?.replyCount ?? 0,
    repostCount: item.engagement?.repostCount ?? 0,
    likeCount: item.engagement?.likeCount ?? 0,
  }));
}
