const { getNamedAccounts, deployments, ethers } = require("hardhat");
const { getWeth, AMOUNT } = require("./getWeth");

async function main() {
  // the protocal treats everthing as an ERC20 token
  await getWeth();
  const { deployer } = await getNamedAccounts();
  const { deploy, log } = deployments;
  // abi, address
  // Lending Pool Address Provider : 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5
  // Lending Pool : ^
  const lendingPool = await getLendingPool(deployer);
  console.log(`랜딩 풀 주소 : ${lendingPool.address}`);

  // deposit!
  const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  // approve
  await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, deployer);
  console.log("예치시키는중 ... ");
  await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0);
  console.log("입금이 완료되었습니다.")

  // availableBorrowsETH? What the conversion rate on DAI is?
  // Borrow
  // how much we have borrowed, how much we have in collateral, how much we can borrow
  let {availableBorrowsETH, totalDebtETH} = await getBorrowUserData(lendingPool, deployer);
  const daiPrice = await getDaiPrice();
  
  const amountDaiToBorrow = availableBorrowsETH.toString() * 0.95 * (1 / daiPrice.toString());
  console.log(`총 ${amountDaiToBorrow}개의 DAI를 구매할 수 있습니다.`);
  const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString());
  console.log(`wei로변환한 DAI총량 ${amountDaiToBorrowWei}`);
  const daiTokenAddress = "0x6b175474e89094c44da98b954eedeac495271d0f"
  await borrowDai(daiTokenAddress,lendingPool,amountDaiToBorrowWei,deployer);
  await getBorrowUserData(lendingPool, deployer);
}

async function borrowDai(daiAddress,lendingPool,amountDaiToBorrowWei,account) {
  const borrowTx = await lendingPool.borrow(
    daiAddress,
    amountDaiToBorrowWei,
    1,
    0,
    account
  )
  await borrowTx.wait(1);
  console.log("대출이 완료되었습니다.")
}

async function getDaiPrice() {
  const daiEthPriceFeed = await ethers.getContractAt("AggregatorV3Interface","0x773616E4d11A78F511299002da57A0a94577F1f4");
  const price = (await daiEthPriceFeed.latestRoundData())[1];
  console.log(`1ETH당 DAI가격(DAI/ETH) : ${price}`)
  return price
}

async function getBorrowUserData(lendingPool, account) {
  const { totalCollateralETH, totalDebtETH, availableBorrowsETH } = await lendingPool.getUserAccountData(account);
  console.log(`예치 증거금: ${totalCollateralETH}`);
  console.log(`차입금: ${totalDebtETH}.`);
  console.log(`대출한도: ${availableBorrowsETH}`);
  return { totalDebtETH, availableBorrowsETH };
}

async function getLendingPool(account) {
  const lendingPoolAddressesProvider = await ethers.getContractAt(
    "ILendingPoolAddressesProvider",
    "0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5",
    account
  );
  const lendingPoolAddress =
    await lendingPoolAddressesProvider.getLendingPool();
  const lendingPool = await ethers.getContractAt(
    "ILendingPool",
    lendingPoolAddress,
    account
  );
  return lendingPool;
}

async function approveErc20(
  erc20Address,
  spenderAddress,
  amountToSpend,
  account
) {
  const erc20Token = await ethers.getContractAt(
    "IERC20",
    erc20Address,
    account
  );
  const tx = await erc20Token.approve(spenderAddress, amountToSpend)
  await tx.wait(1);
  console.log("토큰 승인됨")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
