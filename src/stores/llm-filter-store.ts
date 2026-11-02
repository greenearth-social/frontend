import { makeAutoObservable, runInAction } from "mobx";
import type { RootStore } from "./root-store";
import type { LlmPrompt } from "../services/types";
import { FeedApiError } from "../services/types";
import { feedAnalyticsProperties } from "../constants/algorithms";
import { describeLlmPromptError, type LlmPromptFailure } from "../utils/llm-prompt-error";
import { LLM_PROMPT_FEED } from "./preferences-store";

// The Filter prompt (api#566), fitted, read and removed under role=filter.
// No source weight, so nothing here touches preferences. A store, not card
// state, so a running fit survives the settings page being closed.
export class LlmFilterStore {
  root: RootStore;
  prompt: LlmPrompt | null = null;
  isFitting = false;
  isRemoving = false;
  failure: LlmPromptFailure | null = null;
  private accountId: string | null = null;
  private generation = 0;
  private statusRequest = 0;

  constructor(root: RootStore) {
    this.root = root;
    makeAutoObservable(this, { root: false });
  }

  get fitted(): boolean {
    return this.prompt !== null;
  }

  // Called by the preferences store once the llm-cg gate is open for this account.
  async load(accountId: string | null): Promise<void> {
    if (accountId !== this.accountId) {
      this.reset();
      this.accountId = accountId;
    }
    const generation = this.generation;
    const request = ++this.statusRequest;
    const status = await this.root.services.feedApiService
      .getLlmPrompt("filter")
      .catch((error: unknown) => {
        console.warn("Filter prompt status unavailable; showing no filter prompt", error);
        return { enabled: false } as const;
      });
    if (generation !== this.generation || request !== this.statusRequest) return;
    runInAction(() => {
      this.prompt = status.enabled ? status.prompt : null;
    });
  }

  reset(): void {
    this.generation++;
    this.accountId = null;
    this.prompt = null;
    this.isFitting = false;
    this.isRemoving = false;
    this.failure = null;
  }

  // Null when the account changed while the fit ran.
  async fit(text: string): Promise<LlmPrompt | null> {
    if (this.isFitting || this.isRemoving) return null;
    const generation = this.generation;
    this.isFitting = true;
    this.failure = null;
    try {
      const fitted = await this.root.services.feedApiService.fitLlmPrompt(text, "filter");
      if (generation !== this.generation) return null;
      runInAction(() => {
        this.statusRequest++;
        this.prompt = fitted;
      });
      this.root.services.analyticsService.capture("promptFitted", {
        ...feedAnalyticsProperties(LLM_PROMPT_FEED),
        prompt_role: "filter",
      });
      return fitted;
    } catch (error) {
      if (generation !== this.generation) return null;
      await this.fail(error, generation, "Filter prompt generation failed");
      throw error;
    } finally {
      if (generation === this.generation) {
        runInAction(() => {
          this.isFitting = false;
        });
      }
    }
  }

  async remove(promptKey: string): Promise<boolean> {
    if (this.isFitting || this.isRemoving) return false;
    const generation = this.generation;
    this.isRemoving = true;
    this.failure = null;
    try {
      await this.root.services.feedApiService.removeLlmPrompt(promptKey, "filter");
      if (generation !== this.generation) return false;
      runInAction(() => {
        this.statusRequest++;
        this.prompt = null;
      });
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      await this.fail(error, generation, "Filter prompt removal failed", {
        category: "system",
        message: "We couldn’t remove your filter prompt. Please try again.",
      });
      return false;
    } finally {
      if (generation === this.generation) {
        runInAction(() => {
          this.isRemoving = false;
        });
      }
    }
  }

  // After a conflict, re-read what the other session left.
  private async fail(
    error: unknown,
    generation: number,
    logMessage: string,
    fallback?: LlmPromptFailure,
  ): Promise<void> {
    const failure = describeLlmPromptError(error);
    if (failure.category === "prompt_changed") await this.load(this.accountId);
    if (generation !== this.generation) return;
    runInAction(() => {
      this.failure = failure.category === "prompt_changed" ? failure : (fallback ?? failure);
    });
    console.error(logMessage, {
      category: failure.category,
      errorType: error instanceof Error ? error.name : typeof error,
      status: error instanceof FeedApiError ? error.status : undefined,
      requestId: error instanceof FeedApiError ? error.requestId : undefined,
    });
  }
}
