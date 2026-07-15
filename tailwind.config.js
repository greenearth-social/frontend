/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.ts"],
  theme: {
    extend: {
      colors: {
        bluesky: {
          bg: "#15202b",
          "bg-card": "#1e2732",
          "bg-hover": "#1c2b3b",
          border: "#2f3336",
          text: "#e7e9ea",
          "text-secondary": "#71767b",
          brand: "#1083fe",
          "brand-hover": "#1a8dfe",
          danger: "#f4212e",
          like: "#f91880",
          repost: "#00ba7c",
          nav: "#0f1923",
        },
        generator: {
          two_tower: "#22c55e",
          followed_users: "#3b82f6",
          popularity: "#f59e0b",
          post_similarity: "#8b5cf6",
          network_likes: "#06b6d4",
          random_posts: "#64748b",
        },
        model: {
          two_tower: "#22c55e",
          perspective: "#8b5cf6",
        },
      },
    },
  },
  plugins: [],
};
