const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseEther, ZeroAddress, toBigInt } = require("ethers");

const factoryAddr = "0x7E0987E5b3a30e3f2828572Bb659A548460a3003"
const routerAddr = "0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008"
const WETH = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9"

function getTime() {
  return (Math.floor(Date.now() / 1000) + 7200)
}

function checkApr(aTokenAmt, bTokenAmt, isDay = false) {
  const yearAmt = toBigInt(bTokenAmt) * (isDay ? 1n : 24n) * 365n;

  // tokenA : tokenB = 10 : 1
  expect(aTokenAmt).to.be.within(
    yearAmt * 100n * 99n / 100n,
    yearAmt * 100n * 101n / 100n
  )
}

describe("Stake Contract testing", function () {
  before("Deploy contracts", async function () {
    const [owner, alice, bob] = await ethers.getSigners();

    this.owner = owner;
    this.alice = alice;
    this.bob = bob;

    // deploy tokenA
    const TokenA = await ethers.getContractFactory("TokenA");
    this.tokenA = await TokenA.deploy();
    await this.tokenA.waitForDeployment();
    this.tokenAAddr = (await this.tokenA.getAddress()).toLowerCase();

    // deploy TokenB
    const TokenB = await ethers.getContractFactory("TokenB");
    this.tokenB = await TokenB.deploy();
    await this.tokenB.waitForDeployment();
    this.tokenBAddr = (await this.tokenB.getAddress()).toLowerCase();

    // create pair
    const factory = await ethers.getContractAt("IUniswapFactory", factoryAddr);
    const router = await ethers.getContractAt("IUniswapRouter", routerAddr)
    await factory.createPair(WETH, this.tokenAAddr);
    await factory.createPair(WETH, this.tokenBAddr);

    // add liquidity
    await this.tokenA.connect(this.owner).approve(routerAddr, parseEther("10000"))
    await router.connect(this.owner).addLiquidityETH(
      this.tokenAAddr,
      parseEther("10000"),
      0,
      0,
      this.owner.address,
      getTime(),
      {
        value: parseEther("1")
      }
    )

    await this.tokenB.connect(this.owner).approve(routerAddr, parseEther("1000"))
    await router.connect(this.owner).addLiquidityETH(
      this.tokenBAddr,
      parseEther("1000"),
      0,
      0,
      this.owner.address,
      getTime(),
      {
        value: parseEther("1")
      }
    )

    // deploy Stake contract
    const StakeContract = await ethers.getContractFactory("Stake");
    this.stake = await StakeContract.deploy(this.tokenAAddr, this.tokenBAddr);
    await this.stake.waitForDeployment()
    this.stakeAddr = (await this.stake.getAddress()).toLowerCase()

    // set apr
    await this.stake.setApr(1e3);

    // set stake in tokenB
    await this.tokenB.setStake(this.stakeAddr);

    this.aliceAmount = parseEther("8000");
    this.bobAmount = parseEther("2000");

    console.log(`TokenA address: ${this.tokenAAddr}`)
    console.log(`TokenB address: ${this.tokenBAddr}`)
    console.log(`Stake address: ${this.stakeAddr}`)
  })

  describe("check contracts", function () {
    it("Check tokenA", async function () {
      await expect(
        this.tokenA.connect(this.alice)
          .mint(parseEther("100"))
      ).to.be.revertedWithCustomError(
        this.tokenA,
        "OwnableUnauthorizedAccount"
      ).withArgs(this.alice.address);

      await expect(
        this.tokenA.connect(this.bob)
          .mint(parseEther("100"))
      ).to.be.revertedWithCustomError(
        this.tokenA,
        "OwnableUnauthorizedAccount"
      ).withArgs(this.bob.address);

      await this.tokenA.connect(this.owner).mint(parseEther("10000"))
      const ownerBal = await this.tokenA.balanceOf(this.owner);
      expect(ownerBal).to.be.eq(parseEther("10000"))
    })

    it("Check tokenB", async function () {
      await expect(
        this.tokenB.connect(this.alice)
          .mint(this.alice.address, parseEther("100"))
      ).to.be.revertedWithCustomError(
        this.tokenB,
        "NotAllowed()"
      );

      await expect(
        this.tokenB.connect(this.bob)
          .mint(this.bob.address, parseEther("100"))
      ).to.be.revertedWithCustomError(
        this.tokenB,
        "NotAllowed()"
      );

      await expect(
        this.tokenB.connect(this.alice)
          .setStake(this.alice.address)
      ).to.be.revertedWithCustomError(
        this.tokenB,
        "OwnableUnauthorizedAccount"
      ).withArgs(this.alice.address);

      await expect(
        this.tokenB.connect(this.bob)
          .setStake(this.bob.address)
      ).to.be.revertedWithCustomError(
        this.tokenB,
        "OwnableUnauthorizedAccount"
      ).withArgs(this.bob.address);

      await expect(
        this.tokenB.connect(this.owner)
          .setStake(ZeroAddress)
      ).to.be.revertedWithCustomError(
        this.tokenB,
        "ZeroAddress()"
      );
    })

    it("Check Stake", async function () {
      await expect(
        this.stake.connect(this.alice)
          .setTokens(this.tokenAAddr, this.tokenBAddr)
      ).to.be.revertedWithCustomError(
        this.stake,
        "OwnableUnauthorizedAccount"
      ).withArgs(this.alice.address);

      await expect(
        this.stake.connect(this.bob)
          .setTokens(this.tokenAAddr, this.tokenBAddr)
      ).to.be.revertedWithCustomError(
        this.stake,
        "OwnableUnauthorizedAccount"
      ).withArgs(this.bob.address);

      await expect(
        this.stake.connect(this.owner)
          .setTokens(ZeroAddress, this.tokenBAddr)
      ).to.be.revertedWithCustomError(
        this.stake,
        "ZeroAddress()"
      );

      await expect(
        this.stake.connect(this.owner)
          .setTokens(this.owner.address, this.tokenBAddr)
      ).to.be.revertedWithCustomError(
        this.stake,
        "InvalidToken()"
      );
    })
  })

  describe("Stake test", function () {
    it("Alice can stake tokens", async function () {
      // transfer tokens to alice and bob
      await this.tokenA.connect(this.owner).transfer(this.alice.address, this.aliceAmount);
      await this.tokenA.connect(this.owner).transfer(this.bob.address, this.bobAmount);

      await this.tokenA.connect(this.alice).approve(this.stakeAddr, this.aliceAmount)
      await this.tokenA.connect(this.bob).approve(this.stakeAddr, this.bobAmount)

      const depositAmt = parseEther("3000")
      await expect(
        this.stake.connect(this.alice).stake(depositAmt)
      ).to.be.emit(this.stake, "UserStake").withArgs(this.alice.address, depositAmt)
    })

    it("Bob can stake tokens", async function () {
      const depositAmt = parseEther("1000")
      await expect(
        this.stake.connect(this.bob).stake(depositAmt)
      ).to.be.emit(this.stake, "UserStake").withArgs(this.bob.address, depositAmt)
    })

    it("check alice and bob staked amount", async function () {
      const aliceInfo = await this.stake.userInfo(this.alice.address)
      const bobInfo = await this.stake.userInfo(this.bob.address)

      expect(aliceInfo.stakeAmt).to.be.eq(parseEther("3000"))
      expect(aliceInfo.pendingReward).to.be.eq(0)
      expect(aliceInfo.lastStakeTime).to.be.eq(aliceInfo.lastClaimTime)
      expect(aliceInfo.lastStakeTime).to.gt(0)

      expect(bobInfo.stakeAmt).to.be.eq(parseEther("1000"))
      expect(bobInfo.pendingReward).to.be.eq(0)
      expect(bobInfo.lastStakeTime).to.be.eq(bobInfo.lastClaimTime)
      expect(bobInfo.lastStakeTime).to.gt(0)
    })
  })

  describe("Check harvest", function () {
    it("Users can harvest 1hr later from last claim", async function () {
      await expect(
        this.stake.connect(this.alice).harvest()
      ).to.be.revertedWithCustomError(
        this.stake,
        "InvalidClaimTime()"
      )

      await expect(
        this.stake.connect(this.bob).harvest()
      ).to.be.revertedWithCustomError(
        this.stake,
        "InvalidClaimTime()"
      )
    })

    it("Check can not harvest after 30 mins", async function () {
      await time.increase(1800);

      await expect(
        this.stake.connect(this.alice).harvest()
      ).to.be.revertedWithCustomError(
        this.stake,
        "InvalidClaimTime()"
      )

      await expect(
        this.stake.connect(this.bob).harvest()
      ).to.be.revertedWithCustomError(
        this.stake,
        "InvalidClaimTime()"
      )
    })

    it("Check can harvest after 1hr later", async function () {
      await time.increase(1800);

      await this.stake.connect(this.alice).harvest();
      await this.stake.connect(this.bob).harvest();
    })

    it("check APR", async function () {
      const aliceBal = await this.tokenB.balanceOf(this.alice.address)
      const bobBal = await this.tokenB.balanceOf(this.bob.address)

      expect(aliceBal).to.be.within(
        toBigInt(bobBal) * 29n / 10n,
        toBigInt(bobBal) * 31n / 10n
      )

      const aliceInfo = await this.stake.userInfo(this.alice.address)
      const bobInfo = await this.stake.userInfo(this.bob.address)

      checkApr(aliceInfo.stakeAmt, aliceBal)
      checkApr(bobInfo.stakeAmt, bobBal)
    })

    it("Check can not harvest after again 30 mins later", async function () {
      await time.increase(1800);

      await expect(
        this.stake.connect(this.alice).harvest()
      ).to.be.revertedWithCustomError(
        this.stake,
        "InvalidClaimTime()"
      )

      await expect(
        this.stake.connect(this.bob).harvest()
      ).to.be.revertedWithCustomError(
        this.stake,
        "InvalidClaimTime()"
      )
    })

    it("Check can harvest after again 1hr later", async function () {
      await time.increase(1800);

      await this.stake.connect(this.alice).harvest();
      await this.stake.connect(this.bob).harvest();
    })
  })

  describe("Check Unstake", async function () {
    it("Alice and Bob can not unstake before 1 day after stake", async function () {
      await expect(
        this.stake.connect(this.alice)
          .unstake(parseEther("1500"))
      ).to.be.revertedWithCustomError(
        this.stake,
        "InvalidUnstakeTime()"
      )

      await expect(
        this.stake.connect(this.bob)
          .unstake(parseEther("1500"))
      ).to.be.revertedWithCustomError(
        this.stake,
        "InvalidUnstakeTime()"
      )
    })

    it("Alice and Bob still can not unstake as only 23 hrs passed", async function () {
      await time.increase(3600 * 21);

      await expect(
        this.stake.connect(this.alice)
          .unstake(parseEther("1500"))
      ).to.be.revertedWithCustomError(
        this.stake,
        "InvalidUnstakeTime()"
      )

      await expect(
        this.stake.connect(this.bob)
          .unstake(parseEther("1500"))
      ).to.be.revertedWithCustomError(
        this.stake,
        "InvalidUnstakeTime()"
      )
    })

    it("Alice unstake half amount", async function () {
      await time.increase(3600 * 3);

      const aliceInfo = await this.stake.userInfo(this.alice.address)
      const beforeBal = await this.tokenB.balanceOf(this.alice.address)

      await this.stake.connect(this.alice).unstake(parseEther("1500"));

      const afterBal = await this.tokenB.balanceOf(this.alice.address)
      checkApr(aliceInfo.stakeAmt, afterBal - beforeBal, true)

      const aliceBal = await this.tokenA.balanceOf(this.alice.address)
      expect(aliceBal).to.be.eq(parseEther("6500"))
    })

    it("Bob unstake all amount", async function () {
      const bobInfo = await this.stake.userInfo(this.bob.address)
      const beforeBal = await this.tokenB.balanceOf(this.bob.address)

      await this.stake.connect(this.bob).unstake(parseEther("5000"));

      const afterBal = await this.tokenB.balanceOf(this.bob.address)
      checkApr(bobInfo.stakeAmt, afterBal - beforeBal, true)

      const bobBal = await this.tokenA.balanceOf(this.bob.address)
      expect(bobBal).to.be.eq(parseEther("2000"))
    })

    it("Alice stake again", async function () {
      const depositAmt = parseEther("1500");
      await expect(
        this.stake.connect(this.alice).stake(depositAmt)
      ).to.be.emit(this.stake, "UserStake")
        .withArgs(this.alice.address, depositAmt)
    })

    it("Alice can not unstake remaining amount as it requires 1 day pass", async function () {
      await expect(
        this.stake.connect(this.alice)
          .unstake(parseEther("1500"))
      ).to.be.revertedWithCustomError(
        this.stake,
        "InvalidUnstakeTime()"
      )
    })

    it("Alice can unstake after 1 day passed", async function () {
      await time.increase(3600 * 24);

      const aliceInfo = await this.stake.userInfo(this.alice.address)
      const beforeBal = await this.tokenB.balanceOf(this.alice.address)

      await this.stake.connect(this.alice).unstake(parseEther("10000"));

      const afterBal = await this.tokenB.balanceOf(this.alice.address)
      checkApr(aliceInfo.stakeAmt, afterBal - beforeBal, true)

      const aliceBal = await this.tokenA.balanceOf(this.alice.address)
      expect(aliceBal).to.be.eq(parseEther("8000"))
    })
  })
});
