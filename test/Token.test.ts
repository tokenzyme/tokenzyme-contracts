/* eslint-disable @typescript-eslint/no-unused-expressions */
import '@nomicfoundation/hardhat-chai-matchers';

import { setBalance } from '@nomicfoundation/hardhat-network-helpers';
import { buildModule } from '@nomicfoundation/ignition-core';
import { expect } from 'chai';
import { Wallet, ZeroAddress, parseEther } from 'ethers';
import { ethers, ignition } from 'hardhat';

import { Token } from '../typechain';

import { Signers, getSigners } from './utils/signers';
import { listTokenTransfers } from './utils/tokens';

describe('Token', () => {
  let signers: Signers;
  let token: Token;

  before(async () => {
    signers = await getSigners();
    await setBalance(signers.user.address, parseEther('1000000'));
  });

  beforeEach(async () => {
    const deployment = await ignition.deploy(
      buildModule('token', (m) => {
        const tokenContract = m.contract('Token', [
          'Token',
          'TOKEN',
          parseEther('1000'),
          signers.deployer.address,
          signers.user.address,
        ]);
        return { tokenContract };
      }),
    );
    token = await ethers.getContractAt('Token', deployment.tokenContract.target);
  });

  it('should set isLocked as true when the contract is deployed', async () => {
    expect(await token.isLocked()).to.be.true;
  });

  it('should set isLocked as false when unlock function is called', async () => {
    expect(await token.isLocked()).to.be.true;

    const tx = await token.connect(signers.deployer).unlock();
    await tx.wait();

    expect(await token.isLocked()).to.be.false;
  });

  it('should NOT allow the user to unlock the token', async () => {
    expect(await token.isLocked()).to.be.true;

    const tx = await token.connect(signers.deployer).transfer(signers.user, parseEther('500'));
    await tx.wait();

    await expect(token.connect(signers.user).unlock()).to.be.revertedWithCustomError(token, 'NotAllowedToUnlock');

    expect(await token.isLocked()).to.be.true;
  });

  it('should allow the deployer to transfer when the token is locked', async () => {
    expect(await token.isLocked()).to.be.true;

    const tx = await token.connect(signers.deployer).transfer(signers.user, parseEther('500'));
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error('Receipt is null');
    }

    const transfers = listTokenTransfers(await token.getAddress(), receipt);

    expect(transfers).to.deep.include({
      from: signers.deployer.address,
      to: signers.user.address,
      value: parseEther('500'),
    });
  });

  it('should NOT allow the user to transfer when the token is locked', async () => {
    expect(await token.isLocked()).to.be.true;

    const tx = await token.connect(signers.deployer).transfer(signers.user, parseEther('500'));
    await tx.wait();

    await expect(
      token.connect(signers.user).transfer(Wallet.createRandom().address, parseEther('250')),
    ).to.be.revertedWithCustomError(token, 'TokenIsLocked');
  });

  it('should allow the user to transfer when the token is unlocked', async () => {
    expect(await token.isLocked()).to.be.true;

    let tx = await token.connect(signers.deployer).transfer(signers.user, parseEther('500'));
    await tx.wait();

    tx = await token.connect(signers.deployer).unlock();
    await tx.wait();

    expect(await token.isLocked()).to.be.false;

    const randomAddress = Wallet.createRandom().address;

    tx = await token.connect(signers.user).transfer(randomAddress, parseEther('250'));
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error('Receipt is null');
    }

    const transfers = listTokenTransfers(await token.getAddress(), receipt);

    expect(transfers).to.deep.include({
      from: signers.user.address,
      to: randomAddress,
      value: parseEther('250'),
    });
  });

  it('should allow the user to burn when the token is locked', async () => {
    expect(await token.isLocked()).to.be.true;

    let tx = await token.connect(signers.deployer).transfer(signers.user, parseEther('500'));
    await tx.wait();

    tx = await token.connect(signers.user).burn(parseEther('250'));
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error('Receipt is null');
    }

    const transfers = listTokenTransfers(await token.getAddress(), receipt);

    expect(transfers).to.deep.include({
      from: signers.user.address,
      to: ZeroAddress,
      value: parseEther('250'),
    });
  });
});
