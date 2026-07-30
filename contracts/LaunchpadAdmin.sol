// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import './storages/LaunchpadStorage.sol';

abstract contract LaunchpadAdmin is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuardUpgradeable {
  uint16 private constant DEFAULT_TRADE_FEE = 1_00;
  uint16 private constant DEFAULT_TRADE_FEE_SHARE = 50;
  uint16 private constant DEFAULT_MIGRATION_REMAINING_ETH_SHARE = 50_00;
  uint256 private constant DEFAULT_TOTAL_SUPPLY = 1_000_000_000 ether;
  uint256 private constant DEFAULT_BONDING_CURVE_SUPPLY = 800_000_000 ether;
  uint256 private constant DEFAULT_BASE_ETH_VIRTUAL_RESERVE = 9065 ether;
  uint256 private constant DEFAULT_BASE_TOKEN_VIRTUAL_RESERVE = 273_000_000 ether;
  uint256 private constant DEFAULT_BASE_ETH_PRICE_IN_USD = 0.5 ether;
  int24 private constant DEFAULT_TICK_SPACING = 50;

  event PriceFeedUpdated(address indexed priceFeed);
  event WrappedEthUpdated(address indexed wrappedEth);
  event FeeParamsUpdated(address indexed feeRecipient, uint16 tradeFee);
  event RewardParamsUpdated(uint16 tradeFeeShare, uint16 migrationRemainingEthShare);
  event SupplyParamsUpdated(uint256 tokenTotalSupply, uint256 bondingCurveSupply);
  event ReserveParamsUpdated(uint256 baseEthVirtualReserve, uint256 baseTokenVirtualReserve, uint256 baseEthPriceInUsd);
  event DexParamsUpdated(address indexed poolFactory, address indexed positionManager, int24 tickSpacing);
  event IsMarketPausedUpdated(bool isMarketPaused);

  error InvalidPriceFeed();
  error InvalidWrappedEth();
  error InvalidFeeParams();
  error InvalidRewardParams();
  error InvalidSupplyParams();
  error InvalidDexParams();

  function initialize(
    address feeRecipient,
    address priceFeed,
    address wrappedEth,
    address dexPoolFactory,
    address dexPositionManager
  ) external initializer {
    __Ownable_init(msg.sender);
    __UUPSUpgradeable_init();
    __ReentrancyGuard_init();

    LaunchpadStorage.State storage state = LaunchpadStorage.get();
    state.priceFeed = priceFeed;
    state.wrappedEth = wrappedEth;
    state.feeParams = LaunchpadStorage.FeeParams(feeRecipient, DEFAULT_TRADE_FEE);
    state.rewardParams = LaunchpadStorage.RewardParams(DEFAULT_TRADE_FEE_SHARE, DEFAULT_MIGRATION_REMAINING_ETH_SHARE);
    state.supplyParams = LaunchpadStorage.SupplyParams(DEFAULT_TOTAL_SUPPLY, DEFAULT_BONDING_CURVE_SUPPLY);
    state.reserveParams = LaunchpadStorage.ReserveParams(
      DEFAULT_BASE_ETH_VIRTUAL_RESERVE,
      DEFAULT_BASE_TOKEN_VIRTUAL_RESERVE,
      DEFAULT_BASE_ETH_PRICE_IN_USD
    );
    state.dexParams = LaunchpadStorage.DexParams(dexPoolFactory, dexPositionManager, DEFAULT_TICK_SPACING);
  }

  function setIsMarketPaused(bool isMarketPaused) external onlyOwner {
    LaunchpadStorage.get().isMarketPaused = isMarketPaused;
    emit IsMarketPausedUpdated(isMarketPaused);
  }

  function setPriceFeed(address priceFeed) external onlyOwner {
    if (priceFeed == address(0)) {
      revert InvalidPriceFeed();
    }
    LaunchpadStorage.get().priceFeed = priceFeed;
    emit PriceFeedUpdated(priceFeed);
  }

  function setWrappedEth(address wrappedEth) external onlyOwner {
    if (wrappedEth == address(0)) {
      revert InvalidWrappedEth();
    }
    LaunchpadStorage.get().wrappedEth = wrappedEth;
    emit WrappedEthUpdated(wrappedEth);
  }

  function setFeeParams(address feeRecipient, uint16 tradeFee) external onlyOwner {
    if (feeRecipient == address(0) || tradeFee > 100_00) {
      revert InvalidFeeParams();
    }
    LaunchpadStorage.get().feeParams = LaunchpadStorage.FeeParams(feeRecipient, tradeFee);
    emit FeeParamsUpdated(feeRecipient, tradeFee);
  }

  function setRewardParams(uint16 tradeFeeShare, uint16 migrationRemainingEthShare) external onlyOwner {
    if (tradeFeeShare > 100_00 || migrationRemainingEthShare > 100_00) {
      revert InvalidRewardParams();
    }
    LaunchpadStorage.get().rewardParams = LaunchpadStorage.RewardParams(tradeFeeShare, migrationRemainingEthShare);
    emit RewardParamsUpdated(tradeFeeShare, migrationRemainingEthShare);
  }

  function setSupplyParams(uint256 tokenTotalSupply, uint256 bondingCurveSupply) external onlyOwner {
    if (tokenTotalSupply == 0 || bondingCurveSupply == 0 || bondingCurveSupply >= tokenTotalSupply) {
      revert InvalidSupplyParams();
    }
    LaunchpadStorage.State storage state = LaunchpadStorage.get();
    state.supplyParams = LaunchpadStorage.SupplyParams(tokenTotalSupply, bondingCurveSupply);
    emit SupplyParamsUpdated(tokenTotalSupply, bondingCurveSupply);
  }

  function setReserveParams(
    uint256 baseEthVirtualReserve,
    uint256 baseTokenVirtualReserve,
    uint256 baseEthPriceInUsd
  ) external onlyOwner {
    LaunchpadStorage.State storage state = LaunchpadStorage.get();
    state.reserveParams = LaunchpadStorage.ReserveParams(
      baseEthVirtualReserve,
      baseTokenVirtualReserve,
      baseEthPriceInUsd
    );
    emit ReserveParamsUpdated(baseEthVirtualReserve, baseTokenVirtualReserve, baseEthPriceInUsd);
  }

  function setDexParams(address poolFactory, address positionManager, int24 tickSpacing) external onlyOwner {
    if (poolFactory == address(0) || positionManager == address(0)) {
      revert InvalidDexParams();
    }
    LaunchpadStorage.State storage state = LaunchpadStorage.get();
    state.dexParams = LaunchpadStorage.DexParams(poolFactory, positionManager, tickSpacing);
    emit DexParamsUpdated(poolFactory, positionManager, tickSpacing);
  }

  function _authorizeUpgrade(address implementation) internal override onlyOwner {}
}
