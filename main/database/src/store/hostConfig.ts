import type { HostConfig } from '@labring/sealos-desktop-sdk';
import { create } from 'zustand';

type HostConfigState = {
  currencySymbol: NonNullable<HostConfig['currencySymbol']>;
  subscriptionEnabled: boolean;
  loadHostConfig: (getHostConfig: () => Promise<HostConfig>) => Promise<void>;
};

// One request per page lifetime, including concurrent callers and React effect replays.
// Host settings are intentionally kept in memory, never persisted in browser storage.
export const createHostConfigStore = () => {
  let request: Promise<void> | undefined;
  return create<HostConfigState>((set) => ({
    currencySymbol: 'shellCoin',
    subscriptionEnabled: true,
    loadHostConfig: (getHostConfig) => {
      if (!request) {
        request = Promise.resolve()
          .then(getHostConfig)
          .then((config) => {
            set({
              currencySymbol: config.currencySymbol ?? 'shellCoin',
              subscriptionEnabled: config.features.subscription
            });
          })
          .catch(() => {
            set({ currencySymbol: 'shellCoin', subscriptionEnabled: true });
          });
      }
      return request;
    }
  }));
};

export const useHostConfigStore = createHostConfigStore();
