import { useIAP as useExpoIap } from 'expo-iap';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useInertIAP } from './iap-inert';

export type IapOptions = {
  onPurchaseSuccess?: (purchase: any) => void;
  onPurchaseError?: (error: any) => void;
};

export type IapApi = {
  connected: boolean;
  subscriptions: { id: string; displayPrice?: string | null }[];
  availablePurchases: any[];
  fetchProducts: (params: {
    skus: string[];
    type?: 'subs' | 'in-app' | 'non-subscription';
  }) => Promise<void>;
  requestPurchase: (params: any) => Promise<unknown>;
  restorePurchases: () => Promise<void>;
  finishTransaction: (params: {
    purchase: any;
    isConsumable?: boolean;
  }) => Promise<void>;
};

/**
 * `expo-iap` has no web implementation and Expo Go does not bundle the
 * `ExpoIap` native module; calling its hook there throws
 * "Cannot find native module 'ExpoIap'". Detect the module once and fall back
 * to the inert implementation instead.
 */
export const IAP_SUPPORTED =
  requireOptionalNativeModule<unknown>('ExpoIap') != null;

export const useIAP: (options?: IapOptions) => IapApi = IAP_SUPPORTED
  ? (useExpoIap as unknown as (options?: IapOptions) => IapApi)
  : useInertIAP;
