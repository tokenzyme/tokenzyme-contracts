import { task, types } from 'hardhat/config';

import { Network } from '../ignition/Module';
import { deployModules } from '../ignition/deployModules';

task('deployContracts', 'Deploy contracts')
  .addOptionalParam('from', 'Start deyploying from this module id', undefined, types.string)
  .setAction(async ({ from }, { network }) => {
    // Validated here rather than at module scope: the ignition modules are imported
    // whenever Hardhat loads its config, so throwing there would break compile and
    // test as well.
    if (!process.env.FEE_RECIPIENT) {
      throw new Error(
        'Missing FEE_RECIPIENT environment variable.\n' +
          'Set it in .env to the address that should receive protocol trade fees and the ' +
          'liquidity position minted when a token migrates to the DEX.\n' +
          'There is no default on purpose - deploying with someone else’s address would ' +
          'hand them the economics of your launchpad.',
      );
    }

    // This import needs to be here, otherwise the following error is thrown:
    // Error HH9: Error while loading Hardhat's configuration.
    const { ignition } = await import('hardhat');

    await deployModules(ignition, network.name as Network, from as string | undefined);
  });
