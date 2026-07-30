// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol';

contract MockAggregatorV3Interface is AggregatorV3Interface {
  int256 _answer = 5e7;

  function setAnswer(int256 answer) external {
    _answer = answer;
  }

  function decimals() external pure override returns (uint8) {
    return 8;
  }

  function description() external pure override returns (string memory) {
    return 'ETH / USD Price Feed Mock';
  }

  function version() external pure override returns (uint256) {
    return 1;
  }

  function getRoundData(
    uint80 _roundId
  )
    external
    view
    override
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
  {
    roundId = _roundId;
    // 0.5 USD with 8 decimals
    answer = _answer;
    startedAt = block.timestamp - 60;
    updatedAt = block.timestamp;
    answeredInRound = _roundId;
  }

  function latestRoundData()
    external
    view
    override
    returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
  {
    return this.getRoundData(1);
  }
}
