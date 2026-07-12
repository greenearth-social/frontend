import type { GeneratorView } from "./generator-view";
import type { ModelScoreView } from "./model-score-view";
import type { DiversificationView } from "./diversification-view";

export interface GeneratorSpec {
  name: string;
  weight: number;
}

export interface CandidatePost {
  atUri: string | null;
  content: string | null;
  score: number | null;
  authorDid: string | null;
  authorUsername: string | null;
  containsImages: boolean | null;
  containsVideo: boolean | null;
  imageCount: number | null;
  videoCount: number | null;
  externalUri: string | null;
  imageUrls: string[] | null;
  videoUrl: string | null;
  linkCard: {
    title: string;
    description: string;
    imageUrl: string;
  } | null;
}

export interface CandidateResult {
  generatorName: string;
  candidates: CandidatePost[];
}

export interface RankedCandidate {
  atUri: string;
  rank: number;
  rankScore: number | null;
}

export interface FeedDebugScoreEntry {
  atUri: string;
  score: number;
}

export interface FeedDebugModelScoreEntry {
  modelName: string;
  weight: number;
  scores: FeedDebugScoreEntry[];
}

export interface FeedDebugDiversificationEntry {
  atUri: string;
  relevance: number;
  score: number;
  authorPenalty?: number;
  contentPenalty?: number;
}

export interface FeedDebugDocument {
  requestId: string;
  userDid: string;
  username: string | null;
  feedName: string;
  generatedAt: string;
  generateRequest: {
    generators: GeneratorSpec[];
    userDid: string;
    numCandidates: number;
    videoOnly: boolean;
    excludeUris: string[];
    infill: string | null;
  };
  rankerModel: string | null;
  diversify: boolean;
  generatorOutputs: CandidateResult[];
  finalCandidates: CandidatePost[];
  ranking: {
    rankings: RankedCandidate[];
  } | null;
  modelScores: FeedDebugModelScoreEntry[];
  orderAfterRank: string[];
  finalOrder: string[];
  diversification: FeedDebugDiversificationEntry[];
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

export function atUriToBskyUrl(atUri: string): string | null {
  const match = atUri.match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/]+)$/);
  if (!match) return null;
  const did = match[1];
  const postId = match[2];
  if (!did || !postId) return null;
  return `https://bsky.app/profile/${did}/post/${postId}`;
}

export function mediaLabelsFor(
  candidate: CandidatePost,
): string[] {
  const labels: string[] = [];
  if (candidate.imageCount) {
    labels.push(`${String(candidate.imageCount)} image${candidate.imageCount !== 1 ? "s" : ""}`);
  } else if (candidate.containsImages) {
    labels.push("image");
  }
  if (candidate.videoCount) {
    labels.push(`${String(candidate.videoCount)} video${candidate.videoCount !== 1 ? "s" : ""}`);
  } else if (candidate.containsVideo) {
    labels.push("video");
  }
  if (candidate.externalUri) {
    labels.push("link");
  }
  return labels;
}

export function weightedRankScore(modelScores: ModelScoreView[]): number | null {
  const totalWeight = modelScores.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight <= 0) return null;
  return modelScores.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight;
}

export function scoreAxisPositionPct(score: number): number {
  return Math.min(100, Math.max(0, ((score + 1) / 2) * 100));
}

export function buildFeedItems(
  doc: FeedDebugDocument,
  hydrated?: Map<string, {
    text: string;
    authorHandle: string;
    displayName: string;
    avatarUrl: string | null;
    createdAt: string;
    replyCount: number;
    repostCount: number;
    likeCount: number;
    imageUrls: string[];
    videoUrl: string | null;
    linkCard: {
      title: string;
      description: string;
      imageUrl: string;
    } | null;
  }>,
): FeedItemView[] {
  const generatorsByUri = new Map<string, GeneratorView[]>();
  for (const result of doc.generatorOutputs) {
    for (const candidate of result.candidates) {
      if (!candidate.atUri) continue;
      const existing = generatorsByUri.get(candidate.atUri) ?? [];
      existing.push({ name: result.generatorName, score: candidate.score ?? null });
      generatorsByUri.set(candidate.atUri, existing);
    }
  }

  const rankByUri = new Map<string, { rank: number; rankScore: number | null }>();
  for (const ranking of doc.ranking?.rankings ?? []) {
    const r = ranking;
    rankByUri.set(r.atUri, { rank: r.rank, rankScore: r.rankScore ?? null });
  }

  const modelScoresByUri = new Map<string, ModelScoreView[]>();
  for (const entry of doc.modelScores) {
    for (const score of entry.scores) {
      const existing = modelScoresByUri.get(score.atUri) ?? [];
      existing.push({ name: entry.modelName, weight: entry.weight, score: score.score });
      modelScoresByUri.set(score.atUri, existing);
    }
  }

  const afterRankPos = new Map<string, number>();
  for (const [index, uri] of doc.orderAfterRank.entries()) {
    afterRankPos.set(uri, index + 1);
  }

  const divByUri = new Map<string, DiversificationView>();
  for (const entry of doc.diversification) {
    divByUri.set(entry.atUri, {
      relevance: entry.relevance,
      score: entry.score,
      authorPenalty: entry.authorPenalty ?? 0,
      contentPenalty: entry.contentPenalty ?? 0,
    });
  }

  const metadataByUri = new Map<string, CandidatePost>();
  for (const result of doc.generatorOutputs) {
    for (const candidate of result.candidates) {
      if (candidate.atUri) {
        if (!metadataByUri.has(candidate.atUri)) {
          metadataByUri.set(candidate.atUri, candidate);
        }
      }
    }
  }
  for (const candidate of doc.finalCandidates) {
    if (candidate.atUri) {
      metadataByUri.set(candidate.atUri, candidate);
    }
  }

  const items: FeedItemView[] = [];
  for (const [finalPosition, atUri] of doc.finalOrder.entries()) {
    const candidate = metadataByUri.get(atUri);
    const rankInfo = rankByUri.get(atUri);

    let author: string;
    let content: string;
    let mediaLabels: string[];
    let imageUrls: string[];
    let videoUrl: string | null;
    let linkCard: {
      title: string;
      description: string;
      imageUrl: string;
    } | null;

    const h = hydrated?.get(atUri);

    if (candidate) {
      const handle = candidate.authorUsername || candidate.authorDid;
      author = handle ? `@${handle}` : "unknown author";
      content = (candidate.content ?? "").replace(/\n/g, " ");
      mediaLabels = mediaLabelsFor(candidate);
      imageUrls = candidate.imageUrls ?? [];
      videoUrl = candidate.videoUrl ?? null;
      linkCard = candidate.linkCard ?? null;
    } else {
      author = h?.authorHandle ?? "unknown author";
      content = h?.text ?? "";
      mediaLabels = [];
      imageUrls = [];
      videoUrl = null;
      linkCard = null;
    }

    const displayName = h?.displayName ?? "";
    const avatarUrl = h?.avatarUrl ?? null;
    const createdAt = h?.createdAt ?? "";
    const replyCount = h?.replyCount ?? 0;
    const repostCount = h?.repostCount ?? 0;
    const likeCount = h?.likeCount ?? 0;

    items.push({
      atUri,
      postUrl: atUriToBskyUrl(atUri),
      finalPosition: finalPosition + 1,
      author,
      displayName,
      avatarUrl,
      createdAt,
      content,
      mediaLabels,
      imageUrls,
      videoUrl,
      linkCard,
      generators: generatorsByUri.get(atUri) ?? [],
      rankPosition: rankInfo?.rank ?? null,
      rankScore: rankInfo?.rankScore ?? null,
      afterRankPosition: afterRankPos.get(atUri) ?? null,
      modelScores: modelScoresByUri.get(atUri) ?? [],
      diversification: divByUri.get(atUri) ?? null,
      replyCount,
      repostCount,
      likeCount,
    });
  }

  return items;
}
