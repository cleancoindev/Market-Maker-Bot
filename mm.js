const ethers = require('ethers');
require("dotenv").config();

const wethAddress = '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6'; // goerli weth  -- no.  wBTC on polygon.

//const wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // mainnet weth

const routerAddress = '0x643770e279d5d0733f21d6dc03a8efbabf3255b4'; // Uniswap Router on poly
const quoterAddress = '0xb27308f9f90d607463bb33ea1bebb41c27ce5ab6'; // Uniswap Quoter on poly
const tokenAddress = '0xdc35d12079597cbdA8FE38a42c3DBc31E7E60cB5'; // goerli uni -=-= no. SFBM-pepe$
const fee = 3000; // Uniswap pool fee bps 500, 3000, 10000
const buyAmount = ethers.parseUnits('0.001', 'ether');
const targetPrice = BigInt(35); // target exchange rate
const targetAmountOut = buyAmount * targetPrice;
const sellAmount = buyAmount / targetPrice;
const tradeFrequency = 3600 * 1000; // ms (once per hour)

// `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`
const provider = new ethers.JsonRpcProvider(`https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
const account = wallet.connect(provider);

const token = new ethers.Contract(
  tokenAddress,
  [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) public view returns (uint256)',
  ],
  account
);

const router = new ethers.Contract(
  routerAddress,
  ['function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'],
  account
);

const quoter = new ethers.Contract(
  quoterAddress,
  ['function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) public view returns (uint256 amountOut)'],
  account
);

const buyTokens = async () => {
  console.log('Buying Tokens')
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const tx = await router.exactInputSingle([wethAddress, tokenAddress, fee, wallet.address, deadline, buyAmount, 0, 0], {value: buyAmount});
  await tx.wait();
  console.log(tx.hash);
}

const sellTokens = async () => {
  console.log('Selling Tokens')
  const allowance = await token.allowance(wallet.address, routerAddress);
  console.log(`Current allowance: ${allowance}`);
  if (allowance < sellAmount) {
    console.log('Approving Spend (bulk approve in production)');
    const atx = await token.approve(routerAddress, sellAmount);
    await atx.wait();
  }
  const deadline = Math.floor(Date.now() / 1000) + 600;
  const tx = await router.exactInputSingle([tokenAddress, wethAddress, fee, wallet.address, deadline, sellAmount, 0, 0]);
  await tx.wait();
  console.log(tx.hash);
}

const checkPrice = async () => {
  const amountOut = await quoter.quoteExactInputSingle(wethAddress, tokenAddress, fee, buyAmount, 0);
  console.log(`Current Exchange Rate: ${amountOut.toString()}`);
  console.log(`Target Exchange Rate: ${targetAmountOut.toString()}`);
  if (amountOut < targetAmountOut) buyTokens();
  if (amountOut > targetAmountOut) sellTokens();
}

checkPrice();
setInterval(() => {
  checkPrice();
}, tradeFrequency);
