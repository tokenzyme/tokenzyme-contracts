/* eslint-disable no-console, no-restricted-syntax, no-await-in-loop */
import { EthersIgnitionHelper } from '@nomicfoundation/hardhat-ignition-ethers/dist/src/ethers-ignition-helper';

import { Network } from './Module';
import { modules } from './modules';

export const deployModules = async (
  ignition: EthersIgnitionHelper,
  network: Network,
  deployFromModuleId?: string,
): Promise<void> => {
  try {
    console.log('🚀 Deploying modules...');

    let deployFromIndex = 0;
    if (deployFromModuleId) {
      deployFromIndex = modules.findIndex((module) => module.definition.id === deployFromModuleId);
      if (deployFromIndex === -1) {
        throw new Error(`Module ${deployFromModuleId} not found`);
      }
    }

    for (const module of modules.slice(deployFromIndex)) {
      console.log(`🔹 Deploying module ${module.definition.id}...`);

      if (module.supportedNetworks.includes(network)) {
        const parameters = module.parameters?.[network !== 'fork' ? network : 'mainnet'] ?? {};
        await ignition.deploy(module.definition, { parameters: { [module.definition.id]: parameters } });
        console.log(`✅ Module ${module.definition.id} deployed!`);
      } else {
        console.log(`⚪ Module ${module.definition.id} skipped!`);
      }
    }

    console.log('🎉 All modules deployed successfully!');
  } catch (err) {
    console.error('❌ Deployment failed:', err);
  }
};
