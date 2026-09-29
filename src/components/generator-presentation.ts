export interface GeneratorPresentation {
  background: string;
  color: string;
  border: string;
  label: string;
}

// Badge colours from one terminal palette slot (--term-N in styles/index.css).
function slot(n: number, label: string): GeneratorPresentation {
  const color = `var(--term-${String(n)})`;
  return {
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    color,
    border: `color-mix(in srgb, ${color} 80%, transparent)`,
    label,
  };
}

const NEUTRAL: GeneratorPresentation = slot(8, "Other");

const AUTHOR_TOPIC: GeneratorPresentation = slot(14, "Author/Topic");

const RANDOM: GeneratorPresentation = { ...NEUTRAL, label: "random" };

export const GENERATOR_PRESENTATIONS = {
  two_tower: AUTHOR_TOPIC,
  two_tower_empty_history: AUTHOR_TOPIC,
  followed_users: slot(1, "Following"),
  popularity: slot(6, "Popular"),
  post_similarity: slot(10, "Similar"),
  network_likes: slot(3, "Followed Likes"),
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
