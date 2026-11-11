export type BookEpisode = {
  title: string;
  description: string;
  audioUrl: string;
  order: number;
};

export type HappyBite = {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  audioUrl: string;
  durationSeconds: number;
  accessType: 'free' | 'premium';
  locked: boolean;
  category: string;
  published: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type HappyBiteDraft = Omit<HappyBite, 'id' | 'createdAt' | 'updatedAt' | 'locked'> & {
  id?: string;
};

export type Book = {
  id: string;
  happyBiteId?: string;
  title: string;
  description: string;
  language: string;
  category: string;
  coverImageUrl: string;
  audioUrl: string;
  accessType: string;
  priceInr: number;
  status: string;
  duration: number;
  episodes: BookEpisode[];
  createdAt?: string;
};

export type User = {
  id: string;
  name: string;
  role: string;
  email?: string;
  phoneNumber?: string;
  languagePreference: string;
  purchasedBookIds: string[];
  subscriptionActive: boolean;
  subscriptionPlan?: string;
  subscriptionProductId?: string;
  subscriptionExpiresAt?: string;
  subscriptionAutoRenewing?: boolean;
};

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  target: string;
  createdAt: string;
  bookId?: string;
  episodeId?: string;
  imageUrl?: string;
};

export type AccountDeletionStatus =
  | "requested"
  | "processing"
  | "failed_retryable"
  | "failed_manual"
  | "blocked_policy"
  | "completed"
  | "unknown";

export type AccountDeletionRequestStatus = {
  requestId: string;
  status: AccountDeletionStatus;
  reference?: string;
  requestedAt?: string;
  startedAt?: string;
  completedAt?: string;
  failureCode?: string;
  statusToken?: string;
};

export type DeletionReauthProof = {
  proof: string;
  expiresAt?: string;
};

export type AdminStats = {
  totalUsers?: number;
  activePremiumSubscribers?: number;
  totalBooksPublished?: number;
  totalChaptersUploaded?: number;
  mostListenedBook?: string;
  [key: string]: unknown;
};

export type AdminBook = Record<string, any>;
export type AdminUser = Record<string, any>;

export type BookDraftEpisode = {
  title: string;
  description: string;
  mediaUrl: string;
  mediaType: string;
  order: number;
  fileName?: string;
};

export type BookDraft = {
  id?: string;
  title: string;
  description: string;
  language: string;
  category: string;
  status: string;
  accessType: string;
  priceInr: string;
  coverImageUrl: string;
  coverPublicId: string;
  introAudioUrl: string;
  introAudioPublicId: string;
  audioFileName: string;
  duration: string;
  sortOrder: string;
  tags: string;
  featured: boolean;
  trending: boolean;
  episodes: BookDraftEpisode[];
};

export type SubscriptionPlan = {
  key: string;
  productId: string;
  billingPeriod: string;
};
