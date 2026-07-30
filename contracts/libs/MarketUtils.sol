// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '../storages/LaunchpadStorage.sol';

library MarketUtils {
  error InvalidEthPrice();

  function calculateVirtualReserves(
    LaunchpadStorage.State storage state
  ) internal view returns (uint256 ethVirtualReserve, uint256 tokenVirtualReserve) {
    AggregatorV3Interface priceFeed = AggregatorV3Interface(state.priceFeed);

    (, int256 answer, , , ) = priceFeed.latestRoundData();

    if (answer == 0) {
      revert InvalidEthPrice();
    }

    uint256 ethPriceInUsd = Math.mulDiv(uint256(answer), 1e18, 10 ** priceFeed.decimals());

    LaunchpadStorage.ReserveParams storage reserveParams = state.reserveParams;
    uint256 baseEthVirtualReserve = reserveParams.baseEthVirtualReserve;
    uint256 tokenVirtualReserveBase = reserveParams.baseTokenVirtualReserve;
    uint256 baseEthPriceInUsd = reserveParams.baseEthPriceInUsd;

    if (ethPriceInUsd <= baseEthPriceInUsd) {
      return (baseEthVirtualReserve, tokenVirtualReserveBase);
    }

    uint256 step = 1e17;
    uint256 stepsAbove = Math.mulDiv(ethPriceInUsd - baseEthPriceInUsd, 1, step);
    uint256 referencePriceInUsd = baseEthPriceInUsd + Math.mulDiv(stepsAbove, step, 1);

    ethVirtualReserve = Math.mulDiv(baseEthVirtualReserve, baseEthPriceInUsd, referencePriceInUsd);
    tokenVirtualReserve = tokenVirtualReserveBase;
  }

  function priceOf(LaunchpadStorage.MarketData storage marketData) internal view returns (uint256) {
    return
      _getAmountIn(
        1 ether,
        marketData.ethReserve + marketData.ethVirtualReserve,
        marketData.tokenReserve + marketData.tokenVirtualReserve
      );
  }

  function finalPriceOf(LaunchpadStorage.MarketData storage marketData) internal view returns (uint256) {
    uint256 cost = _getAmountIn(
      marketData.bondingCurveSupply,
      marketData.ethVirtualReserve,
      marketData.tokenReserve + marketData.tokenVirtualReserve
    );
    return _getAmountIn(1 ether, cost + marketData.ethVirtualReserve, marketData.tokenVirtualReserve);
  }

  function estimateFirstTokensToBuy(
    LaunchpadStorage.State storage state,
    uint256 ethAmount
  ) internal view returns (uint256) {
    uint256 fee = _calculateFee(ethAmount, state.feeParams.tradeFee);
    (uint256 ethVirtualReserve, uint256 tokenVirtualReserve) = calculateVirtualReserves(state);
    uint256 netEthAmount = ethAmount - fee;
    uint256 tokensToBuy = _getAmountOut(
      netEthAmount,
      ethVirtualReserve,
      state.supplyParams.bondingCurveSupply + tokenVirtualReserve
    );
    return tokensToBuy;
  }

  function estimateTokensToBuy(
    LaunchpadStorage.MarketData storage marketData,
    LaunchpadStorage.State storage state,
    uint256 ethAmount
  ) internal view returns (uint256 tokensToBuy, uint256 fee) {
    fee = _calculateFee(ethAmount, state.feeParams.tradeFee);
    uint256 netEthAmount = ethAmount - fee;
    tokensToBuy = _getAmountOut(
      netEthAmount,
      marketData.ethReserve + marketData.ethVirtualReserve,
      marketData.tokenReserve + marketData.tokenVirtualReserve
    );
  }

  function estimateEthToBuyTokens(
    LaunchpadStorage.MarketData storage marketData,
    LaunchpadStorage.State storage state,
    uint256 tokenAmount
  ) internal view returns (uint256 ethToBuyTokens, uint256 fee) {
    uint256 netEthAmount = _getAmountIn(
      tokenAmount,
      marketData.ethReserve + marketData.ethVirtualReserve,
      marketData.tokenReserve + marketData.tokenVirtualReserve
    );
    ethToBuyTokens = Math.mulDiv(netEthAmount, 100_00, 100_00 - state.feeParams.tradeFee);
    fee = ethToBuyTokens - netEthAmount;
  }

  function estimateEthForSellingTokens(
    LaunchpadStorage.MarketData storage marketData,
    LaunchpadStorage.State storage state,
    uint256 tokenAmount
  ) internal view returns (uint256 ethForSellingTokens, uint256 fee) {
    uint256 ethAmount = _getAmountOut(
      tokenAmount,
      marketData.tokenReserve + marketData.tokenVirtualReserve,
      marketData.ethReserve + marketData.ethVirtualReserve
    );
    fee = _calculateFee(ethAmount, state.feeParams.tradeFee);
    ethForSellingTokens = ethAmount - fee;
  }

  function _getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) private pure returns (uint256) {
    uint256 k = Math.mulDiv(reserveIn, reserveOut, 1);
    uint256 newReserveIn = reserveIn + amountIn;
    uint256 newReserveOut = Math.mulDiv(k, 1, newReserveIn);
    return reserveOut - newReserveOut;
  }

  function _getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) private pure returns (uint256) {
    uint256 k = Math.mulDiv(reserveIn, reserveOut, 1);
    uint256 newReserveOut = reserveOut - amountOut;
    uint256 newReserveIn = Math.mulDiv(k, 1, newReserveOut);
    return newReserveIn - reserveIn;
  }

  function _calculateFee(uint256 amount, uint16 tradeFee) private pure returns (uint256) {
    return Math.mulDiv(amount, tradeFee, 100_00);
  }
}
