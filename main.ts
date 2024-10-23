import dotenv from 'dotenv';
import { BigNumberish, ethers, parseUnits } from "ethers";
import { AlphaRouter, SwapType, SwapOptionsUniversalRouter } from "@uniswap/smart-order-router";
import { CurrencyAmount, Percent, Token, TradeType } from "@uniswap/sdk-core";
import {
  AllowanceTransfer,
  MaxUint160,
  PERMIT2_ADDRESS,
} from "@uniswap/permit2-sdk";
import JSBI from "jsbi";
import { UniversalRouterVersion } from '@uniswap/universal-router-sdk';
import process from 'process';

dotenv.config();

// Constants
const WALLET_ADDRESS = process.env.WALLET_ADDRESS!;
const WALLET_SECRET = process.env.WALLET_SECRET!;
const CHAIN_ID = parseInt(process.env.CHAIN_ID!);
const RPC_URL = process.env.RPC_URL!;
// const UNIVERSAL_ROUTER_ADDRESS = ethers.utils.getAddress(process.env.UNIVERSAL_ROUTER_ADDRESS!);
const UNIVERSAL_ROUTER_ADDRESS = process.env.UNIVERSAL_ROUTER_ADDRESS!;

// Token addresses (Arbitrum)
const WETH_ADDRESS = process.env.WETH_ADDRESS!;
const DAI_ADDRESS = process.env.DAI_ADDRESS!;
const USDC_ADDRESS = process.env.USDC_ADDRESS!;
const NEAR_ADDRESS = process.env.NEAR_ADDRESS!;

const UNIVERSAL_ROUTER_COMMANDS = {
  V3_SWAP_EXACT_IN: '0x00',
  WRAP_ETH: '0x0B',
  UNWRAP_WETH: '0x0C',
} as const;

// Add parameter verification utilities
const verifyV3SwapParams = (
  recipient: string,
  amountIn: BigNumberish,
  amountOutMin: BigNumberish,
  path: string,
  payerIsUser: boolean = true
) => {
  if (!ethers.utils.isAddress(recipient)) {
    throw new Error('Invalid recipient address');
  }
  if (!amountIn || amountIn.toString() === '0') {
    throw new Error('Invalid amountIn');
  }
  if (!path || !path.startsWith('0x')) {
    throw new Error('Invalid path');
  }
  console.log('Swap Parameters Verified:', {
    recipient,
    amountIn: amountIn.toString(),
    amountOutMin: amountOutMin.toString(),
    path,
    payerIsUser
  });
  return true;
};

// ABI for ERC20 token
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) public returns (bool)",
];

// Setup provider and signer
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const mainnetProvider = new ethers.providers.JsonRpcProvider(
  "https://arbitrum-mainnet.infura.io/v3/4cb67d93b67f48dc8afa0937a5ba0325",
);
const signer = new ethers.Wallet(WALLET_SECRET, provider);

// Utility functions
const parseDeadline = (minutes: number) =>
  Math.floor(Date.now() / 1000) + minutes * 60;

const getTokenTransferApproval = async (
  tokenAddress: string,
  amount: string,
) => {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    console.log(`Approving ${tokenAddress} for Permit2...`);
    const tx = await tokenContract.approve(PERMIT2_ADDRESS, amount);
    console.log(`Approval transaction sent: ${tx.hash}`);
    const receipt = await tx.wait(2);
    console.log(`Approval confirmed: ${receipt.transactionHash}`);
    return receipt;
  } catch (error) {
    console.error("Error in getTokenTransferApproval:", error);
    return null;
  }
};

const makePermit = (tokenAddress: string, amount: string, nonce: number) => {
  return {
    details: {
      token: tokenAddress,
      amount,
      expiration: (Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60)
        .toString(), // 30 days
      nonce,
    },
    spender: UNIVERSAL_ROUTER_ADDRESS,
    sigDeadline: (Math.floor(Date.now() / 1000) + 30 * 60).toString(), // 30 minutes
  };
};

const generatePermitSignature = async (permit: any) => {
  try {
    const { domain, types, values } = AllowanceTransfer.getPermitData(
      permit,
      PERMIT2_ADDRESS,
      CHAIN_ID,
    );
    const signature = await signer._signTypedData(domain, types, values);
    console.log("Permit2 signature generated");
    return signature;
  } catch (error) {
    console.error("Error in generatePermitSignature:", error);
    return null;
  }
};

// Define a custom gas price provider
class CustomGasPriceProvider implements IGasPriceProvider {
  async getGasPrice(
    latestBlockNumber: number,
    requestBlockNumber?: number,
  ): Promise<GasPrice> {
    const gasPrice = await mainnetProvider.getGasPrice();
    return {
      gasPriceWei: gasPrice,
    };
  }
}

// Create an instance of the custom gas price provider
const customGasPriceProvider = new CustomGasPriceProvider();

// Increase slippage tolerance to 5%
const SLIPPAGE_TOLERANCE = new Percent(JSBI.BigInt(500), JSBI.BigInt(10000)); // 5% slippage



// Function to check token approval
async function checkTokenApproval(tokenAddress: string, owner: string, spender: string) {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const allowance = await tokenContract.allowance(owner, spender);
  console.log(`Allowance for ${tokenAddress}: ${ethers.utils.formatEther(allowance)}`);
  return allowance;
}

// Function to check token balance
async function checkTokenBalance(tokenAddress: string, owner: string) {
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const balance = await tokenContract.balanceOf(owner);
  console.log(`Balance of ${tokenAddress}: ${ethers.utils.formatEther(balance)}`);
  return balance;
}


const getQuote = async (
  amountIn: string,
  tokenIn: Token,
  tokenOut: Token,
  permitSig?: any,
) => {
  try {
    

    const parsedAmount = ethers.utils.parseUnits(amountIn, tokenIn.decimals);
    const amountInCurrency = CurrencyAmount.fromRawAmount(
      tokenIn,
      JSBI.BigInt(parsedAmount.toString()),
    );


    const router = new AlphaRouter({
      chainId: CHAIN_ID,
      provider: mainnetProvider,
      gasPriceProvider: customGasPriceProvider,
    });

    const swapOptions: SwapOptionsUniversalRouter = {
      type: SwapType.UNIVERSAL_ROUTER,
      recipient: WALLET_ADDRESS,
      slippageTolerance: SLIPPAGE_TOLERANCE, // Use the increased slippage tolerance
      deadline: Math.floor(Date.now() / 1000 + 1800), // 30 minutes
      version: UniversalRouterVersion.V2_0,
    };

    const route = await router.route(
      amountInCurrency,
      tokenOut,
      TradeType.EXACT_INPUT,
      swapOptions,
    );

    if (!route) {
      console.log("No route found");
      return null;
    }

    console.log(`Quote received for ${tokenIn.symbol} to ${tokenOut.symbol}`);
    console.log(route);
    return route;

  } catch (error) {
    console.error("Error in getQuote:", error);
    throw error;
  }
};



const executeSwap = async (quote: any, tokenIn: Token, amountIn: string) => {
  
  
  try {
    // Check token approvals and balances before swap
    await checkTokenApproval(tokenIn.address, WALLET_ADDRESS, PERMIT2_ADDRESS);
    await checkTokenBalance(tokenIn.address, WALLET_ADDRESS);

    if (!quote.methodParameters?.calldata) {
      throw new Error('No calldata found in quote');
    }

    // Verify Universal Router contract exists at the specified address
    const routerCode = await provider.getCode(UNIVERSAL_ROUTER_ADDRESS);
    if (routerCode === '0x' || routerCode === '0x0') {
      throw new Error(`No contract found at Universal Router address ${UNIVERSAL_ROUTER_ADDRESS}`);
    } else {
      console.log("Universal Router contract found at address:", UNIVERSAL_ROUTER_ADDRESS);
    }

    console.log('Quote:', quote.methodParameters);
    const hexValue = quote.methodParameters?.value;
    const bigNumberValue = ethers.BigNumber.from(hexValue);

    // const decoded = decodeUniversalRouterCalldata(quote.methodParameters.calldata);
    // await verifySwapParameters(provider, WALLET_ADDRESS, WETH_ADDRESS, decoded);

    const txData: ethers.providers.TransactionRequest = {
      to: UNIVERSAL_ROUTER_ADDRESS,
      data: quote.methodParameters.calldata,
      value: quote.methodParameters?.value,
    };

    let gasEstimate;
    const DEFAULT_GAS_LIMIT = 210000;
    try {
      gasEstimate = await signer.estimateGas(txData);
    } catch (err) {
      console.log("Error estimating gas:");
      gasEstimate = ethers.BigNumber.from(DEFAULT_GAS_LIMIT); // DEFAULT_GAS_LIMIT = 210000
    }
    const gasLimit = gasEstimate.mul(120).div(100);
    const response = await signer.sendTransaction({
      ...txData,
      gasLimit,
    });

    console.log("Transaction sent:", response.hash);
    const receipt = await response.wait(2);
    
    console.log(`Swap confirmed: ${receipt.transactionHash}`);
    return receipt;
  } catch (error) {
    console.error("Error in executeSwap:", error);
    // throw error;
  }
};

// Main function
async function main() {
  try {
    const wethToken = new Token(
      CHAIN_ID,
      WETH_ADDRESS,
      18,
      "WETH",
      "Wrapped Ether",
    );
    const daiToken = new Token(
      CHAIN_ID,
      DAI_ADDRESS,
      18,
      "DAI",
      "Dai Stablecoin",
    );
    const usdcToken = new Token(CHAIN_ID, USDC_ADDRESS, 6, "USDC", "USD Coin");
    const nearToken = new Token(
      CHAIN_ID,
      NEAR_ADDRESS,
      18,
      "NEAR",
      "NEAR Protocol",
    );

    const wethAmount = "0.3"; // 0.1 WETH for each swap
    const wethAmountPerSwap = "0.1";

    // Check initial WETH balance and approval
    await checkTokenBalance(WETH_ADDRESS, WALLET_ADDRESS);
    await checkTokenApproval(WETH_ADDRESS, WALLET_ADDRESS, PERMIT2_ADDRESS);

    // Approve WETH for Permit2
    const approvalReceipt = await getTokenTransferApproval(
      WETH_ADDRESS,
      ethers.constants.MaxUint256.toString(),
    );
    if (!approvalReceipt) throw new Error("WETH approval failed");
    console.log("WETH approved for Permit2");

    // Check approval after approval transaction
    await checkTokenApproval(WETH_ADDRESS, WALLET_ADDRESS, PERMIT2_ADDRESS);

    // Generate Permit2 signature
    const permit = makePermit(WETH_ADDRESS, MaxUint160.toString(), 0);
    const signature = await generatePermitSignature(permit);
    if (!signature) throw new Error("Failed to generate Permit2 signature");

    const permitSig = { permit, signature };

    // Proceed with swaps only after approval is confirmed
    await performSwaps(wethToken, daiToken, usdcToken, nearToken, wethAmountPerSwap, permitSig);

    console.log("All swap attempts completed");
  } catch (error) {
    console.error("Error in main function:", error);
  }
}

async function performSwaps(wethToken, daiToken, usdcToken, nearToken, wethAmountPerSwap, permitSig) {
  // Swap WETH for DAI
  const daiQuote = await getQuote(
    wethAmountPerSwap,
    wethToken,
    daiToken,
    permitSig,
  );
  if (daiQuote) await executeSwap(daiQuote, wethToken, wethAmountPerSwap);

  // Query and print DAI balance
  const daiBalance = await checkTokenBalance(DAI_ADDRESS, WALLET_ADDRESS);
  console.log(`DAI balance: ${daiBalance.toString()}`);

  // Query and print WETH balance
  const wethBalance = await checkTokenBalance(WETH_ADDRESS, WALLET_ADDRESS);
  console.log(`WETH balance: ${wethBalance.toString()}`);

  // // Swap WETH for USDC
  // const usdcQuote = await getQuote(
  //   wethAmountPerSwap,
  //   wethToken,
  //   usdcToken,
  //   permitSig,
  // );
  // if (usdcQuote) await executeSwap(usdcQuote, wethToken, wethAmountPerSwap);

  // // Swap WETH for NEAR
  // const nearQuote = await getQuote(
  //   wethAmountPerSwap,
  //   wethToken,
  //   nearToken,
  //   permitSig,
  // );
  // if (nearQuote) {
  //   await executeSwap(nearQuote, wethToken, wethAmountPerSwap);
  // } else {
  //   console.log("No near quote received");
  // }
}

// Run the script
main().then(() => {
  console.log("Script execution completed");
}).catch((error) => {
  console.error("Unhandled error during script execution:", error);
});
