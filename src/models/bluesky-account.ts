export interface BlueskyAccount {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

export interface UserDocument {
  userDid: string;
  username: string | null;
  debugFeeds: boolean;
}
