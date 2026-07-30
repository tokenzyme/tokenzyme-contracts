import { IgnitionModule } from '@nomicfoundation/ignition-core';

export type Network = 'mainnet' | 'testnet' | 'testnetLegacy' | 'fork';

export const ALL_NETWORKS: Network[] = ['mainnet', 'testnet', 'testnetLegacy', 'fork'];
export const MAINNET_AND_TESTNET: Network[] = ['mainnet', 'testnet', 'testnetLegacy'];

export interface Module {
  supportedNetworks: Network[];
  parameters?: Partial<Record<Network, Record<string, string>>>;
  definition: IgnitionModule;
}
