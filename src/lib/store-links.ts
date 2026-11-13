export const POLICY_BASE_URL = 'https://happinotes.online';
export const PRIVACY_POLICY_URL = `${POLICY_BASE_URL}/privacy-policy`;
export const TERMS_URL = `${POLICY_BASE_URL}/terms`;

export function androidSubscriptionSettingsUrl(packageName?: string, productId?: string | null) {
  const base = 'https://play.google.com/store/account/subscriptions';
  if (!packageName) return base;
  return `${base}?package=${encodeURIComponent(packageName)}${productId ? `&sku=${encodeURIComponent(productId)}` : ''}`;
}
