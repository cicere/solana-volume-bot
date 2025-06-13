# Solana Volume Bot

Welcome to the Solana Volume Bot, an open-source script designed to help you achieve desired transaction volumes on the Solana blockchain. This powerful tool is perfect for users looking to manage multiple transactions efficiently and effectively.

** COMPATIBLE WITH PUMPSWAP, PUMPFUN, RAYDIUM, TOKEN2022, CPMM/Non-CPMM & much more **

**TEST IT for FREE at: [solana-volume.com](https://solana-volume.com)**

**join our [DISCORD](https://discord.gg/solana-scripts) for support & more tools**




OPEN Source Version:



https://github.com/user-attachments/assets/3afb9c6b-5233-4a44-9a05-2d87a2b5b094



Newest Update:




https://github.com/user-attachments/assets/81780630-4f8e-4b5c-90d0-5854df6605b3




## Getting Started

To get started with the Solana Volume Bot, follow these steps to ensure a smooth setup and execution process.

### 1. Setup

#### a) Install Dependencies
Run the following command to install the necessary dependencies:
npm i

#### b) Configure Environment Variables
Edit the `.env` file to include your wallet private key and RPC URL:
- **Wallet Private Key:** The wallet you enter in the config pays for Jito tips and sends all the SOL/WSOL.
- **RPC URL:** Your Solana RPC endpoint.

#### c) Start the Script
Run the script with the following command:
node main.js

### 2. Execution Steps

**Important:** Run all steps in order and do not create new keypairs unless you reclaim your SOL.

#### a) Create New Keypairs
Step 1: Create new keypairs for your volume transactions. This step is necessary if you want to ensure fresh keypairs.

#### b) Distribute SOL/WSOL
Step 2: Distribute SOL/WSOL to the keypairs.
- **Gas Fees:** The SOL you send here is ONLY FOR GAS FEES. It is recommended to send anywhere from 0.05 to 1 SOL.
- **Volume Spam:** This is the amount of SOL each keypair will use to volume spam and rotate. You can enter any custom amount to look natural.

#### c) Simulate Volume
Step 3: Simulate all volume and calculate all Jito tip fees and Raydium 5bps fee to see EXACTLY how much you will spend to achieve the volume you want. This step ensures you know the exact costs involved.

#### d) Volume Bot
Step 4: Execute the volume bot to get your desired volume. It is recommended to set a timeout between swaps at around 3-10 seconds to look natural.

#### e) Retrieve Funds
Step 5: Retrieve all funds from the keypairs automatically. This step will retrieve all the WSOL and SOL you sent and send it to the wallet in the config file.

## Additional Resources

For more detailed instructions and updates, visit our Discord below or DM me at @benorizz0 on Telegram. Here you will find comprehensive documentation and community support for any issues you encounter.

### Conclusion

The Solana Volume Bot is a robust tool for managing multiple transactions on the Solana blockchain. By following the setup and execution steps outlined above, you can efficiently handle buying and selling operations with ease. Join our community on GitHub and take advantage of this powerful open-source solution.

Optimize your Solana transactions today with the Solana Volume Bot!

For more information, check out our [DISCORD](https://discord.gg/solana-scripts)
