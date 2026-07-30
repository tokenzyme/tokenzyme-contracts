import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import { MAINNET_AND_TESTNET, Module } from '../Module';
import mainnetAddresses from '../deployments/chain-146/deployed_addresses.json';
import testnetAddresses from '../deployments/chain-14601/deployed_addresses.json';
import testnetLegacyAddresses from '../deployments/chain-57054/deployed_addresses.json';

export const module: Module = {
  supportedNetworks: MAINNET_AND_TESTNET,
  parameters: {
    mainnet: {
      launchpadProxy: mainnetAddresses['m2025061201_Init#LaunchpadProxy'],
    },
    testnet: {
      launchpadProxy: testnetAddresses['m2025061201_Init#LaunchpadProxy'],
    },
    testnetLegacy: {
      launchpadProxy: testnetLegacyAddresses['m2025061201_Init#LaunchpadProxy'],
    },
  },
  definition: buildModule('m2025062901_RenameSocialNetwork', (m) => {
    const launchpad = m.contract('Launchpad');

    const launchpadProxy = m.contractAt('Launchpad', m.getParameter('launchpadProxy'), {
      id: 'LaunchpadProxy',
    });
    m.call(launchpadProxy, 'upgradeToAndCall', [launchpad, '0x']);

    return { launchpadProxy };
  }),
};
