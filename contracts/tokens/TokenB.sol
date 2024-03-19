// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

error NotAllowed();
error ZeroAddress();

contract TokenB is ERC20, Ownable {
    address public stake;

    event Mint(address indexed user, uint amount);
    event SetStake(address indexed stakeAddress);

    constructor() ERC20("TokenB", "TKB") Ownable(msg.sender) {
        _mint(msg.sender, 1e21);
    }

    function setStake(address _stake) external onlyOwner {
        if (_stake == address(0)) revert ZeroAddress();

        stake = _stake;

        emit SetStake(stake);
    }

    function mint(address user, uint amount) external {
        if (msg.sender != stake) revert NotAllowed();

        _mint(user, amount);

        emit Mint(user, amount);
    }
}
