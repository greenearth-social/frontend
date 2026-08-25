import { makeAutoObservable } from "mobx";
import type { RootStore } from "./root-store";
import type { FeedPreferences, Preferences, SourceWeights } from "../services/types";
import { ALGORITHM_IDS, feedAnalyticsProperties, type AlgorithmId } from "../constants/algorithms";
import type { FeedControlEventProperties, FeedControlName } from "../services/analytics/types";
import { FRESHNESS_PRESETS } from "../constants/preferences";

export type SourceWeightChangeOrigin =
  | "following"
  | "network_likes"
  | "authors_topics"
  | "popular"
  | "source_mix_master"
  | "reset_defaults";

export const DEFAULT_SOURCE_WEIGHTS: SourceWeights = {
  following: 0.3,
  networkLikes: 0.2,
  authorsTopics: 0.25,
  popular: 0.25,
};

export const DEFAULT_PREFERENCES: Preferences = {
  sourceWeights: DEFAULT_SOURCE_WEIGHTS,
  freshness: 5,
  politics: 1.0,
  purpose: 0.5,
};

const CONTROL_PROPERTIES: Record<FeedControlName, keyof Preferences> = {
  source_weights: "sourceWeights",
  freshness: "freshness",
  politics: "politics",
  purpose: "purpose",
};

const PROPERTY_CONTROLS: Partial<Record<keyof Preferences, FeedControlName>> = {
  sourceWeights: "source_weights",
  freshness: "freshness",
  politics: "politics",
  purpose: "purpose",
};

const RESETTABLE_CONTROLS_BY_FEED: Record<AlgorithmId, FeedControlName[]> = {
  "your-feed": ["source_weights", "freshness", "purpose"],
  "best-of-friends": ["freshness", "purpose"],
  random: ["freshness"],
};

function clonePreferences(values: Preferences): Preferences {
  return {
    ...values,
    sourceWeights: { ...values.sourceWeights },
  };
}

function defaultValuesByFeed(): Record<AlgorithmId, Preferences> {
  return Object.fromEntries(
    ALGORITHM_IDS.map((feedName) => [feedName, clonePreferences(DEFAULT_PREFERENCES)]),
  ) as Record<AlgorithmId, Preferences>;
}

function emptyControlsByFeed(): Record<AlgorithmId, FeedControlName[]> {
  return {
    "your-feed": [],
    "best-of-friends": [],
    random: [],
  };
}

function sourceWeightsEqual(a: SourceWeights, b: SourceWeights): boolean {
  return (
    a.following === b.following &&
    a.networkLikes === b.networkLikes &&
    a.authorsTopics === b.authorsTopics &&
    a.popular === b.popular
  );
}

function controlChanged(
  control: FeedControlName,
  previous: Preferences,
  next: Preferences,
): boolean {
  if (control === "source_weights") {
    return !sourceWeightsEqual(previous.sourceWeights, next.sourceWeights);
  }
  return previous[CONTROL_PROPERTIES[control]] !== next[CONTROL_PROPERTIES[control]];
}

function numericEventProperties(
  control: Exclude<FeedControlName, "source_weights">,
  previousValues: Preferences,
  newValues: Preferences,
): FeedControlEventProperties {
  const property = CONTROL_PROPERTIES[control] as "freshness" | "politics" | "purpose";
  const previousValue = previousValues[property];
  const newValue = newValues[property];
  const base: FeedControlEventProperties = {
    control_name: control,
    previous_value: previousValue,
    new_value: newValue,
  };

  if (control === "freshness") {
    return {
      ...base,
      previous_label: FRESHNESS_PRESETS[previousValue]?.label ?? `Preset ${String(previousValue)}`,
      new_label: FRESHNESS_PRESETS[newValue]?.label ?? `Preset ${String(newValue)}`,
      previous_hours: FRESHNESS_PRESETS[previousValue]?.hours ?? 0,
      new_hours: FRESHNESS_PRESETS[newValue]?.hours ?? 0,
    };
  }
  if (control === "purpose") {
    return {
      ...base,
      previous_label: `E:${(1 - previousValue).toFixed(2)} C:${previousValue.toFixed(2)}`,
      new_label: `E:${(1 - newValue).toFixed(2)} C:${newValue.toFixed(2)}`,
      previous_engaging_weight: 1 - previousValue,
      new_engaging_weight: 1 - newValue,
      previous_constructive_weight: previousValue,
      new_constructive_weight: newValue,
    };
  }
  return {
    ...base,
    previous_label: previousValue.toFixed(2),
    new_label: newValue.toFixed(2),
  };
}

function controlEventProperties(
  control: FeedControlName,
  previousValues: Preferences,
  newValues: Preferences,
  origin?: SourceWeightChangeOrigin,
): FeedControlEventProperties {
  if (control !== "source_weights") {
    return numericEventProperties(control, previousValues, newValues);
  }
  return {
    control_name: control,
    ...(origin ? { change_origin: origin } : {}),
    previous_following_weight: previousValues.sourceWeights.following,
    new_following_weight: newValues.sourceWeights.following,
    previous_network_likes_weight: previousValues.sourceWeights.networkLikes,
    new_network_likes_weight: newValues.sourceWeights.networkLikes,
    previous_authors_topics_weight: previousValues.sourceWeights.authorsTopics,
    new_authors_topics_weight: newValues.sourceWeights.authorsTopics,
    previous_popular_weight: previousValues.sourceWeights.popular,
    new_popular_weight: newValues.sourceWeights.popular,
  };
}

export class PreferencesStore {
  root: RootStore;
  valuesByFeed = defaultValuesByFeed();
  controlsByFeed = emptyControlsByFeed();
  isLoading = false;
  hasLoaded = false;
  private saveSequence = 0;
  private saveVersions: Record<string, number> = {};
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
      let loadedSuccessfully = false;
      try {
        const loadedValues = await this.root.services.feedApiService.getPreferences();
        if (generation === this.accountGeneration) {
          for (const feedName of ALGORITHM_IDS) {
            const feedValues = loadedValues[feedName] ?? {};
            this.valuesByFeed[feedName] = {
              ...clonePreferences(DEFAULT_PREFERENCES),
              ...feedValues,
              sourceWeights: {
                ...DEFAULT_SOURCE_WEIGHTS,
                ...(feedValues.sourceWeights ?? {}),
              },
            };
            this.controlsByFeed[feedName] = Object.keys(feedValues)
              .map((property) => PROPERTY_CONTROLS[property as keyof Preferences])
              .filter((control): control is FeedControlName => control !== undefined);
          }
          loadedSuccessfully = true;
        }
      } catch (error) {
        console.error("Failed to load preferences:", error);
      } finally {
        if (generation === this.accountGeneration) {
          this.isLoading = false;
          // A failed request must remain retryable the next time Settings is
          // opened instead of permanently treating fallback defaults as saved.
          this.hasLoaded = loadedSuccessfully;
          this.loadPromise = null;
        }
      }
    })();
    this.loadPromise = promise;
    return promise;
  }

  reset(): void {
    this.accountGeneration++;
    this.saveSequence++;
    this.saveVersions = {};
    this.accountId = null;
    this.valuesByFeed = defaultValuesByFeed();
    this.controlsByFeed = emptyControlsByFeed();
    this.isLoading = false;
    this.hasLoaded = false;
    this.loadPromise = null;
  }

  async save(
    feedName: AlgorithmId,
    control: FeedControlName,
    value: number | SourceWeights,
    origin?: SourceWeightChangeOrigin,
  ): Promise<void> {
    const property = CONTROL_PROPERTIES[control];
    const previousValues = clonePreferences(this.valuesFor(feedName));
    const normalizedValue =
      control === "source_weights" ? { ...(value as SourceWeights) } : (value as number);
    const optimisticValues = {
      ...previousValues,
      [property]: normalizedValue,
    };
    const key = `${feedName}:${control}`;
    const version = ++this.saveSequence;
    this.saveVersions[key] = version;
    const generation = this.accountGeneration;
    this.valuesByFeed[feedName] = optimisticValues;

    try {
      const patch = { [property]: normalizedValue } as FeedPreferences;
      const savedValues = await this.root.services.feedApiService.patchPreferences(feedName, patch);
      if (generation === this.accountGeneration && version === this.saveVersions[key]) {
        const savedValue = savedValues[property] ?? normalizedValue;
        const currentValues = this.valuesFor(feedName);
        const finalValues = {
          ...currentValues,
          [property]:
            control === "source_weights" ? { ...(savedValue as SourceWeights) } : savedValue,
        };
        this.valuesByFeed[feedName] = finalValues;
        if (controlChanged(control, previousValues, finalValues)) {
          this.root.services.analyticsService.capture("feedControlChanged", {
            ...controlEventProperties(control, previousValues, finalValues, origin),
            ...feedAnalyticsProperties(feedName),
          });
        }
      }
    } catch (error) {
      if (generation === this.accountGeneration && version === this.saveVersions[key]) {
        const currentValues = clonePreferences(this.valuesFor(feedName));
        const previousValue = previousValues[property];
        this.valuesByFeed[feedName] = {
          ...currentValues,
          [property]:
            control === "source_weights" ? { ...(previousValue as SourceWeights) } : previousValue,
        };
        this.root.services.analyticsService.capture("feedControlChangeFailed", {
          ...controlEventProperties(control, previousValues, optimisticValues, origin),
          ...feedAnalyticsProperties(feedName),
          error_category: "preferences_request_failed",
        });
      }
      console.error("Failed to save preferences:", error);
    }
  }

  async savePatch(
    feedName: AlgorithmId,
    patch: FeedPreferences,
    origins: Partial<Record<FeedControlName, SourceWeightChangeOrigin>> = {},
  ): Promise<boolean> {
    const previousValues = clonePreferences(this.valuesFor(feedName));
    const optimisticValues = clonePreferences(previousValues);
    const changedControls = (Object.keys(patch) as Array<keyof Preferences>)
      .map((property) => PROPERTY_CONTROLS[property])
      .filter((control): control is FeedControlName => control !== undefined)
      .filter((control) =>
        controlChanged(control, previousValues, {
          ...optimisticValues,
          ...patch,
          sourceWeights: patch.sourceWeights
            ? { ...patch.sourceWeights }
            : optimisticValues.sourceWeights,
        }),
      );
    if (changedControls.length === 0) return true;

    for (const control of changedControls) {
      const property = CONTROL_PROPERTIES[control];
      const value = patch[property];
      if (value === undefined) continue;
      Object.assign(optimisticValues, {
        [property]: control === "source_weights" ? { ...(value as SourceWeights) } : value,
      });
    }

    const version = ++this.saveSequence;
    const generation = this.accountGeneration;
    for (const control of changedControls) {
      this.saveVersions[`${feedName}:${control}`] = version;
    }
    this.valuesByFeed[feedName] = optimisticValues;

    try {
      const saved = await this.root.services.feedApiService.patchPreferences(feedName, patch);
      if (generation !== this.accountGeneration) return false;
      const finalValues = clonePreferences(this.valuesFor(feedName));
      for (const control of changedControls) {
        if (this.saveVersions[`${feedName}:${control}`] !== version) continue;
        const property = CONTROL_PROPERTIES[control];
        const value = saved[property] ?? optimisticValues[property];
        Object.assign(finalValues, {
          [property]: control === "source_weights" ? { ...(value as SourceWeights) } : value,
        });
      }
      this.valuesByFeed[feedName] = finalValues;
      for (const control of changedControls) {
        if (this.saveVersions[`${feedName}:${control}`] !== version) continue;
        if (!controlChanged(control, previousValues, finalValues)) continue;
        this.root.services.analyticsService.capture("feedControlChanged", {
          ...controlEventProperties(control, previousValues, finalValues, origins[control]),
          ...feedAnalyticsProperties(feedName),
        });
      }
      return true;
    } catch (error) {
      if (generation === this.accountGeneration) {
        const currentValues = clonePreferences(this.valuesFor(feedName));
        for (const control of changedControls) {
          if (this.saveVersions[`${feedName}:${control}`] !== version) continue;
          const property = CONTROL_PROPERTIES[control];
          const previousValue = previousValues[property];
          Object.assign(currentValues, {
            [property]:
              control === "source_weights"
                ? { ...(previousValue as SourceWeights) }
                : previousValue,
          });
          this.root.services.analyticsService.capture("feedControlChangeFailed", {
            ...controlEventProperties(control, previousValues, optimisticValues, origins[control]),
            ...feedAnalyticsProperties(feedName),
            error_category: "preferences_request_failed",
          });
        }
        this.valuesByFeed[feedName] = currentValues;
      }
      console.error("Failed to save preferences:", error);
      return false;
    }
  }

  applyAcceptedPatch(
    feedName: AlgorithmId,
    patch: FeedPreferences,
    saved: FeedPreferences,
    origins: Partial<Record<FeedControlName, SourceWeightChangeOrigin>> = {},
  ): void {
    const previousValues = clonePreferences(this.valuesFor(feedName));
    const finalValues = clonePreferences(previousValues);
    const changedControls = (Object.keys(patch) as Array<keyof Preferences>)
      .map((property) => PROPERTY_CONTROLS[property])
      .filter((control): control is FeedControlName => control !== undefined)
      .filter((control) => {
        const property = CONTROL_PROPERTIES[control];
        const value = patch[property];
        if (value === undefined) return false;
        const candidate = clonePreferences(previousValues);
        Object.assign(candidate, {
          [property]: control === "source_weights" ? { ...(value as SourceWeights) } : value,
        });
        return controlChanged(control, previousValues, candidate);
      });

    for (const control of changedControls) {
      const property = CONTROL_PROPERTIES[control];
      const value = saved[property] ?? patch[property];
      if (value === undefined) continue;
      Object.assign(finalValues, {
        [property]: control === "source_weights" ? { ...(value as SourceWeights) } : value,
      });
    }
    this.valuesByFeed[feedName] = finalValues;

    for (const control of changedControls) {
      if (!controlChanged(control, previousValues, finalValues)) continue;
      this.root.services.analyticsService.capture("feedControlChanged", {
        ...controlEventProperties(control, previousValues, finalValues, origins[control]),
        ...feedAnalyticsProperties(feedName),
      });
    }
  }

  async restoreDefaults(feedName: AlgorithmId): Promise<boolean> {
    // Reset what the Settings page exposes, even if an older or partial load
    // did not populate the control metadata. This keeps Sources in
    // the same atomic reset as freshness and ranking.
    const controls = RESETTABLE_CONTROLS_BY_FEED[feedName];
    const previousValues = clonePreferences(this.valuesFor(feedName));
    const changedControls = controls.filter((control) =>
      controlChanged(control, previousValues, DEFAULT_PREFERENCES),
    );
    if (changedControls.length === 0) return true;

    const optimisticValues = clonePreferences(previousValues);
    const patch: FeedPreferences = {};
    const version = ++this.saveSequence;
    const generation = this.accountGeneration;

    for (const control of changedControls) {
      const property = CONTROL_PROPERTIES[control];
      const defaultValue = DEFAULT_PREFERENCES[property];
      const normalizedDefault =
        control === "source_weights"
          ? { ...(defaultValue as SourceWeights) }
          : (defaultValue as number);
      Object.assign(optimisticValues, { [property]: normalizedDefault });
      Object.assign(patch, { [property]: normalizedDefault });
      this.saveVersions[`${feedName}:${control}`] = version;
    }
    this.valuesByFeed[feedName] = optimisticValues;

    try {
      await this.root.services.feedApiService.patchPreferences(feedName, patch);
      if (generation !== this.accountGeneration) return false;

      const finalValues = clonePreferences(this.valuesFor(feedName));
      for (const control of changedControls) {
        const key = `${feedName}:${control}`;
        if (this.saveVersions[key] !== version) continue;
        const property = CONTROL_PROPERTIES[control];
        const defaultValue = DEFAULT_PREFERENCES[property];
        Object.assign(finalValues, {
          [property]:
            control === "source_weights" ? { ...(defaultValue as SourceWeights) } : defaultValue,
        });
        this.root.services.analyticsService.capture("feedControlChanged", {
          ...controlEventProperties(control, previousValues, finalValues, "reset_defaults"),
          ...feedAnalyticsProperties(feedName),
        });
      }
      this.valuesByFeed[feedName] = finalValues;
      return true;
    } catch (error) {
      if (generation === this.accountGeneration) {
        const rolledBackValues = clonePreferences(this.valuesFor(feedName));
        for (const control of changedControls) {
          const key = `${feedName}:${control}`;
          if (this.saveVersions[key] !== version) continue;
          const property = CONTROL_PROPERTIES[control];
          const previousValue = previousValues[property];
          Object.assign(rolledBackValues, {
            [property]:
              control === "source_weights"
                ? { ...(previousValue as SourceWeights) }
                : previousValue,
          });
          this.root.services.analyticsService.capture("feedControlChangeFailed", {
            ...controlEventProperties(control, previousValues, optimisticValues, "reset_defaults"),
            ...feedAnalyticsProperties(feedName),
            error_category: "preferences_request_failed",
          });
        }
        this.valuesByFeed[feedName] = rolledBackValues;
      }
      console.error("Failed to restore default preferences:", error);
      return false;
    }
  }

  valuesFor(feedName: AlgorithmId): Preferences {
    return this.valuesByFeed[feedName];
  }

  supportsControl(feedName: AlgorithmId, control: FeedControlName): boolean {
    return this.controlsByFeed[feedName].includes(control);
  }

  get values(): Preferences {
    return this.valuesFor("your-feed");
  }

  socialRadiusWeightsFor(feedName: AlgorithmId) {
    const weights = this.valuesFor(feedName).sourceWeights;
    return [
      { name: "followed_users", weight: weights.following },
      { name: "network_likes", weight: weights.networkLikes },
      { name: "two_tower", weight: weights.authorsTopics },
      { name: "popularity", weight: weights.popular },
    ];
  }

  get socialRadiusWeights() {
    return this.socialRadiusWeightsFor("your-feed");
  }

  freshnessLabelFor(feedName: AlgorithmId) {
    return FRESHNESS_PRESETS[this.valuesFor(feedName).freshness]?.label ?? "7d";
  }

  get freshnessLabel() {
    return this.freshnessLabelFor("your-feed");
  }

  engagingWeightFor(feedName: AlgorithmId) {
    return 1 - this.valuesFor(feedName).purpose;
  }

  get engagingWeight() {
    return this.engagingWeightFor("your-feed");
  }

  constructiveWeightFor(feedName: AlgorithmId) {
    return this.valuesFor(feedName).purpose;
  }

  get constructiveWeight() {
    return this.constructiveWeightFor("your-feed");
  }
}
