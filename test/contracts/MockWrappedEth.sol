// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '../../contracts/interfaces/external/IWrappedEth.sol';

contract MockWrappedEth is IWrappedEth, ERC20 {
  address public lastSender;
  uint256 public lastValue;

  constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

  function deposit() external payable {
    lastSender = msg.sender;
    lastValue = msg.value;
    _mint(msg.sender, msg.value);
  }
}
