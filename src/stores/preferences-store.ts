import { makeAutoObservable } from "mobx";
import type { RootStore } from "./root-store";
import type { Preferences } from "../services/types";
import { SOCIAL_RADIUS_PRESETS, FRESHNESS_PRESETS } from "../constants/preferences";

export class PreferencesStore {
  root: RootStore;
  values: Preferences = {
    socialRadius: 3,
    freshness: 2,
    politics: 1.0,
    purpose: 0.5,
  };
  isLoading = false;
  hasLoaded = false;
  private saveVersion = 0;
  private loadPromise: Promise<void> | null = null;

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable(this, { root: false });
  }

  async load(): Promise<void> {
    if (this.hasLoaded) return;
    if (this.loadPromise) return this.loadPromise;
    this.isLoading = true;
    this.loadPromise = (async () => {
      try {
        this.values = await this.root.services.feedApiService.getPreferences();
      } catch (e) {
        console.error("Failed to load preferences:", e);
      } finally {
        this.isLoading = false;
        this.hasLoaded = true;
        this.loadPromise = null;
      }
    })();
    return this.loadPromise;
  }

  reset(): void {
    this.values = {
      socialRadius: 3,
      freshness: 2,
      politics: 1.0,
      purpose: 0.5,
    };
    this.isLoading = false;
    this.hasLoaded = false;
    this.loadPromise = null;
  }

  async save(values: Preferences): Promise<void> {
    const previousValues = this.values;
    const version = ++this.saveVersion;
    this.values = values;
    try {
      const savedValues = await this.root.services.feedApiService.putPreferences(values);
      if (version === this.saveVersion) {
        this.values = savedValues;
      }
    } catch (e) {
      if (version === this.saveVersion) {
        this.values = previousValues;
      }
      console.error("Failed to save preferences:", e);
    }
  }

  get socialRadiusWeights() {
    return SOCIAL_RADIUS_PRESETS[this.values.socialRadius]?.weights ?? [];
  }

  get freshnessLabel() {
    return FRESHNESS_PRESETS[this.values.freshness]?.label ?? "24h";
  }

  get engagingWeight() {
    return 1 - this.values.purpose;
  }

  get constructiveWeight() {
    return this.values.purpose;
  }
}
