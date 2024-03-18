// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interface/ITokenB.sol";

error ZeroAddress();
error InvalidClaimTime();
error InvalidUnstakeTime();

contract Stake is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public tokenA;
    ITokenB public tokenB;

    uint public constant UnstakeTime = 1 days;
    uint public constant ClaimTime = 1 hours;

    mapping(address => UserInfo) public userInfo;
    struct UserInfo {
        uint stakeAmt;
        uint pendingReward;
        uint lastStakeTime;
        uint lastClaimTime;
    }

    event AddressUpdated(address indexed aToken, address indexed bToken);
    event UserStake(address indexed user, uint amount);
    event UserUnstake(address indexed user, uint amount);
    event UserHarvest(address indexed user, uint amount);

    constructor(address _tokenA, address _tokenB) Ownable(msg.sender) {
        setTokens(_tokenA, _tokenB);
    }

    function setTokens(address _tokenA, address _tokenB) public onlyOwner {
        if (_tokenA == address(0) || _tokenB == address(0))
            revert ZeroAddress();

        tokenA = IERC20(_tokenA);
        tokenB = ITokenB(_tokenB);

        emit AddressUpdated(_tokenA, _tokenB);
    }

    function _calcReward(uint amount) internal returns (uint) {}

    function stake(uint amount) external {
        if (amount == 0) return;

        // transfer token first
        tokenA.safeTransferFrom(msg.sender, address(this), amount);

        UserInfo storage info = userInfo[msg.sender];

        info.lastStakeTime = block.timestamp;
        info.pendingReward = _calcReward(info.stakeAmt);
        info.stakeAmt += amount;

        emit UserStake(msg.sender, amount);
    }

    function unstake(uint amount) external {
        if (amount == 0) return;

        UserInfo storage info = userInfo[msg.sender];

        // check unstake time
        if (info.lastStakeTime + UnstakeTime > block.timestamp)
            revert InvalidUnstakeTime();

        // check unstake amount
        if (amount > info.stakeAmt) amount = info.stakeAmt;

        // calculate reward amount
        uint rewardAmt = _calcReward(info.stakeAmt);

        // update info
        if (info.stakeAmt == amount) delete userInfo[msg.sender];
        else info.stakeAmt -= amount;

        // transfer tokenA
        tokenA.safeTransfer(msg.sender, amount);

        // mint tokenB
        if (rewardAmt != 0) tokenB.mint(msg.sender, rewardAmt);

        emit UserUnstake(msg.sender, amount);
    }

    function harvest() external {
        UserInfo storage info = userInfo[msg.sender];

        // check unstake time
        if (info.lastClaimTime + ClaimTime > block.timestamp)
            revert InvalidClaimTime();

        uint rewardAmt = _calcReward(info.stakeAmt);
        // mint tokenB
        if (rewardAmt != 0) tokenB.mint(msg.sender, rewardAmt);

        // update user info
        info.pendingReward = 0;
        info.lastClaimTime = block.timestamp;

        emit UserHarvest(msg.sender, rewardAmt);
    }
}
