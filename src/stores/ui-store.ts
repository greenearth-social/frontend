import { makeAutoObservable } from "mobx";

export class UIStore {
  selectedItemUri: string | null;
  selectedFeed: string;

  constructor() {
    this.selectedItemUri = null;
    this.selectedFeed = "latest";
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
}
