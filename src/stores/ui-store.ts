import { makeAutoObservable } from "mobx";

export class UIStore {
  selectedItemUri: string | null;

  constructor() {
    this.selectedItemUri = null;
    makeAutoObservable(this);
  }

  toggleSelectedItem(uri: string): void {
    this.selectedItemUri = this.selectedItemUri === uri ? null : uri;
  }

  clearSelection(): void {
    this.selectedItemUri = null;
  }
}
