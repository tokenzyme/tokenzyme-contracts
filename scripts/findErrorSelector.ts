/* eslint-disable no-console, no-restricted-syntax */
import { readFileSync } from 'fs';
import { join } from 'path';

import { keccak256, toUtf8Bytes } from 'ethers';

// Resolves a 4-byte custom-error selector back to its signature, for decoding a
// revert you only have the selector for.
//
//   yarn hardhat compile
//   yarn ts-node scripts/findErrorSelector.ts 0x9aa05307

interface AbiInput {
  type: string;
}

interface AbiItem {
  type: string;
  name?: string;
  inputs?: AbiInput[];
}

// Written by `hardhat compile`. Not committed — run the compile first.
const ARTIFACT_PATH = join(__dirname, '../artifacts/contracts/Launchpad.sol/Launchpad.json');

const targetSelector = process.argv[2]?.toLowerCase();
if (!targetSelector || !/^0x[0-9a-fA-F]{8}$/.test(targetSelector)) {
  console.error('❌ Please provide a valid 4-byte selector (e.g. 0x9aa05307)');
  process.exit(1);
}

let abi: AbiItem[];
try {
  abi = (JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8')) as { abi: AbiItem[] }).abi;
} catch {
  console.error(`❌ Could not read ${ARTIFACT_PATH}. Run \`yarn hardhat compile\` first.`);
  process.exit(1);
}

for (const item of abi) {
  if (item.type === 'error' && item.name) {
    const inputs = (item.inputs ?? []).map((input) => input.type).join(',');
    const signature = `${item.name}(${inputs})`;
    const selector = keccak256(toUtf8Bytes(signature)).slice(0, 10);
    if (selector === targetSelector) {
      console.log(`✅ Match found!`);
      console.log(`🔹 Error selector: ${selector}`);
      console.log(`🔹 Error signature: ${signature}`);
      process.exit(0);
    }
  }
}

console.error(`❌ No error found for selector: ${targetSelector}`);
process.exit(1);
