export interface GeneratorPresentation {
  background: string;
  color: string;
  border: string;
  label: string;
}

const NEUTRAL: GeneratorPresentation = {
  background: "rgba(113, 118, 123, 0.15)",
  color: "#71767b",
  border: "rgba(113, 118, 123, 0.7)",
  label: "Other",
};

const AUTHOR_TOPIC: GeneratorPresentation = {
  background: "rgba(56, 189, 248, 0.12)",
  color: "#38bdf8",
  border: "rgba(56, 189, 248, 0.8)",
  label: "Author/Topic",
};

const RANDOM: GeneratorPresentation = { ...NEUTRAL, label: "random" };

export const GENERATOR_PRESENTATIONS = {
  two_tower: AUTHOR_TOPIC,
  two_tower_empty_history: AUTHOR_TOPIC,
  followed_users: {
    background: "rgba(52, 211, 153, 0.12)",
    color: "#34d399",
    border: "rgba(52, 211, 153, 0.8)",
    label: "Followed",
  },
  popularity: {
    background: "rgba(244, 114, 182, 0.12)",
    color: "#f472b6",
    border: "rgba(244, 114, 182, 0.8)",
    label: "Popular",
  },
  post_similarity: {
    background: "rgba(192, 132, 252, 0.12)",
    color: "#c084fc",
    border: "rgba(192, 132, 252, 0.8)",
    label: "Similar",
  },
  network_likes: {
    background: "rgba(249, 24, 128, 0.12)",
    color: "#f91880",
    border: "rgba(249, 24, 128, 0.8)",
    label: "Followed Likes",
  },
  random_posts: RANDOM,
} satisfies Record<string, GeneratorPresentation>;

export const GENERATOR_LEGEND: readonly GeneratorPresentation[] = [
  AUTHOR_TOPIC,
  GENERATOR_PRESENTATIONS.followed_users,
  GENERATOR_PRESENTATIONS.network_likes,
  GENERATOR_PRESENTATIONS.popularity,
  GENERATOR_PRESENTATIONS.post_similarity,
  { ...NEUTRAL, label: "Random" },
];

export function generatorPresentation(name: string | undefined): GeneratorPresentation {
  if (!name) return NEUTRAL;
  const presentations: Record<string, GeneratorPresentation> = GENERATOR_PRESENTATIONS;
  return presentations[name] ?? { ...NEUTRAL, label: name };
}
