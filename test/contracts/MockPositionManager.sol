// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '../../contracts/interfaces/external/INonfungiblePositionManager.sol';

contract MockPositionManager is INonfungiblePositionManager {
  MintParams public lastMintParams;

  function mint(
    MintParams calldata params
  ) external payable override returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) {
    lastMintParams = params;

    tokenId = 1;
    liquidity = 0;
    amount0 = params.amount0Desired;
    amount1 = params.amount1Desired;
  }
}
