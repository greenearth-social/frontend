import type {
  FeedDebugDocument,
  CandidateResult,
  CandidatePost,
  RankedCandidate,
  FeedDebugModelScoreEntry,
  FeedDebugScoreEntry,
  FeedDebugDiversificationEntry,
  GeneratorSpec,
} from "./feed-debug-snapshot";

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asNumber(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

function asNumberOrNull(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}

function asBoolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function asStringOrNull(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((e): e is string => typeof e === "string") : [];
}

function mapGeneratorSpec(raw: Record<string, unknown>): GeneratorSpec {
  return {
    name: asString(raw.name),
    weight: asNumber(raw.weight),
  };
}

function mapCandidatePost(raw: Record<string, unknown>): CandidatePost {
  return {
    atUri: asStringOrNull(raw.at_uri),
    content: asStringOrNull(raw.content),
    score: asNumberOrNull(raw.score),
    authorDid: asStringOrNull(raw.author_did),
    authorUsername: asStringOrNull(raw.author_username),
    containsImages: asBoolOrNull(raw.contains_images),
    containsVideo: asBoolOrNull(raw.contains_video),
    imageCount: asNumberOrNull(raw.image_count),
    videoCount: asNumberOrNull(raw.video_count),
    externalUri: asStringOrNull(raw.external_uri),
    imageUrls: asStringArray(raw.image_urls),
    videoUrl: asStringOrNull(raw.video_url),
    linkCard: mapLinkCard(raw.link_card),
  };
}

function mapLinkCard(raw: unknown): CandidatePost["linkCard"] {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    return {
      title: asString(r.title),
      description: asString(r.description),
      imageUrl: asString(r.image_url),
    };
  }
  return null;
}

function mapCandidateResult(raw: Record<string, unknown>): CandidateResult {
  return {
    generatorName: asString(raw.generator_name),
    candidates:
      Array.isArray(raw.candidates)
        ? (raw.candidates as Record<string, unknown>[]).map(mapCandidatePost)
        : [],
  };
}

function mapRankedCandidate(raw: Record<string, unknown>): RankedCandidate {
  return {
    atUri: asString(raw.at_uri),
    rank: asNumber(raw.rank),
    rankScore: asNumberOrNull(raw.rank_score),
  };
}

function mapFeedDebugScoreEntry(raw: Record<string, unknown>): FeedDebugScoreEntry {
  return {
    atUri: asString(raw.at_uri),
    score: asNumber(raw.score),
  };
}

function mapFeedDebugModelScoreEntry(
  raw: Record<string, unknown>,
): FeedDebugModelScoreEntry {
  return {
    modelName: asString(raw.model_name),
    weight: asNumber(raw.weight),
    scores:
      Array.isArray(raw.scores)
        ? (raw.scores as Record<string, unknown>[]).map(mapFeedDebugScoreEntry)
        : [],
  };
}

function mapFeedDebugDiversificationEntry(
  raw: Record<string, unknown>,
): FeedDebugDiversificationEntry {
  return {
    atUri: asString(raw.at_uri),
    relevance: asNumber(raw.relevance),
    score: asNumber(raw.score),
    authorPenalty:
      raw.author_penalty !== undefined ? asNumber(raw.author_penalty) : undefined,
    contentPenalty:
      raw.content_penalty !== undefined ? asNumber(raw.content_penalty) : undefined,
  };
}

function mapGenerateRequest(
  raw: Record<string, unknown>,
): FeedDebugDocument["generateRequest"] {
  return {
    generators:
      Array.isArray(raw.generators)
        ? (raw.generators as Record<string, unknown>[]).map(mapGeneratorSpec)
        : [],
    userDid: asString(raw.user_did),
    numCandidates: asNumber(raw.num_candidates),
    videoOnly: Boolean(raw.video_only),
    excludeUris: asStringArray(raw.exclude_uris),
    infill: asStringOrNull(raw.infill),
  };
}

/**
 * Map a raw Firestore document (snake_case) to the TypeScript FeedDebugDocument
 * interface (camelCase). Every field is explicitly mapped — if the Python
 * backend adds a new field, the compiler will flag the mismatch here.
 */
export function mapFeedDebugDocument(
  raw: Record<string, unknown>,
): FeedDebugDocument {
  return {
    requestId: asString(raw.request_id),
    userDid: asString(raw.user_did),
    username: asStringOrNull(raw.username),
    feedName: asString(raw.feed_name),
    generatedAt: asString(raw.generated_at),
    generateRequest:
      raw.generate_request && typeof raw.generate_request === "object"
        ? mapGenerateRequest(raw.generate_request as Record<string, unknown>)
        : {
            generators: [],
            userDid: "",
            numCandidates: 0,
            videoOnly: false,
            excludeUris: [],
            infill: null,
          },
    rankerModel: asStringOrNull(raw.ranker_model),
    diversify: Boolean(raw.diversify),
    generatorOutputs:
      Array.isArray(raw.generator_outputs)
        ? (raw.generator_outputs as Record<string, unknown>[]).map(
            mapCandidateResult,
          )
        : [],
    finalCandidates:
      Array.isArray(raw.final_candidates)
        ? (raw.final_candidates as Record<string, unknown>[]).map(
            mapCandidatePost,
          )
        : [],
    ranking:
      raw.ranking && typeof raw.ranking === "object"
        ? {
            rankings:
              Array.isArray((raw.ranking as Record<string, unknown>).rankings)
                ? (
                    (raw.ranking as Record<string, unknown>)
                      .rankings as Record<string, unknown>[]
                  ).map(mapRankedCandidate)
                : [],
          }
        : null,
    modelScores:
      Array.isArray(raw.model_scores)
        ? (raw.model_scores as Record<string, unknown>[]).map(
            mapFeedDebugModelScoreEntry,
          )
        : [],
    orderAfterRank: asStringArray(raw.order_after_rank),
    finalOrder: asStringArray(raw.final_order),
    diversification:
      Array.isArray(raw.diversification)
        ? (raw.diversification as Record<string, unknown>[]).map(
            mapFeedDebugDiversificationEntry,
          )
        : [],
  };
}
