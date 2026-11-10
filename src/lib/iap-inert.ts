import type { IapApi, IapOptions } from './iap';

const inertApi: IapApi = {
  connected: false,
  subscriptions: [],
  availablePurchases: [],
  fetchProducts: async () => {},
  requestPurchase: async () => {
    throw new Error(
      'Subscriptions can only be purchased in the HappiNotes app.',
    );
  },
  restorePurchases: async () => {},
  finishTransaction: async () => {},
};

/**
 * Used whenever the native store module is unavailable: the web build (no
 * `expo-iap` implementation) and Expo Go (which does not bundle `ExpoIap`).
 * The returned object is a module-level constant so context identities stay
 * stable across renders.
 */
export function useInertIAP(_options?: IapOptions): IapApi {
  return inertApi;
}
