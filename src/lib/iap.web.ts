import { useInertIAP } from './iap-inert';
import type { IapApi, IapOptions } from './iap';

/**
 * Web build of the store wrapper: `expo-iap` ships no web implementation, so
 * importing or calling its hook throws in the browser.
 */
export const IAP_SUPPORTED = false;

export const useIAP: (options?: IapOptions) => IapApi = useInertIAP;
