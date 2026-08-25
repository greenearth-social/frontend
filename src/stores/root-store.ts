import type { ServiceProvider } from "../services/service-provider";
import { AuthStore } from "./auth-store";
import { AccountStore } from "./account-store";
import { FeedStore } from "./feed-store";
import { UIStore } from "./ui-store";
import { PreferencesStore } from "./preferences-store";
import { FeedbackStore } from "./feedback-store";
import { SettingsPreviewStore } from "./settings-preview-store";

export class RootStore {
  services: ServiceProvider;
  authStore: AuthStore;
  accountStore: AccountStore;
  feedStore: FeedStore;
  uiStore: UIStore;
  preferencesStore: PreferencesStore;
  feedbackStore: FeedbackStore;
  settingsPreviewStore: SettingsPreviewStore;

  constructor(services: ServiceProvider) {
    this.services = services;

    this.preferencesStore = new PreferencesStore(this);
    this.settingsPreviewStore = new SettingsPreviewStore(this);
    this.feedStore = new FeedStore(this);
    this.uiStore = new UIStore();
    this.authStore = new AuthStore(this);
    this.accountStore = new AccountStore(this);
    this.feedbackStore = new FeedbackStore(this);
  }
}
