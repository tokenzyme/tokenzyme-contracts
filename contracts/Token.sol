// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract Token is ERC20 {
  address public immutable deployer;
  address public immutable creator;
  bool public isLocked = true;

  error NotAllowedToUnlock();
  error TokenIsLocked();

  constructor(
    string memory name,
    string memory symbol,
    uint256 totalSupply,
    address _deployer,
    address _creator
  ) ERC20(name, symbol) {
    deployer = _deployer;
    creator = _creator;
    _mint(_deployer, totalSupply);
  }

  function burn(uint256 amount) public {
    _burn(msg.sender, amount);
  }

  function unlock() external {
    if (msg.sender != deployer) {
      revert NotAllowedToUnlock();
    }
    isLocked = false;
  }

  function _update(address from, address to, uint256 value) internal override {
    if (isLocked && from != address(0) && to != address(0)) {
      if (from != deployer && to != deployer) {
        revert TokenIsLocked();
      }
    }
    super._update(from, to, value);
  }
}
