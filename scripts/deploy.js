const { ethers } = require("hardhat");

const factoryAddr = "0x7E0987E5b3a30e3f2828572Bb659A548460a3003"
const routerAddr = "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008"
const WETH = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9"

function getTime() {
    return (Math.floor(Date.now() / 1000) + 7200)
}

async function main() {
    const [owner] = await ethers.getSigners();

    // deploy tokenA
    const TokenA = await ethers.getContractFactory("TokenA");
    const tokenA = await TokenA.deploy();
    await tokenA.waitForDeployment();
    const aTtokenAddr = (await tokenA.getAddress()).toLowerCase();

    // deploy TokenB
    const TokenB = await ethers.getContractFactory("TokenB");
    const tokenB = await TokenB.deploy();
    await tokenB.waitForDeployment();
    const bTokenAddr = (await tokenB.getAddress()).toLowerCase();

    // create pair
    const factory = await ethers.getContractAt("IUniswapFactory", factoryAddr);
    const router = await ethers.getContractAt("IUniswapRouter", routerAddr)
    await factory.createPair(WETH, aTtokenAddr);
    await factory.createPair(WETH, bTokenAddr);

    // add liquidity
    await tokenA.connect(owner).approve(routerAddr, parseEther("10000"))
    await router.connect(owner).addLiquidityETH(
        aTtokenAddr,
        parseEther("10000"),
        0,
        0,
        owner.address,
        getTime(),
        {
            value: parseEther("1")
        }
    )

    await tokenB.connect(owner).approve(routerAddr, parseEther("1000"))
    await router.connect(owner).addLiquidityETH(
        bTokenAddr,
        parseEther("1000"),
        0,
        0,
        owner.address,
        getTime(),
        {
            value: parseEther("1")
        }
    )

    // deploy Stake contract
    const StakeContract = await ethers.getContractFactory("Stake");
    const stake = await StakeContract.deploy(aTtokenAddr, bTokenAddr);
    await stake.waitForDeployment()
    const stakeAddr = (await stake.getAddress()).toLowerCase()

    // set apr
    await stake.setApr(1e3);

    // set stake in tokenB
    await tokenB.setStake(stakeAddr);

    console.log(`TokenA address: ${aTtokenAddr}`)
    console.log(`TokenB address: ${bTokenAddr}`)
    console.log(`Stake address: ${stakeAddr}`)
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});