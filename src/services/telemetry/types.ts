export type TelemetryType = "vitals" | "error";

export interface TelemetryItem {
  type: TelemetryType;
  name: string;
  value?: number;
  extra?: Record<string, unknown>;
}

export interface TelemetryConfig {
  endpoint?: string;
  apiBaseUrl?: string;
  enabled?: boolean;
}
