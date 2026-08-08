import { makeAutoObservable } from "mobx";
import { isAlgorithmId, type AlgorithmId } from "../constants/algorithms";

const LAST_SELECTED_FEED_STORAGE_KEY = "greenearth:last-selected-feed:v1";

function readRememberedFeeds(): Record<string, AlgorithmId> {
  try {
    const raw = window.localStorage.getItem(LAST_SELECTED_FEED_STORAGE_KEY);
    if (!raw) return {};
    const candidate: unknown = JSON.parse(raw);
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(candidate as Record<string, unknown>).filter(
        (entry): entry is [string, AlgorithmId] =>
          typeof entry[1] === "string" && isAlgorithmId(entry[1]),
      ),
    );
  } catch {
    return {};
  }
}

function writeRememberedFeeds(feeds: Record<string, AlgorithmId>): void {
  try {
    window.localStorage.setItem(LAST_SELECTED_FEED_STORAGE_KEY, JSON.stringify(feeds));
  } catch {
    // Selection still works in memory when browser storage is unavailable.
  }
}

export class UIStore {
  selectedItemUri: string | null;
  selectedFeed: string;
  selectedAlgorithm: AlgorithmId | null;
  private _accountId: string | null;

  constructor() {
    this.selectedItemUri = null;
    this.selectedFeed = "latest";
    this.selectedAlgorithm = null;
    this._accountId = null;
    makeAutoObservable(this);
  }

  activateAccount(accountId: string): void {
    if (this._accountId === accountId) return;
    this._accountId = accountId;
    const rememberedFeeds = readRememberedFeeds();
    this.selectedAlgorithm = rememberedFeeds[accountId] ?? "your-feed";
    rememberedFeeds[accountId] = this.selectedAlgorithm;
    writeRememberedFeeds(rememberedFeeds);
  }

  deactivateAccount(): void {
    this._accountId = null;
    this.selectedAlgorithm = null;
    this.selectedItemUri = null;
  }

  toggleSelectedItem(uri: string): void {
    this.selectedItemUri = this.selectedItemUri === uri ? null : uri;
  }

  clearSelection(): void {
    this.selectedItemUri = null;
  }

  setSelectedFeed(feed: string): void {
    this.selectedFeed = feed;
  }

  setSelectedAlgorithm(id: AlgorithmId): void {
    this.selectedAlgorithm = id;
    if (!this._accountId) return;
    const rememberedFeeds = readRememberedFeeds();
    rememberedFeeds[this._accountId] = id;
    writeRememberedFeeds(rememberedFeeds);
  }

  clearSelectedAlgorithm(): void {
    this.selectedAlgorithm = null;
  }
}
