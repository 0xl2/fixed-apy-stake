// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

// https://docs.chain.link/data-feeds/price-feeds/addresses?network=ethereum&page=1#sepolia-testnet

interface IPriceFeed {
    struct RoundInfo {
        uint80 roundId, 
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    }

    function latestAnswer() external view returns(uint);

    function latestRoundData() external view returns(latestRoundData roundData);
}

contract PriceOracle {
    IPriceFeed public constant priceFeed = IPriceFeed(0x694AA1769357215DE4FAC081bf1f309aDC325306);

    uint8 public constant decimal = 8;

    function getPrice() external view returns(uint, uint8) {
        uint latestPrice = priceFeed.latestAnswer();

        return (latestPrice, decimal);
    }
}
