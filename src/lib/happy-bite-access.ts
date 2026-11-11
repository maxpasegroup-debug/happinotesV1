import type { Book, HappyBite, User } from './types';

export function parseHappyBite(json: any): HappyBite {
  return {
    id: String(json?._id ?? json?.id ?? ''),
    title: String(json?.title ?? ''),
    description: String(json?.description ?? ''),
    thumbnailUrl: String(json?.thumbnailUrl ?? json?.thumbnail ?? ''),
    audioUrl: json?.locked === true ? '' : String(json?.audioUrl ?? json?.audioFileUrl ?? ''),
    accessType: json?.accessType === 'premium' ? 'premium' : 'free',
    locked: json?.locked === true,
    durationSeconds: Math.max(0, Number(json?.durationSeconds ?? json?.duration ?? 0) || 0),
    category: String(json?.category ?? 'general'),
    published: json?.published === true || json?.status === 'published',
    displayOrder: Number(json?.displayOrder ?? json?.sortOrder ?? 0) || 0,
    createdAt: json?.createdAt ? String(json.createdAt) : undefined,
    updatedAt: json?.updatedAt ? String(json.updatedAt) : undefined,
  };
}


export function happyBiteAsBook(bite: HappyBite): Book {
  return {
    id: `happy-bite-${bite.id}`,
    happyBiteId: bite.id,
    title: bite.title,
    description: bite.description,
    language: '',
    category: bite.category,
    coverImageUrl: bite.thumbnailUrl,
    audioUrl: bite.audioUrl,
    accessType: bite.accessType,
    priceInr: 0,
    status: 'live',
    duration: bite.durationSeconds,
    episodes: [{ title: bite.title, description: bite.description, audioUrl: bite.audioUrl, order: 0 }],
  };
}

export class HappyBiteAccessError extends Error {
  constructor() { super('This Happy Bite is included with Pro.'); this.name = 'HappyBiteAccessError'; }
}

// Display hint only. The server rechecks the entitlement before playback.
export function hasHappyBiteProAccess(user: User | null, now = Date.now()) {
  return user?.role === 'admin' || Boolean(user?.subscriptionActive &&
    (!user.subscriptionExpiresAt || Date.parse(user.subscriptionExpiresAt) > now));
}
