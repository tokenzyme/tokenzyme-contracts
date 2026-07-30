import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-ignition-ethers';
import '@nomicfoundation/hardhat-verify';
import '@typechain/hardhat';
import 'dotenv/config';
import 'hardhat-contract-sizer';
import 'hardhat-dependency-compiler';

import './tasks/deployContracts';

import { HardhatUserConfig } from 'hardhat/types';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: process.env.TEST === 'true' ? 50 : 6000,
        details: {
          yulDetails: {
            optimizerSteps: 'u',
          },
        },
      },
    },
  },
  networks: {
    hardhat:
      process.env.FORK === 'true'
        ? {
            chainId: 1337,
            forking: {
              url: 'https://rpc.soniclabs.com',
            },
            accounts: process.env.DEPLOYER_PRIVATE_KEY
              ? [{ privateKey: process.env.DEPLOYER_PRIVATE_KEY, balance: '1000000000000000000000000' }]
              : undefined,
          }
        : {},
    mainnet: {
      chainId: 146,
      url: 'https://rpc.soniclabs.com',
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : undefined,
    },
    testnet: {
      chainId: 14601,
      url: 'https://rpc.testnet.soniclabs.com',
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : undefined,
    },
    testnetLegacy: {
      chainId: 57054,
      url: 'https://rpc.blaze.soniclabs.com',
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : undefined,
    },
    fork: {
      chainId: 1337,
      url: 'http://127.0.0.1:8545',
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : undefined,
    },
  },
  typechain: {
    outDir: './typechain',
  },
  dependencyCompiler: {
    paths: [
      '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol',
      ...(process.env.TEST === 'true'
        ? [
            'test/contracts/LaunchpadHarness.sol',
            'test/contracts/MockAggregatorV3Interface.sol',
            'test/contracts/MockPoolFactory.sol',
            'test/contracts/MockPositionManager.sol',
            'test/contracts/MockWrappedEth.sol',
          ]
        : []),
    ],
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
    customChains: [
      {
        network: 'mainnet',
        chainId: 146,
        urls: {
          apiURL: 'https://api.sonicscan.org/api',
          browserURL: 'https://sonicscan.org',
        },
      },
    ],
  },
};

// eslint-disable-next-line import/no-default-export
export default config;
