import dotenv from 'dotenv';
import { ethers } from "ethers";
import { PERMIT2_ADDRESS } from "@uniswap/permit2-sdk";

dotenv.config();

// Constants
const WALLET_ADDRESS = process.env.WALLET_ADDRESS!;
const RPC_URL = process.env.RPC_URL!;
const WETH_ADDRESS = process.env.WETH_ADDRESS!;

// ABI for ERC20 token
const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
];

async function checkPermit2Allowance() {
  // Setup provider
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

  // Create WETH contract instance
  const wethContract = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, provider);

  try {
    // Check WETH balance
    const balance = await wethContract.balanceOf(WALLET_ADDRESS);
    console.log(`WETH Balance: ${ethers.utils.formatEther(balance)} WETH`);

    // Check Permit2 allowance
    const allowance = await wethContract.allowance(WALLET_ADDRESS, PERMIT2_ADDRESS);
    console.log(`Permit2 Allowance: ${ethers.utils.formatEther(allowance)} WETH`);

    // Check if allowance is sufficient
    if (allowance.gt(ethers.constants.Zero)) {
      console.log("Permit2 allowance is set and greater than 0.");
      if (allowance.gte(ethers.constants.MaxUint256)) {
        console.log("Permit2 has maximum allowance.");
      } else {
        console.log("Permit2 has a limited allowance. Consider setting it to the maximum if needed.");
      }
    } else {
      console.log("Warning: Permit2 allowance is 0. This may cause issues with swaps.");
    }

  } catch (error) {
    console.error("Error checking Permit2 allowance:", error);
  }
}

// Run the script
checkPermit2Allowance().then(() => {
  console.log("Permit2 allowance check completed");
}).catch((error) => {
  console.error("Unhandled error during script execution:", error);
});