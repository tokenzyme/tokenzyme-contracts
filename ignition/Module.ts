import { IgnitionModule } from '@nomicfoundation/ignition-core';

export type Network = 'mainnet' | 'testnet' | 'testnetLegacy' | 'fork';

export const ALL_NETWORKS: Network[] = ['mainnet', 'testnet', 'testnetLegacy', 'fork'];

export interface Module {
  supportedNetworks: Network[];
  parameters?: Partial<Record<Network, Record<string, string>>>;
  definition: IgnitionModule;
}
