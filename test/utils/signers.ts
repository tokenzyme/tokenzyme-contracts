import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';

export interface Signers {
  deployer: HardhatEthersSigner;
  user: HardhatEthersSigner;
  anotherUser: HardhatEthersSigner;
}

export const getSigners = async (): Promise<Signers> => {
  const [deployer, user, anotherUser] = await ethers.getSigners();

  if (!deployer) {
    throw new Error('Deployer not found');
  }
  if (!user) {
    throw new Error('User not found');
  }
  if (!anotherUser) {
    throw new Error('Another user not found');
  }

  return {
    deployer,
    user,
    anotherUser,
  };
};
