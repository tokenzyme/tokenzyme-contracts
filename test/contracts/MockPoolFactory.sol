// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '../../contracts/interfaces/external/IPoolFactory.sol';

contract MockPoolFactory is IPoolFactory {
  address public lastTokenA;
  address public lastTokenB;
  int24 public lastTickSpacing;
  uint160 public lastSqrtPriceX96;

  function createPool(
    address tokenA,
    address tokenB,
    int24 tickSpacing,
    uint160 sqrtPriceX96
  ) external returns (address) {
    lastTokenA = tokenA;
    lastTokenB = tokenB;
    lastTickSpacing = tickSpacing;
    lastSqrtPriceX96 = sqrtPriceX96;

    return address(1);
  }
}
