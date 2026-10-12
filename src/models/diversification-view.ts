export interface DiversificationView {
  relevance: number;
  score: number;
  authorPenalty: number;
  contentPenalty: number;
  authorPenaltySetting?: number;
  topicPenaltySetting?: number;
  relevanceWeight?: number;
  authorPenaltyWeight?: number;
  topicPenaltyWeight?: number;
}
