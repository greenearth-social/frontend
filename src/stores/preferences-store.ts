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
    const generation = this.accountGeneration;
    this.values = values;
    try {
      const savedValues = await this.root.services.feedApiService.putPreferences(values);
      if (generation === this.accountGeneration && version === this.saveVersion) {
        this.values = savedValues;
      }
    } catch (e) {
      if (generation === this.accountGeneration && version === this.saveVersion) {
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
