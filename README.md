### Fixed APY Stake

# Setup

Create config.json and fill out this values

```bash
{
    "p_key": "your_private_key",
    "alchemy_key": "alchemy_key",
    "etherscan_key": "etherscan_key"
}
```

Then run:

```bash
npm install
// or
yarn install
```

# Running

Try running some of the following tasks:

```shell
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.js
```

# Unit test

# Deployed Addresses

TokenA address: [0xD48c23172e05291E07f689F5a204Cc8E41AF9008](https://sepolia.etherscan.io/address/0xD48c23172e05291E07f689F5a204Cc8E41AF9008)
TokenB address: [0x9b3b5cb46859C0A0Ca05Db539CD5c0DcD2D55315](https://sepolia.etherscan.io/address/0x9b3b5cb46859C0A0Ca05Db539CD5c0DcD2D55315)
Stake address: [0xa6048f396c140b63a91e784fd638f2388c3c62fc](https://sepolia.etherscan.io/address/0xa6048f396c140b63a91e784fd638f2388c3c62fc)
