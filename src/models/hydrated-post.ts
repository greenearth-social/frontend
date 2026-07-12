export interface HydratedPost {
  atUri: string;
  text: string;
  authorHandle: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  replyCount: number;
  repostCount: number;
  likeCount: number;
  imageUrls: string[];
  videoUrl: string | null;
  linkCard: {
    title: string;
    description: string;
    imageUrl: string;
  } | null;
}
