// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '../structs/TokenInfo.sol';
import '../Token.sol';

interface ILaunchpad {
  function bondingCurveSupply() external view returns (uint256);

  function launchToken(
    string memory name,
    string memory symbol,
    TokenInfo memory info
  ) external payable returns (Token);

  function buyTokens(Token token, uint256 minExpectedTokens) external payable returns (uint256);

  function sellTokens(Token token, uint256 tokenAmount, uint256 minExpectedEth) external returns (uint256);

  function estimateFirstTokensToBuy(uint256 ethAmount) external view returns (uint256);

  function estimateTokensToBuy(Token token, uint256 ethAmount) external view returns (uint256);

  function estimateEthToBuyTokens(Token token, uint256 tokenAmount) external view returns (uint256);

  function estimateEthForSellingTokens(Token token, uint256 tokenAmount) external view returns (uint256);
}
