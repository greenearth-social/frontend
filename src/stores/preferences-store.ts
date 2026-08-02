import { makeAutoObservable } from "mobx";
import type { RootStore } from "./root-store";
import type { Preferences } from "../services/types";
import type {
  FeedControlEventProperties,
  FeedControlName,
} from "../services/analytics/types";
import {
  SOCIAL_RADIUS_PRESETS,
  FRESHNESS_PRESETS,
} from "../constants/preferences";

const SOCIAL_RADIUS_LABELS = [
  "Friends",
  "Very close",
  "Closer",
  "Balanced",
  "Everyone",
];

function socialRadiusWeights(index: number): {
  friends: number;
  everyone: number;
} {
  const weights = SOCIAL_RADIUS_PRESETS[index]?.weights ?? [];
  const weight = (name: string) =>
    weights.find((generator) => generator.name === name)?.weight ?? 0;
  return {
    friends: weight("followed_users"),
    everyone: weight("two_tower") + weight("popularity"),
  };
}

function controlValue(values: Preferences, control: FeedControlName): number {
  switch (control) {
    case "social_radius":
      return values.socialRadius;
    case "freshness":
      return values.freshness;
    case "politics":
      return values.politics;
    case "purpose":
      return values.purpose;
  }
}

function controlLabel(control: FeedControlName, value: number): string {
  switch (control) {
    case "social_radius":
      return SOCIAL_RADIUS_LABELS[value] ?? `Preset ${String(value)}`;
    case "freshness":
      return FRESHNESS_PRESETS[value]?.label ?? `Preset ${String(value)}`;
    case "politics":
      return value.toFixed(2);
    case "purpose":
      return `E:${(1 - value).toFixed(2)} C:${value.toFixed(2)}`;
  }
}

function controlEventProperties(
  control: FeedControlName,
  previousValues: Preferences,
  newValues: Preferences,
): FeedControlEventProperties {
  const previousValue = controlValue(previousValues, control);
  const newValue = controlValue(newValues, control);
  const base: FeedControlEventProperties = {
    control_name: control,
    previous_value: previousValue,
    new_value: newValue,
    previous_label: controlLabel(control, previousValue),
    new_label: controlLabel(control, newValue),
  };

  if (control === "social_radius") {
    const previous = socialRadiusWeights(previousValue);
    const next = socialRadiusWeights(newValue);
    return {
      ...base,
      previous_friends_weight: previous.friends,
      new_friends_weight: next.friends,
      previous_everyone_weight: previous.everyone,
      new_everyone_weight: next.everyone,
    };
  }
  if (control === "freshness") {
    return {
      ...base,
      previous_hours: FRESHNESS_PRESETS[previousValue]?.hours ?? 0,
      new_hours: FRESHNESS_PRESETS[newValue]?.hours ?? 0,
    };
  }
  if (control === "purpose") {
    return {
      ...base,
      previous_engaging_weight: 1 - previousValue,
      new_engaging_weight: 1 - newValue,
      previous_constructive_weight: previousValue,
      new_constructive_weight: newValue,
    };
  }
  return base;
}

export class PreferencesStore {
  root: RootStore;
  values: Preferences = {
    socialRadius: 3,
    freshness: 5,
    politics: 1.0,
    purpose: 0.5,
  };
  isLoading = false;
  hasLoaded = false;
  private saveVersion = 0;
  private loadPromise: Promise<void> | null = null;
  private accountGeneration = 0;
  private accountId: string | null = null;

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable(this, { root: false });
  }

  activateAccount(accountId: string): void {
    if (this.accountId !== accountId) {
      this.reset();
      this.accountId = accountId;
    }
    void this.load();
  }

  async load(): Promise<void> {
    if (this.hasLoaded) return;
    if (this.loadPromise) return this.loadPromise;
    const generation = this.accountGeneration;
    this.isLoading = true;
    const promise = (async () => {
      try {
        const loadedValues = await this.root.services.feedApiService.getPreferences();
        if (generation === this.accountGeneration) {
          this.values = loadedValues;
        }
      } catch (e) {
        console.error("Failed to load preferences:", e);
      } finally {
        if (generation === this.accountGeneration) {
          this.isLoading = false;
          this.hasLoaded = true;
        }
        if (generation === this.accountGeneration) {
          this.loadPromise = null;
        }
      }
    })();
    this.loadPromise = promise;
    return promise;
  }

  reset(): void {
    this.accountGeneration++;
    this.saveVersion++;
    this.accountId = null;
    this.values = {
      socialRadius: 3,
      freshness: 5,
      politics: 1.0,
      purpose: 0.5,
    };
    this.isLoading = false;
    this.hasLoaded = false;
    this.loadPromise = null;
  }

  async save(values: Preferences, control: FeedControlName): Promise<void> {
    const previousValues = this.values;
    const version = ++this.saveVersion;
    const generation = this.accountGeneration;
    this.values = values;
    try {
      const savedValues = await this.root.services.feedApiService.putPreferences(values);
      if (generation === this.accountGeneration && version === this.saveVersion) {
        this.values = savedValues;
        if (controlValue(previousValues, control) !== controlValue(savedValues, control)) {
          this.root.services.analyticsService.capture(
            "feedControlChanged",
            controlEventProperties(control, previousValues, savedValues),
          );
        }
      }
    } catch (e) {
      if (generation === this.accountGeneration && version === this.saveVersion) {
        this.values = previousValues;
        this.root.services.analyticsService.capture("feedControlChangeFailed", {
          ...controlEventProperties(control, previousValues, values),
          error_category: "preferences_request_failed",
        });
      }
      console.error("Failed to save preferences:", e);
    }
  }

  get socialRadiusWeights() {
    return SOCIAL_RADIUS_PRESETS[this.values.socialRadius]?.weights ?? [];
  }

  get freshnessLabel() {
    return FRESHNESS_PRESETS[this.values.freshness]?.label ?? "7d";
  }

  get engagingWeight() {
    return 1 - this.values.purpose;
  }

  get constructiveWeight() {
    return this.values.purpose;
  }
}
