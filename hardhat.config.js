require("@nomicfoundation/hardhat-toolbox");
const config = require('./config.json')

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: `https://eth-sepolia.g.alchemy.com/v2/${config.alchemy_key}`,
        enabled: true,
      }
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${config.alchemy_key}`,
      accounts: [config.p_key]
    }
  }
};
