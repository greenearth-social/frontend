import { isAlgorithmId, type AlgorithmId } from "../constants/algorithms";

export type AppPage = "feed" | "settings" | "feedback";

export interface FeedScopedRoute {
  page: AppPage;
  feedName: AlgorithmId;
  path: string;
}

interface ParsedRoute {
  page: AppPage;
  feedName: AlgorithmId | null;
}

const APP_PAGE_SET = new Set<AppPage>(["feed", "settings", "feedback"]);

export function feedScopedPath(page: AppPage, feedName: AlgorithmId): string {
  return `/${page}/${feedName}`;
}

export function parseKnownRoute(path: string): ParsedRoute | null {
  if (path === "/controls" || path === "/how-it-works") {
    return { page: "settings", feedName: null };
  }

  const segments = path.split("/").filter(Boolean);
  const page = segments[0];
  if (!APP_PAGE_SET.has(page as AppPage)) return null;
  if (segments.length === 1) {
    return { page: page as AppPage, feedName: null };
  }
  if (segments.length !== 2) return null;

  return {
    page: page as AppPage,
    feedName: isAlgorithmId(segments[1]) ? segments[1] : "your-feed",
  };
}

export function resolveFeedScopedRoute(
  path: string,
  rememberedFeed: AlgorithmId | null,
): FeedScopedRoute | null {
  const parsed = parseKnownRoute(path);
  if (!parsed) return null;
  const feedName = parsed.feedName ?? rememberedFeed ?? "your-feed";
  return {
    page: parsed.page,
    feedName,
    path: feedScopedPath(parsed.page, feedName),
  };
}
