import { onCLS, onINP, onLCP, type Metric } from "web-vitals";
import type { TelemetryConfig, TelemetryItem } from "./types";

const DEFAULT_ENDPOINT = "/api/telemetry";
const ERROR_DEDUP_INTERVAL_MS = 5000;

let currentEndpoint = DEFAULT_ENDPOINT;
let isInitialized = false;
let removeGlobalListeners: (() => void) | null = null;

const recentErrors = new Map<string, number>();

export function currentAppRoute(): string {
  if (typeof window === "undefined") return "/feed";
  return window.location.hash.slice(1).split("?")[0] || "/feed";
}

export function setTelemetryEndpoint(endpoint: string): void {
  currentEndpoint = endpoint;
}

export function getTelemetryEndpoint(): string {
  return currentEndpoint;
}

export function sendTelemetry(items: TelemetryItem | TelemetryItem[]): boolean {
  if (typeof window === "undefined" || !isInitialized) return false;

  const payload = Array.isArray(items) ? items : [items];
  if (payload.length === 0) return true;

  const serialized = JSON.stringify(payload);
  const endpoint = currentEndpoint;

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([serialized], { type: "application/json" });
      const queued = navigator.sendBeacon(endpoint, blob);
      if (queued) return true;
    }
  } catch {
    // If sendBeacon fails or throws, fallback to fetch
  }

  try {
    if (typeof fetch === "function") {
      void fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: serialized,
        keepalive: true,
      }).catch(() => {
        // Silently swallow errors to avoid recursive crash loops
      });
      return true;
    }
  } catch {
    // Best-effort delivery
  }

  return false;
}

export function reportMetric(metric: Metric): void {
  sendTelemetry({
    type: "vitals",
    name: metric.name,
    value: Math.round(metric.value * 10) / 10,
    extra: {
      app_route: currentAppRoute(),
      rating: metric.rating,
      id: metric.id,
      navigation_type: metric.navigationType,
    },
  });
}

export function reportClientError(
  name: string,
  extra: Record<string, unknown> = {},
): boolean {
  const message = typeof extra.message === "string" ? extra.message : "";
  const key = `${name}:${message}`;
  const now = Date.now();

  const lastSeen = recentErrors.get(key);
  if (lastSeen !== undefined && now - lastSeen < ERROR_DEDUP_INTERVAL_MS) {
    return false;
  }
  recentErrors.set(key, now);

  if (recentErrors.size > 100) {
    for (const [k, timestamp] of recentErrors.entries()) {
      if (now - timestamp > 60000) {
        recentErrors.delete(k);
      }
    }
  }

  return sendTelemetry({
    type: "error",
    name,
    extra: {
      app_route: currentAppRoute(),
      ...extra,
    },
  });
}

export function resetTelemetryForTest(): void {
  currentEndpoint = DEFAULT_ENDPOINT;
  isInitialized = false;
  recentErrors.clear();
  if (removeGlobalListeners) {
    removeGlobalListeners();
    removeGlobalListeners = null;
  }
}

export function setIsInitializedForTest(value: boolean): void {
  isInitialized = value;
}

export function initTelemetry(config: TelemetryConfig = {}): () => void {
  if (config.endpoint) {
    currentEndpoint = config.endpoint;
  } else if (config.apiBaseUrl) {
    currentEndpoint = `${config.apiBaseUrl.replace(/\/+$/, "")}/api/telemetry`;
  }

  if (config.enabled === false) {
    return () => {};
  }

  if (isInitialized) {
    return () => {};
  }
  isInitialized = true;

  if (typeof window !== "undefined") {
    try {
      onLCP(reportMetric);
      onINP(reportMetric);
      onCLS(reportMetric);
    } catch {
      // Browsers lacking PerformanceObserver APIs will safely no-op
    }

    const errorHandler = (event: ErrorEvent) => {
      const err = event.error instanceof Error ? event.error : null;
      const errorName = err?.name || "UnhandledError";
      reportClientError(errorName, {
        message: event.message || "Unknown error",
        stack: err?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const reason: unknown = event.reason;
      const err = reason instanceof Error ? reason : null;
      const errorName = err?.name || "UnhandledRejection";
      reportClientError(errorName, {
        message: err ? err.message : String(reason),
        stack: err?.stack,
      });
    };

    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", rejectionHandler);

    removeGlobalListeners = () => {
      window.removeEventListener("error", errorHandler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
    };
  }

  return () => {
    resetTelemetryForTest();
  };
}
