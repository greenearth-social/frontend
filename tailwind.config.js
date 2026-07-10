/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.ts"],
  theme: {
    extend: {
      colors: {
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
