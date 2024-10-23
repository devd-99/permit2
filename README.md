# Uniswap V3 Arbitrum Swap Example

This project demonstrates how to interact with Uniswap V3 on the Arbitrum network using TypeScript and Deno. It includes functionality for token swaps, gas estimation, and handling Permit2 approvals.

## Prerequisites

- [Deno](https://deno.land/) (v2)
- [Foundry](https://book.getfoundry.sh/getting-started/installation.html)

## Setup

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/uniswap-v3-arbitrum-swap.git
   cd uniswap-v3-arbitrum-swap
   ```

2. Install dependencies:
   ```
   deno cache --reload main.ts
   ```
   This command will download and cache all the dependencies specified in the `deno.json` file.

3. Create a `.env` file in the root directory with the following content. You can get the Arbitrum RPC URL from [Alchemy](https://www.alchemy.com/), and you can change these parameters if you want to swap on different chain. You can get the wallet address and private key on performing anvil fork (Step 4):
   ```
   WALLET_ADDRESS=your_wallet_address
   WALLET_SECRET=your_wallet_private_key
   CHAIN_ID=42161
   RPC_URL=your_arbitrum_rpc_url
   UNIVERSAL_ROUTER_ADDRESS=0x5E325eDA8064b456f4781070C0738d849c824258
   WETH_ADDRESS=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
   DAI_ADDRESS=0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1
   USDC_ADDRESS=0xaf88d065e77c8cC2239327C5EDb3A432268e5831
   NEAR_ADDRESS=0x7838C50fD26d0A7aAeF80095E1C2A7b1Fc6eC0dD
   ```
   Replace `your_wallet_address`, `your_wallet_private_key`, and `your_arbitrum_rpc_url` with your actual values.

4. Install Foundry and initialize an Anvil fork with auto-impersonate flag:
   ```
   foundryup
   anvil --fork-url your_arbitrum_rpc_url --auto-impersonate
   ```
   Replace `your_arbitrum_rpc_url` with your actual Arbitrum/similar RPC URL.

## Running the Script

To run the main script:
```
deno run -A main.ts
```

To check Permit2 allowance:
```
deno run -A check_permit2_allowance.ts
```


## Project Structure

- `main.ts`: The main script that performs token swaps on Uniswap V3.
- `check_allowance.ts`: A utility script to check Permit2 allowances.
- `main_test.ts`: A simple test file (currently contains a placeholder test).

## Key Features

1. Token swaps using Uniswap V3 on Arbitrum
2. Gas estimation and optimization
3. Permit2 integration for token approvals
4. Error handling and logging


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

