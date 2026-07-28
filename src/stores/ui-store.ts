import { makeAutoObservable } from "mobx";
import type { AlgorithmId } from "../constants/algorithms";

export class UIStore {
  selectedItemUri: string | null;
  selectedFeed: string;
  selectedAlgorithm: AlgorithmId | null;

  constructor() {
    this.selectedItemUri = null;
    this.selectedFeed = "latest";
    this.selectedAlgorithm = null;
    makeAutoObservable(this);
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
  }
}
