// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

library LaunchpadStorage {
  // keccak256("launchpad.storage") = 0x601b43b3e147e0f5e42cb4bbf57b6e960c79231c1f7ff223372b929a754d52df
  // STORAGE_SLOT = keccak256(...) & ~bytes32(uint256(0xff))
  bytes32 internal constant STORAGE_SLOT = 0x601b43b3e147e0f5e42cb4bbf57b6e960c79231c1f7ff223372b929a754d5200;

  error TokenNotRegistered(address token);

  struct FeeParams {
    address feeRecipient;
    uint16 tradeFee;
  }

  struct RewardParams {
    uint16 tradeFeeShare;
    uint16 migrationRemainingEthShare;
  }

  struct SupplyParams {
    uint256 tokenTotalSupply;
    uint256 bondingCurveSupply;
  }

  struct ReserveParams {
    uint256 baseEthVirtualReserve;
    uint256 baseTokenVirtualReserve;
    uint256 baseEthPriceInUsd;
  }

  struct DexParams {
    address poolFactory;
    address positionManager;
    int24 tickSpacing;
  }

  struct MarketData {
    uint256 tokenTotalSupply;
    uint256 bondingCurveSupply;
    uint256 ethReserve;
    uint256 ethVirtualReserve;
    uint256 tokenReserve;
    uint256 tokenVirtualReserve;
    uint256 tokenPrice;
    uint256 tokenFinalPrice;
    address dexPool;
  }

  struct State {
    bool isMarketPaused;
    address priceFeed;
    address wrappedEth;
    FeeParams feeParams;
    RewardParams rewardParams;
    SupplyParams supplyParams;
    ReserveParams reserveParams;
    DexParams dexParams;
    mapping(address => MarketData) marketDataByToken;
  }

  function get() internal pure returns (State storage $) {
    bytes32 slot = STORAGE_SLOT;
    assembly {
      $.slot := slot
    }
  }

  function marketDataOf(State storage state, IERC20 token) internal view returns (LaunchpadStorage.MarketData storage) {
    MarketData storage marketData = state.marketDataByToken[address(token)];
    if (marketData.tokenTotalSupply == 0) {
      revert TokenNotRegistered(address(token));
    }
    return marketData;
  }
}
