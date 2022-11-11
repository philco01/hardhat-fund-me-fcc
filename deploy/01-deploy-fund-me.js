// async function deployFunc(hre) {
//     console.log("hey")
//     hre.getNamedAcoounts()
//     hre.deployments
// }

// module.exports.default = deployFunc
// another way that is similar to the one above is:

//module.exports = async (hre) => {
//   const { getNamedAccounts, deployments } = hre // its a way to pull these variables from hre
//another way to wright this is :}
const { networkConfig, developmentChains } = require("../helper-hardhat-config") // its the same if we we wrighting:
const { network } = require("hardhat")
const { verify } = require("../utils/verify")
// const helperConfig = require("../helper-hardhat-config") and
// const networkingConfig = helperConfig.networkingConfig and thats why we exportec networkConfig i helper

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    // if chainId is X use address Y
    // if chainId is Z use address A

    //const ethUsdPriceFeedAddress = networkConfig[chainId]["ethUsdPriceFeed"]
    let ethUsdPriceFeedAddress
    if (developmentChains.includes(network.name)) {
        // get deploy from hardhat-deploy
        const ethUsdAggregator = await deployments.get("MockV3Aggregator")
        ethUsdPriceFeedAddress = ethUsdAggregator.address
    } else {
        // if we not in developmentChains we didnt deploy Mocks
        ethUsdPriceFeedAddress = networkConfig[chainId]["ethUsdPriceFeed"]
    }
    // if the contract doesnt exist, we depoy a minimal version of for our local testing
    // well what jappens when we want to change chains? we also need a way to modurolize or parametrize
    // an adress of aggreagatorV3interface that we dont have to change our code for each chain
    // when going for localhost or hardhat network we want to use a mock
    const args = [ethUsdPriceFeedAddress]
    const fundMe = await deploy("FundMe", {
        from: deployer, // the one whos deployer this contract
        args: args, // put pricefeed address
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if (
        !developmentChains.includes(network.name) &&
        process.env.ETHERSCAN_API_KEY
    ) {
        //instead of wrigthing verify code in deploy script
        await verify(fundMe.address, args)
    }
    log("-------------------------------------")
}
module.exports.tags = ["all", "fundme"]
// its a same way like hre.getNamedAccount and hre.deployments
