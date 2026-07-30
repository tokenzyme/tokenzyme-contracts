import { IgnitionModuleResultsTToEthersContracts } from '@nomicfoundation/hardhat-ignition-ethers/dist/src/ethers-ignition-helper';
import { NamedArtifactContractDeploymentFuture, buildModule } from '@nomicfoundation/ignition-core';
import { ignition } from 'hardhat';

import { FEE_RECIPIENT } from './constants';

export const deployTestContracts = (): Promise<
  IgnitionModuleResultsTToEthersContracts<
    string,
    {
      launchpad: NamedArtifactContractDeploymentFuture<'LaunchpadHarness'>;
      mockPriceFeed: NamedArtifactContractDeploymentFuture<'MockAggregatorV3Interface'>;
      mockWrappedEth: NamedArtifactContractDeploymentFuture<'MockWrappedEth'>;
      mockPoolFactory: NamedArtifactContractDeploymentFuture<'MockPoolFactory'>;
      mockPositionManager: NamedArtifactContractDeploymentFuture<'MockPositionManager'>;
    }
  >
> =>
  ignition.deploy(
    buildModule('mocks', (m) => {
      const launchpad = m.contract('LaunchpadHarness');
      const mockPriceFeed = m.contract('MockAggregatorV3Interface');
      const mockWrappedEth = m.contract('MockWrappedEth', ['Wrapped ETH', 'wETH']);
      const mockPoolFactory = m.contract('MockPoolFactory');
      const mockPositionManager = m.contract('MockPositionManager');

      m.call(launchpad, 'initialize', [
        FEE_RECIPIENT,
        mockPriceFeed,
        mockWrappedEth,
        mockPoolFactory,
        mockPositionManager,
      ]);

      return { launchpad, mockPriceFeed, mockWrappedEth, mockPoolFactory, mockPositionManager };
    }),
  );
