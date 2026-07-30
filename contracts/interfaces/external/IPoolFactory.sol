// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.28;

interface IPoolFactory {
  function createPool(
    address tokenA,
    address tokenB,
    int24 tickSpacing,
    uint160 sqrtPriceX96
  ) external returns (address);
}
