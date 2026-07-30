// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@openzeppelin/contracts/utils/math/Math.sol';
import '../interfaces/external/INonfungiblePositionManager.sol';
import '../interfaces/external/IPoolFactory.sol';
import '../interfaces/external/IWrappedEth.sol';
import '../storages/LaunchpadStorage.sol';
import '../Token.sol';

library DexUtils {
  int24 private constant MIN_TICK = -887272;
  int24 private constant MAX_TICK = 887272;

  error NoEthLiquidityForMigration(uint256 expected, uint256 available);
  error NoTokenLiquidityForMigration(uint256 expected, uint256 available);

  function migrateToken(
    LaunchpadStorage.State storage state,
    LaunchpadStorage.MarketData storage marketData,
    Token token,
    uint256 ethBalance,
    uint256 tokenBalance
  ) internal returns (address pool, uint256 tokenId, uint256 ethLiquidity, uint256 tokenLiquidity) {
    uint256 availableEth = marketData.ethReserve;
    if (ethBalance < availableEth) {
      revert NoEthLiquidityForMigration(availableEth, ethBalance);
    }

    uint256 availableTokens = marketData.tokenTotalSupply - marketData.bondingCurveSupply + marketData.tokenReserve;
    if (tokenBalance < availableTokens) {
      revert NoTokenLiquidityForMigration(availableTokens, tokenBalance);
    }

    address positionManager = state.dexParams.positionManager;
    int24 tickSpacing = state.dexParams.tickSpacing;
    uint256 tokenPrice = marketData.tokenPrice;

    address wEthAddress = state.wrappedEth;
    address tokenAddress = address(token);

    (address token0, address token1) = wEthAddress < tokenAddress
      ? (wEthAddress, tokenAddress)
      : (tokenAddress, wEthAddress);

    uint160 sqrtPriceX96 = uint160(Math.mulDiv(Math.sqrt(Math.mulDiv(tokenPrice, 1e18, 1)), 2 ** 96, 1e9));

    pool = IPoolFactory(state.dexParams.poolFactory).createPool(token0, token1, tickSpacing, sqrtPriceX96);

    ethLiquidity = _calculateEthLiquidity(tokenPrice, availableEth, availableTokens);
    tokenLiquidity = Math.mulDiv(ethLiquidity, 1e18, tokenPrice);

    IWrappedEth wEth = IWrappedEth(wEthAddress);
    wEth.deposit{value: ethLiquidity}();
    wEth.approve(positionManager, ethLiquidity);

    token.approve(positionManager, tokenLiquidity);

    (uint256 amount0Desired, uint256 amount1Desired) = wEthAddress < tokenAddress
      ? (ethLiquidity, tokenLiquidity)
      : (tokenLiquidity, ethLiquidity);

    (tokenId, , , ) = INonfungiblePositionManager(positionManager).mint(
      INonfungiblePositionManager.MintParams({
        token0: token0,
        token1: token1,
        tickSpacing: tickSpacing,
        tickLower: (MIN_TICK / tickSpacing) * tickSpacing,
        tickUpper: (MAX_TICK / tickSpacing) * tickSpacing,
        amount0Desired: amount0Desired,
        amount1Desired: amount1Desired,
        amount0Min: 0,
        amount1Min: 0,
        recipient: state.feeParams.feeRecipient,
        deadline: block.timestamp + 600
      })
    );
  }

  function _calculateEthLiquidity(
    uint256 tokenPrice,
    uint256 availableEth,
    uint256 availableTokens
  ) private pure returns (uint256) {
    uint256 ethLiquidity = Math.mulDiv(availableTokens, tokenPrice, 1e18);
    return ethLiquidity <= availableEth ? ethLiquidity : availableEth;
  }
}
