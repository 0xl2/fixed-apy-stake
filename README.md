### Fixed APY Stake

# Setup

Create config.json and fill out this values

```bash
{
    "p_key": "your_private_key",
    "alchemy_key": "alchemy_key"
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
