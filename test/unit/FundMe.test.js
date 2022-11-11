const { assert, expect } = require("chai")
const { deployments, ethers, getNamedAccounts } = require("hardhat")
const { internalTask } = require("hardhat/config")
const { developmentChains } = require("../../helper-hardhat-config")
const {
    isCallTrace,
} = require("hardhat/internal/hardhat-network/stack-traces/message-trace")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("FundMe", function () {
          let fundMe
          let deployer
          let mockV3Aggregator
          // ethers.utils.parseEther(1) - converts 1 eth to "1000000000000000000"
          const sendValue = ethers.utils.parseEther("1") // 1eth
          beforeEach(async function () {
              // deploy ourfundMe contract
              //using hardhat-deploy
              // fixture function allows us to run entire deploy folder with
              // as many tags as we want
              // another way we can get different account is direct from hardhat.config
              //const accounts = await ethers.getSigners() // points to accounts in networks
              // counts accountZero = accounts[0]
              deployer = (await getNamedAccounts()).deployer
              //we can deploy everything in our deploy folder
              // with just this one line
              await deployments.fixture(["all"]) // once our contract deployed we will start
              //getting them, hardhat deploy wraps ethers with func called getContract
              fundMe = await ethers.getContract("FundMe", deployer) // get the most recent deployment will tell it
              mockV3Aggregator = await ethers.getContract(
                  "MockV3Aggregator",
                  deployer
              )
          })
          describe("constructor", async function () {
              it("sets the aggregator addresses correctly", async function () {
                  const response = await fundMe.getPriceFeed() // we want to make sure this price feed
                  // is the same as our MockV3Aggregator since we running this test locally
                  assert.equal(response, mockV3Aggregator.address)
              })
          })

          // this contarct should fail if there is not enough eth to send
          describe("fund", async function () {
              it("fails if you dont send enough ETH", async function () {
                  await expect(fundMe.fund()).to.be.revertedWith(
                      "You need to spend more ETH!"
                  )
              })
              it("updated the amount funded data structure", async function () {
                  await fundMe.fund({ value: sendValue })
                  //deployer address - amount of eth that actually sent
                  const response = await fundMe.getAddressToAmountFunded(
                      deployer
                  )
                  assert.equal(response.toString(), sendValue.toString())
              })
              it("adds funder to array of s_funders", async function () {
                  await fundMe.fund({ value: sendValue })
                  const funder = await fundMe.getFunder(0)
                  assert.equal(funder, deployer)
              })
          })
          describe("withdraw", async function () {
              // first of all we want contract to have any money in order to withdraw it
              // so we run beforeEach() to automatically fund contract before we run the test
              beforeEach(async function () {
                  await fundMe.fund({ value: sendValue })
              })

              it("withdraw ETH from a single founder", async function () {
                  // these are the wat of writing tet
                  // Arrange- first we gonna get startery balance of foundery and deployer contract
                  // we getting fundMe and deployer starting balance so we can test later on how much
                  // these numbers changed based on what happens when we call withdraw function
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address)
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)
                  // Act
                  const transactionResponse = await fundMe.withdraw()
                  const transactionReceipt = await transactionResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt // with curly brackets we can
                  //pull objects from another object
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  // now we should able to see the entire fundMe balance added to the deployer balance

                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const endingDeployerMeBalance =
                      await fundMe.provider.getBalance(deployer)

                  // assert
                  assert.equal(endingFundMeBalance, 0)
                  // since startingFundMe calling from a blockchain its gonna be a BigNumber, use .add()
                  assert.equal(
                      startingFundMeBalance
                          .add(startingDeployerBalance)
                          .toString(),
                      endingDeployerMeBalance.add(gasCost).toString()
                  )
              })
              it("allows us to withdraw with multiple s_funders", async function () {
                  // arrange
                  const accounts = await ethers.getSigners()
                  for (let i = 1; i < 6; i++) {
                      // i=1 because i=0 is deployer
                      // we need to connect becouse previous connection
                      // fundMe = await ethers.getContract("FundMe", deployer) is related to deployer
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })
                  }
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address)
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)

                  // Act
                  const transactionResponse = await fundMe.withdraw()
                  const transactionReceipt = await transactionResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  // assert
                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const endingDeployerMeBalance =
                      await fundMe.provider.getBalance(deployer)

                  assert.equal(endingFundMeBalance, 0)
                  // since startingFundMe calling from a blockchain its gonna be a BigNumber, use .add()
                  assert.equal(
                      startingFundMeBalance
                          .add(startingDeployerBalance)
                          .toString(),
                      endingDeployerMeBalance.add(gasCost).toString()
                  )
                  // make sure the s_funders are reset properly
                  await expect(fundMe.getFunder(0)).to.be.reverted

                  for (i = 1; i < 6; i++) {
                      assert.equal(
                          await fundMe.getAddressToAmountFunded(
                              accounts[i].address
                          ),
                          0
                      )
                  }
              })
              it("only allows the owner to withdraw", async function () {
                  const accounts = await ethers.getSigners()
                  const attacker = accounts[1] // some random account
                  // we connect this attacker to a new contract
                  const attackerConnectedContract = await fundMe.connect(
                      attacker
                  )
                  await expect(
                      attackerConnectedContract.withdraw()
                  ).to.be.revertedWith("FundMe__NotOwner")
              })
              it("cheaperWithdraw testing...", async function () {
                  // arrange
                  const accounts = await ethers.getSigners()
                  for (let i = 1; i < 6; i++) {
                      // i=1 because i=0 is deployer
                      // we need to connect becouse previous connection
                      // fundMe = await ethers.getContract("FundMe", deployer) is related to deployer
                      const fundMeConnectedContract = await fundMe.connect(
                          accounts[i]
                      )
                      await fundMeConnectedContract.fund({ value: sendValue })
                  }
                  const startingFundMeBalance =
                      await fundMe.provider.getBalance(fundMe.address)
                  const startingDeployerBalance =
                      await fundMe.provider.getBalance(deployer)

                  // Act
                  const transactionResponse = await fundMe.cheaperWithdraw()
                  const transactionReceipt = await transactionResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = transactionReceipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)

                  // assert
                  const endingFundMeBalance = await fundMe.provider.getBalance(
                      fundMe.address
                  )
                  const endingDeployerMeBalance =
                      await fundMe.provider.getBalance(deployer)

                  assert.equal(endingFundMeBalance, 0)
                  // since startingFundMe calling from a blockchain its gonna be a BigNumber, use .add()
                  assert.equal(
                      startingFundMeBalance
                          .add(startingDeployerBalance)
                          .toString(),
                      endingDeployerMeBalance.add(gasCost).toString()
                  )
                  // make sure the s_funders are reset properly
                  await expect(fundMe.getFunder(0)).to.be.reverted

                  for (i = 1; i < 6; i++) {
                      assert.equal(
                          await fundMe.getAddressToAmountFunded(
                              accounts[i].address
                          ),
                          0
                      )
                  }
              })
          })
      })
