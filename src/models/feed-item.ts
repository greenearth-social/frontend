import type { GeneratorView } from "./generator-view";
import type { ModelScoreView } from "./model-score-view";
import type { DiversificationView } from "./diversification-view";

export interface FeedItem {
  atUri: string;
  postUrl: string | null;
  finalPosition: number;
  author: string;
  content: string;
  mediaLabels: string[];
  generators: GeneratorView[];
  rankPosition: number | null;
  rankScore: number | null;
  afterRankPosition: number | null;
  modelScores: ModelScoreView[];
  diversification: DiversificationView | null;
}
