import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { ContractTransactionReceipt, ContractTransactionResponse, parseEther } from 'ethers';
import { ethers } from 'hardhat';

import { Launchpad, Launchpad__factory, Token__factory } from '../../typechain';
import { TokenInfoStruct, TokenLaunchedEvent } from '../../typechain/contracts/Launchpad';
import { TransferEvent } from '../../typechain/contracts/Token';
import { LaunchpadHarness, LaunchpadStorage } from '../../typechain/test/contracts/LaunchpadHarness';

const DECIMALS = parseEther('1');

interface LaunchTokenArgs {
  name: string;
  symbol: string;
  info: TokenInfoStruct;
  msgValue: bigint;
}

export interface LaunchedToken {
  tokenAddress: string;
  tx: ContractTransactionResponse;
  receipt: ContractTransactionReceipt;
}

const getLaunchTokenArgs = (args?: Partial<LaunchTokenArgs>): LaunchTokenArgs => ({
  ...{
    name: 'Token',
    symbol: 'TOKEN',
    info: {
      description: 'Description of Token',
      logoUrl: 'https://token.com/logo.jpg',
      websiteUrl: 'https://token.com',
      socialMedia: {
        xUrl: 'https://x.com/token',
        telegramUrl: 'https://t.me/token',
        discordUrl: 'https://discord.gg/token',
        redditUrl: 'https://reddit.com/r/token',
        facebookUrl: 'https://facebook.com/token',
        instagramUrl: 'https://instagram.com/token',
      },
    },
    msgValue: ethers.parseEther('0'),
  },
  ...args,
});

export const launchToken = async (
  launchpad: Launchpad,
  user: HardhatEthersSigner,
  args?: Partial<LaunchTokenArgs>,
): Promise<LaunchedToken> => {
  const launchArgs = getLaunchTokenArgs(args);
  const tx = await launchpad
    .connect(user)
    .launchToken(launchArgs.name, launchArgs.symbol, launchArgs.info, { value: launchArgs.msgValue });
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error('Transaction receipt not found');
  }

  const launchpadInterface = Launchpad__factory.createInterface();
  const event = launchpadInterface.getEvent('TokenLaunched');
  const log = receipt.logs.find((curr) => curr.topics[0] === event.topicHash);
  if (!log) {
    throw new Error('TokenLaunched event not found');
  }

  const outputObject = launchpadInterface
    .decodeEventLog(event, log.data, log.topics)
    .toObject() as TokenLaunchedEvent.OutputObject;

  return {
    tokenAddress: outputObject.token,
    tx,
    receipt,
  };
};

export const getFinalMarketCap = (
  marketData: LaunchpadStorage.MarketDataStructOutput,
  ethPriceInUsd: bigint,
): bigint => {
  return (marketData.tokenFinalPrice * marketData.tokenTotalSupply * ethPriceInUsd) / (DECIMALS * DECIMALS);
};

export const getTradeFee = async (launchpad: LaunchpadHarness, ethAmount: bigint): Promise<bigint> => {
  const state = await launchpad.state();
  return (ethAmount * state.tradeFee) / 10_000n;
};

export const getCreatorTradeFeeShare = async (launchpad: LaunchpadHarness, fee: bigint): Promise<bigint> => {
  const state = await launchpad.state();
  return (fee * state.tradeFeeShare) / 10_000n;
};

export const getFeeRecipientTradeFeeShare = async (launchpad: LaunchpadHarness, fee: bigint): Promise<bigint> => {
  const creatorFeeShare = await getCreatorTradeFeeShare(launchpad, fee);
  return fee - creatorFeeShare;
};

export const getCreatorMigrationRemainingEthShare = async (
  launchpad: LaunchpadHarness,
  remainingEth: bigint,
): Promise<bigint> => {
  const state = await launchpad.state();
  return (remainingEth * state.migrationRemainingEthShare) / 10_000n;
};

export const getFeeRecipientRemainingEthShare = async (
  launchpad: LaunchpadHarness,
  remainingEth: bigint,
): Promise<bigint> => {
  const creatorEthShare = await getCreatorMigrationRemainingEthShare(launchpad, remainingEth);
  return remainingEth - creatorEthShare;
};

export const listTokenTransfers = (
  tokenAddress: string,
  receipt: ContractTransactionReceipt,
): TransferEvent.OutputObject[] => {
  const tokenInterface = Token__factory.createInterface();
  const transferEvent = tokenInterface.getEvent('Transfer');
  return receipt.logs
    .filter((curr) => curr.address === tokenAddress && curr.topics[0] === transferEvent.topicHash)
    .map(
      (log) =>
        tokenInterface.decodeEventLog(transferEvent, log.data, log.topics).toObject() as TransferEvent.OutputObject,
    );
};
