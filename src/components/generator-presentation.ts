export interface GeneratorPresentation {
  background: string;
  color: string;
  border: string;
  label: string;
}

// Badge colours from one theme colour (--theme-NAME in styles/index.css).
// `color` is the category's own colour, used for borders and tints; the
// badge itself is filled with it and lettered in the page background colour,
// so every badge reads the same way whatever hue it got.
function slot(name: string, label: string): GeneratorPresentation {
  const color = `var(--theme-${name})`;
  return {
    background: color,
    color,
    border: color,
    label,
  };
}

const NEUTRAL: GeneratorPresentation = slot("mute", "Other");

const AUTHOR_TOPIC: GeneratorPresentation = slot("cat-1", "Author/Topic");

const RANDOM: GeneratorPresentation = { ...NEUTRAL, label: "random" };

export const GENERATOR_PRESENTATIONS = {
  two_tower: AUTHOR_TOPIC,
  two_tower_empty_history: AUTHOR_TOPIC,
  followed_users: slot("cat-2", "Following"),
  popularity: slot("cat-4", "Popular"),
  post_similarity: slot("cat-5", "Similar"),
  network_likes: slot("cat-3", "Followed Likes"),
  llm_query_vector: slot("cat-6", "Prompt"),
  random_posts: RANDOM,
} satisfies Record<string, GeneratorPresentation>;

export const GENERATOR_LEGEND: readonly GeneratorPresentation[] = [
  AUTHOR_TOPIC,
  GENERATOR_PRESENTATIONS.followed_users,
  GENERATOR_PRESENTATIONS.network_likes,
  GENERATOR_PRESENTATIONS.popularity,
  GENERATOR_PRESENTATIONS.post_similarity,
  GENERATOR_PRESENTATIONS.llm_query_vector,
  { ...NEUTRAL, label: "Random" },
];

export function generatorPresentation(name: string | undefined): GeneratorPresentation {
  if (!name) return NEUTRAL;
  const presentations: Record<string, GeneratorPresentation> = GENERATOR_PRESENTATIONS;
  return presentations[name] ?? { ...NEUTRAL, label: name };
}
