// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '../../contracts/storages/LaunchpadStorage.sol';
import '../../contracts/Launchpad.sol';
import '../../contracts/Token.sol';

contract LaunchpadHarness is Launchpad {
  struct State {
    address wrappedEth;
    uint16 tradeFee;
    uint16 tradeFeeShare;
    uint16 migrationRemainingEthShare;
    uint256 tokenTotalSupply;
    uint256 bondingCurveSupply;
    uint256 baseEthVirtualReserve;
    uint256 baseTokenVirtualReserve;
    uint256 baseEthPriceInUsd;
    int24 tickSpacing;
  }

  function state() external view returns (State memory) {
    LaunchpadStorage.State storage currState = LaunchpadStorage.get();
    return
      State(
        currState.wrappedEth,
        currState.feeParams.tradeFee,
        currState.rewardParams.tradeFeeShare,
        currState.rewardParams.migrationRemainingEthShare,
        currState.supplyParams.tokenTotalSupply,
        currState.supplyParams.bondingCurveSupply,
        currState.reserveParams.baseEthVirtualReserve,
        currState.reserveParams.baseTokenVirtualReserve,
        currState.reserveParams.baseEthPriceInUsd,
        currState.dexParams.tickSpacing
      );
  }

  function marketDataOf(Token token) external view returns (LaunchpadStorage.MarketData memory) {
    return LaunchpadStorage.get().marketDataByToken[address(token)];
  }
}
