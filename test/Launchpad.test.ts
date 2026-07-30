/* eslint-disable @typescript-eslint/no-unused-expressions */
import '@nomicfoundation/hardhat-chai-matchers';

import { setBalance } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ZeroAddress, parseEther } from 'ethers';
import { ethers } from 'hardhat';

import { LaunchpadHarness, MockAggregatorV3Interface, MockPoolFactory, MockPositionManager } from '../typechain';

import { FEE_RECIPIENT } from './utils/constants';
import { deployTestContracts } from './utils/deployTestContracts';
import { Signers, getSigners } from './utils/signers';
import {
  getCreatorMigrationRemainingEthShare,
  getCreatorTradeFeeShare,
  getFeeRecipientRemainingEthShare,
  getFeeRecipientTradeFeeShare,
  getFinalMarketCap,
  getTradeFee,
  launchToken,
  listTokenTransfers,
} from './utils/tokens';

// Mocked DEX liquidity pool address
const MIGRATION_DEX_POOL = '0x0000000000000000000000000000000000000001';
// Mocked DEX liquidity token id
const MIGRATION_TOKEN_ID = 1;

// Initial token price when 1 ETH is <= 0.5 USD
const EXPECTED_INITIAL_TOKEN_PRICE = parseEther('0.000008448275869942');
// Final token price when 1 ETH is <= 0.5 USD
const EXPECTED_FINAL_TOKEN_PRICE = parseEther('0.000130509533679897');
// ETH added to the liquidity pool when the token is migrated to the DEX
const EXPECTED_ETH_LIQUIDITY = parseEther('26101.9067359794');
// Tokens added to the liquidity pool when the token is migrated to the DEX
const EXPECTED_TOKEN_LIQUIDITY = parseEther('200000000');
// Remaining ETH after adding liquidity to the liquidity pool when the token is migrated to the DEX
const EXPECTED_REMAINING_ETH = parseEther('462.195828123164102564');

describe('Launchpad', () => {
  let signers: Signers;
  let launchpad: LaunchpadHarness;
  let mockPriceFeed: MockAggregatorV3Interface;
  let mockPoolFactory: MockPoolFactory;
  let mockPositionManager: MockPositionManager;

  before(async () => {
    signers = await getSigners();
    await setBalance(signers.user.address, parseEther('1000000'));
    await setBalance(signers.anotherUser.address, parseEther('1000000'));

    const deployment = await deployTestContracts();
    launchpad = await ethers.getContractAt('LaunchpadHarness', deployment.launchpad.target);
    mockPriceFeed = await ethers.getContractAt('MockAggregatorV3Interface', deployment.mockPriceFeed.target);
    mockPoolFactory = await ethers.getContractAt('MockPoolFactory', deployment.mockPoolFactory.target);
    mockPositionManager = await ethers.getContractAt('MockPositionManager', deployment.mockPositionManager.target);
  });

  beforeEach(async () => {
    await mockPriceFeed.setAnswer(5e7);
    const tx = await launchpad.connect(signers.deployer).setFeeParams(FEE_RECIPIENT, 100);
    await tx.wait();
  });

  describe('launchToken', () => {
    it('should create a new token', async () => {
      const { tokenAddress } = await launchToken(launchpad, signers.user);

      const state = await launchpad.state();

      const token = await ethers.getContractAt('Token', tokenAddress);
      expect(await token.name()).to.be.equal('Token');
      expect(await token.symbol()).to.be.equal('TOKEN');
      expect(await token.totalSupply()).to.be.equal(state.tokenTotalSupply);
      expect(await token.deployer()).to.be.equal(await launchpad.getAddress());
      expect(await token.creator()).to.be.equal(signers.user.address);
      expect(await token.isLocked()).to.be.true;
    });

    it('should mint the total supply to the Launchpad contract', async () => {
      const { tokenAddress, receipt } = await launchToken(launchpad, signers.user);

      const state = await launchpad.state();

      const transfers = listTokenTransfers(tokenAddress, receipt);

      expect(transfers).to.deep.include({
        from: ZeroAddress,
        to: await launchpad.getAddress(),
        value: state.tokenTotalSupply,
      });
    });

    it('should emit a TokenLaunched event containing token information', async () => {
      const { tokenAddress, tx } = await launchToken(launchpad, signers.user);

      await expect(tx)
        .to.emit(launchpad, 'TokenLaunched')
        .withArgs(
          tokenAddress,
          signers.user.address,
          'Token',
          'TOKEN',
          'Description of Token',
          'https://token.com/logo.jpg',
          'https://token.com',
          'https://x.com/token',
          'https://t.me/token',
          'https://discord.gg/token',
          'https://reddit.com/r/token',
          'https://facebook.com/token',
          'https://instagram.com/token',
        );
    });

    it('should create market data for the token', async () => {
      const { tokenAddress } = await launchToken(launchpad, signers.user);

      const state = await launchpad.state();

      const marketData = await launchpad.marketDataOf(tokenAddress);
      expect(marketData.tokenTotalSupply).to.be.equal(state.tokenTotalSupply);
      expect(marketData.bondingCurveSupply).to.be.equal(state.bondingCurveSupply);
      expect(marketData.ethReserve).to.be.equal(0);
      expect(marketData.ethVirtualReserve).to.be.equal(state.baseEthVirtualReserve);
      expect(marketData.tokenReserve).to.be.equal(state.bondingCurveSupply);
      expect(marketData.tokenVirtualReserve).to.be.equal(state.baseTokenVirtualReserve);
      expect(marketData.tokenPrice).to.be.equal(EXPECTED_INITIAL_TOKEN_PRICE);
      expect(marketData.tokenFinalPrice).to.be.equal(EXPECTED_FINAL_TOKEN_PRICE);
      expect(marketData.dexPool).to.be.equal(ZeroAddress);
    });

    it('should create market data for the token with the expected reserves and prices when ETH price in USD changes', async () => {
      await mockPriceFeed.setAnswer(4e7);

      let { tokenAddress } = await launchToken(launchpad, signers.user);

      let marketData = await launchpad.marketDataOf(tokenAddress);
      expect(marketData.ethVirtualReserve).to.be.equal(parseEther('9065'));
      expect(marketData.tokenVirtualReserve).to.be.equal(parseEther('273000000'));
      expect(marketData.tokenPrice).to.be.equal(EXPECTED_INITIAL_TOKEN_PRICE);
      expect(marketData.tokenFinalPrice).to.be.equal(EXPECTED_FINAL_TOKEN_PRICE);
      expect(getFinalMarketCap(marketData, ethers.parseEther('0.4'))).to.be.equal(
        ethers.parseEther('52203.8134719588'),
      );

      await mockPriceFeed.setAnswer(5e7);

      ({ tokenAddress } = await launchToken(launchpad, signers.user));

      marketData = await launchpad.marketDataOf(tokenAddress);
      expect(marketData.ethVirtualReserve).to.be.equal(parseEther('9065'));
      expect(marketData.tokenVirtualReserve).to.be.equal(parseEther('273000000'));
      expect(marketData.tokenPrice).to.be.equal(EXPECTED_INITIAL_TOKEN_PRICE);
      expect(marketData.tokenFinalPrice).to.be.equal(EXPECTED_FINAL_TOKEN_PRICE);
      expect(getFinalMarketCap(marketData, ethers.parseEther('0.5'))).to.be.equal(
        ethers.parseEther('65254.7668399485'),
      );

      await mockPriceFeed.setAnswer(1e8);

      ({ tokenAddress } = await launchToken(launchpad, signers.user));

      marketData = await launchpad.marketDataOf(tokenAddress);
      expect(marketData.ethVirtualReserve).to.be.equal(parseEther('4532.5'));
      expect(marketData.tokenVirtualReserve).to.be.equal(parseEther('273000000'));
      expect(marketData.tokenPrice).to.be.equal(parseEther('0.000004224137934971'));
      expect(marketData.tokenFinalPrice).to.be.equal(parseEther('0.000065254766839948'));
      expect(getFinalMarketCap(marketData, ethers.parseEther('1'))).to.be.equal(ethers.parseEther('65254.766839948'));

      await mockPriceFeed.setAnswer(3e8);

      ({ tokenAddress } = await launchToken(launchpad, signers.user));

      marketData = await launchpad.marketDataOf(tokenAddress);
      expect(marketData.ethVirtualReserve).to.be.equal(parseEther('1510.833333333333333333'));
      expect(marketData.tokenVirtualReserve).to.be.equal(parseEther('273000000'));
      expect(marketData.tokenPrice).to.be.equal(parseEther('0.000001408045978323'));
      expect(marketData.tokenFinalPrice).to.be.equal(parseEther('0.000021751588946649'));
      expect(getFinalMarketCap(marketData, ethers.parseEther('3'))).to.be.equal(ethers.parseEther('65254.766839947'));
    });
  });

  describe('buyTokens', () => {
    let tokenAddress: string;

    beforeEach(async () => {
      ({ tokenAddress } = await launchToken(launchpad, signers.user));
    });

    it('should transfer tokens to the buyer', async () => {
      const ethAmount = parseEther('500');
      const expectedTokensBought = parseEther('55558054.393305439330543934');

      const tx = await launchpad.connect(signers.anotherUser).buyTokens(tokenAddress, 0, { value: ethAmount });
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Receipt is null');
      }

      const transfers = listTokenTransfers(tokenAddress, receipt);

      expect(transfers).to.deep.include({
        from: await launchpad.getAddress(),
        to: signers.anotherUser.address,
        value: expectedTokensBought,
      });
    });

    it('should update market data', async () => {
      const ethAmount = parseEther('500');
      const expectedTokensBought = parseEther('55558054.393305439330543934');
      const expectedTokenPrice = parseEther('0.000009396113508663');

      const tx = await launchpad.connect(signers.anotherUser).buyTokens(tokenAddress, 0, { value: ethAmount });
      await tx.wait();

      const state = await launchpad.state();

      const marketData = await launchpad.marketDataOf(tokenAddress);
      expect(marketData.tokenTotalSupply).to.be.equal(state.tokenTotalSupply);
      expect(marketData.bondingCurveSupply).to.be.equal(state.bondingCurveSupply);
      expect(marketData.ethReserve).to.be.equal(ethAmount - parseEther('5'));
      expect(marketData.ethVirtualReserve).to.be.equal(state.baseEthVirtualReserve);
      expect(marketData.tokenReserve).to.be.equal(state.bondingCurveSupply - expectedTokensBought);
      expect(marketData.tokenVirtualReserve).to.be.equal(state.baseTokenVirtualReserve);
      expect(marketData.tokenPrice).to.be.equal(expectedTokenPrice);
      expect(marketData.tokenFinalPrice).to.be.equal(EXPECTED_FINAL_TOKEN_PRICE);
      expect(marketData.dexPool).to.be.equal(ZeroAddress);
    });

    it('should refund the buyer when the buyer sends more ETH that is needed to buy the remaining tokens', async () => {
      const state = await launchpad.state();

      const ethAmount = parseEther('30000');
      const ethAmountToBuyAllTokens = await launchpad.estimateEthToBuyTokens(tokenAddress, state.bondingCurveSupply);

      const initialEthBalance = await ethers.provider.getBalance(signers.anotherUser);

      const tx = await launchpad.connect(signers.anotherUser).buyTokens(tokenAddress, 0, { value: ethAmount });
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Receipt is null');
      }

      expect(await ethers.provider.getBalance(signers.anotherUser)).to.be.equal(
        initialEthBalance - receipt.fee - ethAmountToBuyAllTokens,
      );
    });

    it('should transfer part of the trade tee to the fee recipient', async () => {
      const ethAmount = parseEther('500');
      const expectedFee = await getTradeFee(launchpad, ethAmount);
      const expectedFeeShare = await getFeeRecipientTradeFeeShare(launchpad, expectedFee);

      const initialEthBalance = await ethers.provider.getBalance(FEE_RECIPIENT);

      const tx = await launchpad.connect(signers.anotherUser).buyTokens(tokenAddress, 0, { value: ethAmount });
      await tx.wait();

      expect(await ethers.provider.getBalance(FEE_RECIPIENT)).to.be.equal(initialEthBalance + expectedFeeShare);
    });

    it('should transfer part of the trade tee to the token creator', async () => {
      const ethAmount = parseEther('500');
      const expectedFee = await getTradeFee(launchpad, ethAmount);
      const expectedFeeShare = await getCreatorTradeFeeShare(launchpad, expectedFee);

      const initialEthBalance = await ethers.provider.getBalance(signers.user);

      const tx = await launchpad.connect(signers.anotherUser).buyTokens(tokenAddress, 0, { value: ethAmount });
      await tx.wait();

      expect(await ethers.provider.getBalance(signers.user)).to.be.equal(initialEthBalance + expectedFeeShare);
    });

    it('should emit a TokensBought event', async () => {
      const ethAmount = parseEther('500');
      const expectedFee = await getTradeFee(launchpad, ethAmount);
      const expectedTokensBought = parseEther('55558054.393305439330543934');

      const tx = await launchpad.connect(signers.anotherUser).buyTokens(tokenAddress, 0, { value: ethAmount });
      await tx.wait();

      await expect(tx)
        .to.emit(launchpad, 'TokensBought')
        .withArgs(tokenAddress, signers.anotherUser, expectedTokensBought, ethAmount, expectedFee);
    });

    it('should emit a MarketDataUpdated event', async () => {
      const ethAmount = parseEther('500');
      const expectedFee = await getTradeFee(launchpad, ethAmount);
      const expectedTokensBought = parseEther('55558054.393305439330543934');
      const expectedTokenPrice = parseEther('0.000009396113508663');

      const tx = await launchpad.connect(signers.anotherUser).buyTokens(tokenAddress, 0, { value: ethAmount });
      await tx.wait();

      const state = await launchpad.state();

      await expect(tx)
        .to.emit(launchpad, 'MarketDataUpdated')
        .withArgs(
          tokenAddress,
          ethAmount - expectedFee,
          state.bondingCurveSupply - expectedTokensBought,
          expectedTokenPrice,
        );
    });

    it('should create a liquidity pool when the token is migrated to the DEX', async () => {
      const tx = await launchpad
        .connect(signers.anotherUser)
        .buyTokens(tokenAddress, 0, { value: parseEther('30000') });
      await tx.wait();

      const state = await launchpad.state();

      expect(await mockPoolFactory.lastTokenA()).to.be.equal(tokenAddress);
      expect(await mockPoolFactory.lastTokenB()).to.be.equal(state.wrappedEth);
      expect(await mockPoolFactory.lastTickSpacing()).to.be.equal(state.tickSpacing);
      expect(await mockPoolFactory.lastSqrtPriceX96()).to.be.equal(
        ethers.parseEther('905108623506918018.107402018926872181'),
      );
    });

    it('should update market data with the liquidity pool address when the token is migrated to the DEX', async () => {
      const tx = await launchpad
        .connect(signers.anotherUser)
        .buyTokens(tokenAddress, 0, { value: parseEther('30000') });
      await tx.wait();

      const marketData = await launchpad.marketDataOf(tokenAddress);
      expect(marketData.dexPool).to.be.equal(MIGRATION_DEX_POOL);
    });

    it('should add liquidity to the liquidity pool when the token is migrated to the DEX', async () => {
      const tx = await launchpad
        .connect(signers.anotherUser)
        .buyTokens(tokenAddress, 0, { value: parseEther('30000') });
      await tx.wait();

      const state = await launchpad.state();

      const mintParams = await mockPositionManager.lastMintParams();
      expect(mintParams.token0).to.be.equal(tokenAddress);
      expect(mintParams.token1).to.be.equal(state.wrappedEth);
      expect(mintParams.tickSpacing).to.be.equal(state.tickSpacing);
      expect(mintParams.tickLower).to.be.equal(-887250);
      expect(mintParams.tickUpper).to.be.equal(887250);
      expect(mintParams.amount0Desired).to.be.equal(EXPECTED_TOKEN_LIQUIDITY);
      expect(mintParams.amount1Desired).to.be.equal(EXPECTED_ETH_LIQUIDITY);
      expect(mintParams.amount0Min).to.be.equal(0);
      expect(mintParams.amount1Min).to.be.equal(0);
      expect(mintParams.recipient).to.be.equal(FEE_RECIPIENT);
      expect(mintParams.deadline).to.be.greaterThan(0);
    });

    it('should transfer part of the remaining ETH to the fee recipient when the token is migrated to the DEX', async () => {
      let tx = await launchpad.connect(signers.deployer).setFeeParams(FEE_RECIPIENT, 0);
      await tx.wait();

      const state = await launchpad.state();

      const ethAmount = await launchpad.estimateEthToBuyTokens(tokenAddress, state.bondingCurveSupply);
      const expectedRemainingEthShare = await getFeeRecipientRemainingEthShare(launchpad, EXPECTED_REMAINING_ETH);

      const initialEthBalance = await ethers.provider.getBalance(FEE_RECIPIENT);

      tx = await launchpad.connect(signers.anotherUser).buyTokens(tokenAddress, 0, { value: ethAmount });
      await tx.wait();

      expect(await ethers.provider.getBalance(FEE_RECIPIENT)).to.be.equal(
        initialEthBalance + expectedRemainingEthShare,
      );
    });

    it('should transfer part of the remaining ETH to the token creator when the token is migrated to the DEX', async () => {
      let tx = await launchpad.connect(signers.deployer).setFeeParams(FEE_RECIPIENT, 0);
      await tx.wait();

      const state = await launchpad.state();

      const ethAmount = await launchpad.estimateEthToBuyTokens(tokenAddress, state.bondingCurveSupply);
      const expectedRemainingEthShare = await getCreatorMigrationRemainingEthShare(launchpad, EXPECTED_REMAINING_ETH);

      const initialEthBalance = await ethers.provider.getBalance(signers.user);

      tx = await launchpad.connect(signers.anotherUser).buyTokens(tokenAddress, 0, { value: ethAmount });
      await tx.wait();

      expect(await ethers.provider.getBalance(signers.user)).to.be.equal(initialEthBalance + expectedRemainingEthShare);
    });

    it('should unlock the token when the token is migrated to the DEX', async () => {
      const tx = await launchpad
        .connect(signers.anotherUser)
        .buyTokens(tokenAddress, 0, { value: parseEther('30000') });
      await tx.wait();

      const token = await ethers.getContractAt('Token', tokenAddress);
      expect(await token.isLocked()).to.be.false;
    });

    it('should emit a TokenMigrated event when the token is migrated to the DEX', async () => {
      const tx = await launchpad
        .connect(signers.anotherUser)
        .buyTokens(tokenAddress, 0, { value: parseEther('30000') });
      await tx.wait();

      await expect(tx)
        .to.emit(launchpad, 'TokenMigrated')
        .withArgs(
          tokenAddress,
          MIGRATION_DEX_POOL,
          MIGRATION_TOKEN_ID,
          EXPECTED_ETH_LIQUIDITY,
          EXPECTED_TOKEN_LIQUIDITY,
        );
    });
  });

  describe('sellTokens', () => {
    let tokenAddress: string;

    beforeEach(async () => {
      ({ tokenAddress } = await launchToken(launchpad, signers.user));

      let tx = await launchpad.connect(signers.anotherUser).buyTokens(tokenAddress, 0, { value: parseEther('500') });
      await tx.wait();

      const token = await ethers.getContractAt('Token', tokenAddress);
      tx = await token
        .connect(signers.anotherUser)
        .approve(launchpad.getAddress(), parseEther(Number.MAX_SAFE_INTEGER.toString()));
      await tx.wait();
    });

    it('should transfer ETH to the seller', async () => {
      const tokenAmount = parseEther('30000000');
      const expectedPayout = parseEther('271.071825212749331033');

      const initialEthBalance = await ethers.provider.getBalance(signers.anotherUser);

      const tx = await launchpad.connect(signers.anotherUser).sellTokens(tokenAddress, tokenAmount, 0);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Receipt is null');
      }

      expect(await ethers.provider.getBalance(signers.anotherUser)).to.be.equal(
        initialEthBalance - receipt.fee + expectedPayout,
      );
    });

    it('should transfer tokens to the Launchpad contract', async () => {
      const tokenAmount = parseEther('30000000');

      const tx = await launchpad.connect(signers.anotherUser).sellTokens(tokenAddress, tokenAmount, 0);
      const receipt = await tx.wait();
      if (!receipt) {
        throw new Error('Receipt is null');
      }

      const transfers = listTokenTransfers(tokenAddress, receipt);

      expect(transfers).to.deep.include({
        from: signers.anotherUser.address,
        to: await launchpad.getAddress(),
        value: tokenAmount,
      });
    });

    it('should update market data', async () => {
      const tokenAmount = parseEther('30000000');
      const expectedFee = parseEther('2.738099244573225565');
      const expectedPayout = parseEther('271.071825212749331033');
      const expectedTokenPrice = parseEther('0.000008865589280014');

      const initialMarketData = await launchpad.marketDataOf(tokenAddress);

      const tx = await launchpad.connect(signers.anotherUser).sellTokens(tokenAddress, tokenAmount, 0);
      await tx.wait();

      const state = await launchpad.state();

      const marketData = await launchpad.marketDataOf(tokenAddress);
      expect(marketData.tokenTotalSupply).to.be.equal(state.tokenTotalSupply);
      expect(marketData.bondingCurveSupply).to.be.equal(state.bondingCurveSupply);
      expect(marketData.ethReserve).to.be.equal(initialMarketData.ethReserve - expectedPayout - expectedFee);
      expect(marketData.ethVirtualReserve).to.be.equal(state.baseEthVirtualReserve);
      expect(marketData.tokenReserve).to.be.equal(initialMarketData.tokenReserve + tokenAmount);
      expect(marketData.tokenVirtualReserve).to.be.equal(state.baseTokenVirtualReserve);
      expect(marketData.tokenPrice).to.be.equal(expectedTokenPrice);
      expect(marketData.tokenFinalPrice).to.be.equal(EXPECTED_FINAL_TOKEN_PRICE);
      expect(marketData.dexPool).to.be.equal(ZeroAddress);
    });

    it('should transfer part of the trade tee to the fee recipient', async () => {
      const tokenAmount = parseEther('30000000');
      const expectedFee = parseEther('2.738099244573225565');
      const expectedFeeShare = await getFeeRecipientTradeFeeShare(launchpad, expectedFee);

      const initialEthBalance = await ethers.provider.getBalance(FEE_RECIPIENT);

      const tx = await launchpad.connect(signers.anotherUser).sellTokens(tokenAddress, tokenAmount, 0);
      await tx.wait();

      expect(await ethers.provider.getBalance(FEE_RECIPIENT)).to.be.equal(initialEthBalance + expectedFeeShare);
    });

    it('should transfer part of the trade tee to the token creator', async () => {
      const tokenAmount = parseEther('30000000');
      const expectedFee = parseEther('2.738099244573225565');
      const expectedFeeShare = await getCreatorTradeFeeShare(launchpad, expectedFee);

      const initialEthBalance = await ethers.provider.getBalance(signers.user);

      const tx = await launchpad.connect(signers.anotherUser).sellTokens(tokenAddress, tokenAmount, 0);
      await tx.wait();

      expect(await ethers.provider.getBalance(signers.user)).to.be.equal(initialEthBalance + expectedFeeShare);
    });

    it('should emit a TokenSold event', async () => {
      const tokenAmount = parseEther('30000000');
      const expectedFee = parseEther('2.738099244573225565');
      const expectedPayout = parseEther('271.071825212749331033');

      const tx = await launchpad.connect(signers.anotherUser).sellTokens(tokenAddress, tokenAmount, 0);

      await expect(tx)
        .to.emit(launchpad, 'TokensSold')
        .withArgs(tokenAddress, signers.anotherUser, tokenAmount, expectedPayout, expectedFee);
    });
  });
});
