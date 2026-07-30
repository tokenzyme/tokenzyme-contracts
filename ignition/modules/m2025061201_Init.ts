import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import { ALL_NETWORKS, Module } from '../Module';

// The account that receives protocol trade fees AND the full-range LP position minted
// when a token migrates to the DEX. There is deliberately no default: deploying with
// someone else's fee recipient would hand them the economics of your launchpad.
//
// This file is imported when Hardhat loads its config, so it must not throw here —
// that would break `compile` and `test` too. The deployContracts task validates it.
const feeRecipient = process.env.FEE_RECIPIENT ?? '';

// The addresses below describe the target network, not the deployer: a Chainlink-
// compatible price feed, the canonical wrapped native token, and a Uniswap V3-style
// DEX. Change them when deploying to a chain other than Sonic.
export const module: Module = {
  supportedNetworks: ALL_NETWORKS,
  parameters: {
    mainnet: {
      feeRecipient,
      priceFeed: '0xc76dFb89fF298145b417d221B2c747d84952e01d',
      wrappedEth: '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38',
      dexPoolFactory: '0xcD2d0637c94fe77C2896BbCBB174cefFb08DE6d7',
      dexPositionManager: '0x12E66C8F215DdD5d48d150c8f46aD0c6fB0F4406',
    },
    testnet: {
      feeRecipient,
      priceFeed: '0xC13a2Af6076E1dc5673eA9f3476a60299eADf7AE',
      wrappedEth: '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38',
      // The following are not available on the testnet
      dexPoolFactory: '0x0000000000000000000000000000000000000000',
      dexPositionManager: '0x0000000000000000000000000000000000000000',
    },
    testnetLegacy: {
      feeRecipient,
      priceFeed: '0xC13a2Af6076E1dc5673eA9f3476a60299eADf7AE',
      wrappedEth: '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38',
      // The following are not available on the legacy testnet
      dexPoolFactory: '0x0000000000000000000000000000000000000000',
      dexPositionManager: '0x0000000000000000000000000000000000000000',
    },
  },
  definition: buildModule('m2025061201_Init', (m) => {
    const launchpad = m.contract('Launchpad');

    const launchpadProxy = m.contract(
      'ERC1967Proxy',
      [
        launchpad,
        m.encodeFunctionCall(launchpad, 'initialize', [
          m.getParameter('feeRecipient'),
          m.getParameter('priceFeed'),
          m.getParameter('wrappedEth'),
          m.getParameter('dexPoolFactory'),
          m.getParameter('dexPositionManager'),
        ]),
      ],
      { id: 'LaunchpadProxy' },
    );

    return { launchpadProxy };
  }),
};
