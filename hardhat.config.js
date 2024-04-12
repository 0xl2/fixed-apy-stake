require('dotenv')
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.alchemy_key}`,
        enabled: true,
      }
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.alchemy_key}`,
      accounts: [process.env.p_key]
    }
  },
  etherscan: {
    apiKey: process.env.etherscan_key,
  },
};
