// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interface/ITokenB.sol";
import "./interface/IUniswap.sol";
// https://docs.chain.link/data-feeds/price-feeds/addresses?network=ethereum&page=1#sepolia-testnet

error InvalidApr();
error ZeroAddress();
error InvalidToken();
error InvalidBlock();
error InvalidClaimTime();
error InvalidUnstakeTime();

contract Stake1 is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public tokenA;
    ITokenB public tokenB;
    IUniswapPair public pairA;
    IUniswapPair public pairB;

    bool internal isFirstA;
    bool internal isFirstB;

    address public constant WETH = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9;
    IUniswapFactory public constant UFactory =
        IUniswapFactory(0x7E0987E5b3a30e3f2828572Bb659A548460a3003);

    uint public constant UnstakeTime = 1 days;
    uint public constant ClaimTime = 1 hours;

    uint public fixedApr;

    mapping(address => UserInfo) public userInfo;
    struct UserInfo {
        uint stakeAmt;
        uint pendingReward;
        uint lastStakeTime;
        uint lastClaimTime;
    }

    event UpdateAPR(uint apr);
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

        // check pair exists
        address _pairA = UFactory.getPair(_tokenA, WETH);
        address _pairB = UFactory.getPair(_tokenB, WETH);
        if (_pairA == address(0) || _pairB == address(0)) revert InvalidToken();

        tokenA = IERC20(_tokenA);
        tokenB = ITokenB(_tokenB);

        pairA = IUniswapPair(_pairA);
        pairB = IUniswapPair(_pairB);

        address firstToken = pairA.token0();
        isFirstA = firstToken == _tokenA;

        firstToken = pairB.token0();
        isFirstB = firstToken == _tokenB;

        emit AddressUpdated(_tokenA, _tokenB);
    }

    function setApr(uint _apr) external onlyOwner {
        if (_apr > 1e3) revert InvalidApr();

        fixedApr = _apr;

        emit UpdateAPR(fixedApr);
    }

    function _getReserve(
        IUniswapPair pair
    )
        internal
        view
        returns (uint _reserveA, uint _reserveB, uint _lastBlockTime)
    {
        (_reserveA, _reserve1A, _lastBlockTime) = pair.getReserves();
    }

    function _getRate() internal view returns (uint _reserveA, uint _reserveB) {
        (
            uint _reserve0A,
            uint _reserve1A,
            uint _blockTimestampLastA
        ) = _getReserve(pairA);

        (
            uint _reserve0B,
            uint _reserve1B,
            uint _blockTimestampLastB
        ) = _getReserve(pairB);

        if (
            _blockTimestampLastA == block.timestamp ||
            _blockTimestampLastB == block.timestamp
        ) revert InvalidBlock();

        _reserveA =
            (isFirstA ? _reserve0A : _reserve1A) *
            (isFirstB ? _reserve1B : _reserve0B);
        _reserveB =
            (isFirstB ? _reserve0B : _reserve1B) *
            (isFirstA ? _reserve1A : _reserve0A);
    }

    function _calcReward(
        UserInfo memory info
    ) internal view returns (uint amountB) {
        (uint reserveA, uint reserveB) = _getRate();

        unchecked {
            amountB = (info.stakeAmt * 1e12 * reserveB) / reserveA;
            amountB =
                (amountB * (block.timestamp - info.lastClaimTime) * fixedApr) /
                (1e4 * 365 days);

            return (amountB / 1e12) + info.pendingReward;
        }
    }

    function stake(uint amount) external {
        if (amount == 0) return;

        // transfer token first
        tokenA.safeTransferFrom(msg.sender, address(this), amount);

        UserInfo storage info = userInfo[msg.sender];
        info.pendingReward = _calcReward(info);
        info.lastClaimTime = block.timestamp;
        info.lastStakeTime = block.timestamp;
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

        if (amount > 0) {
            // calculate reward amount
            uint rewardAmt = _calcReward(info);

            // update info
            if (info.stakeAmt == amount) delete userInfo[msg.sender];
            else {
                info.stakeAmt -= amount;

                if (rewardAmt != 0) {
                    // update user info
                    info.pendingReward = 0;
                    info.lastClaimTime = block.timestamp;
                }
            }

            // transfer tokenA
            tokenA.safeTransfer(msg.sender, amount);

            // mint tokenB
            if (rewardAmt != 0) tokenB.mint(msg.sender, rewardAmt);

            emit UserUnstake(msg.sender, amount);
        }
    }

    function harvest() external {
        UserInfo storage info = userInfo[msg.sender];

        // check unstake time
        if (info.lastClaimTime + ClaimTime > block.timestamp)
            revert InvalidClaimTime();

        uint rewardAmt = _calcReward(info);
        // mint tokenB
        if (rewardAmt != 0) {
            tokenB.mint(msg.sender, rewardAmt);

            // update user info
            info.pendingReward = 0;
            info.lastClaimTime = block.timestamp;
        }

        emit UserHarvest(msg.sender, rewardAmt);
    }
}
