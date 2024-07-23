import {
	Keypair,
	PublicKey,
	SystemProgram,
	Transaction,
	TransactionInstruction,
	VersionedTransaction,
	Signer,
	LAMPORTS_PER_SOL,
	TransactionMessage,
	Blockhash,
	AddressLookupTableAccount,
} from "@solana/web3.js";
import { loadKeypairs } from "./createKeys";
import { wallet, connection, tipAcct } from "../config";
import { lookupTableProvider } from "./clients/LookupTableProvider";
import * as spl from "@solana/spl-token";
import { searcherClient } from "./clients/jito";
import { Bundle as JitoBundle } from "jito-ts/dist/sdk/block-engine/types.js";
import promptSync from "prompt-sync";

const prompt = promptSync();

export async function createReturns() {
	const txsSigned: VersionedTransaction[] = [];
	const keypairs = loadKeypairs();
	const chunkedKeypairs = chunkArray(keypairs, 2); // EDIT CHUNKS?

	const jitoTipIn = prompt("Jito tip in Sol (Ex. 0.01): ");
	const TipAmt = parseFloat(jitoTipIn) * LAMPORTS_PER_SOL;

	const { blockhash } = await connection.getLatestBlockhash();

	// Iterate over each chunk of keypairs
	for (let chunkIndex = 0; chunkIndex < chunkedKeypairs.length; chunkIndex++) {
		const chunk = chunkedKeypairs[chunkIndex];
		const instructionsForChunk: TransactionInstruction[] = [];

		// Iterate over each keypair in the chunk to create swap instructions
		for (let i = 0; i < chunk.length; i++) {
			const keypair = chunk[i];
			console.log(`Processing keypair ${i + 1}/${chunk.length}:`, keypair.publicKey.toString());

			const ataAddressKeypair = await spl.getAssociatedTokenAddress(new PublicKey(spl.NATIVE_MINT), keypair.publicKey);

			const closeAcctixs = spl.createCloseAccountInstruction(
				ataAddressKeypair, // WSOL account to close
				wallet.publicKey, // Destination for remaining SOL
				keypair.publicKey // Owner of the WSOL account, may need to be the wallet if it's the owner
			);

			const balance = await connection.getBalance(keypair.publicKey);

			const sendSOLixs = SystemProgram.transfer({
				fromPubkey: keypair.publicKey,
				toPubkey: wallet.publicKey,
				lamports: balance,
			});

			instructionsForChunk.push(closeAcctixs, sendSOLixs);
		}

		if (chunkIndex === chunkedKeypairs.length - 1) {
			const tipSwapIxn = SystemProgram.transfer({
				fromPubkey: wallet.publicKey,
				toPubkey: tipAcct,
				lamports: BigInt(TipAmt),
			});
			instructionsForChunk.push(tipSwapIxn);
			console.log("Jito tip added :).");
		}

		const addressesMain: PublicKey[] = [];
		instructionsForChunk.forEach((ixn) => {
			ixn.keys.forEach((key) => {
				addressesMain.push(key.pubkey);
			});
		});

		const lookupTablesMain = lookupTableProvider.computeIdealLookupTablesForAddresses(addressesMain);

		const message = new TransactionMessage({
			payerKey: wallet.publicKey,
			recentBlockhash: blockhash,
			instructions: instructionsForChunk,
		}).compileToV0Message(lookupTablesMain);

		const versionedTx = new VersionedTransaction(message);

		const serializedMsg = versionedTx.serialize();
		console.log("Txn size:", serializedMsg.length);
		if (serializedMsg.length > 1232) {
			console.log("tx too big");
		}

		console.log(
			"Signing transaction with chunk signers",
			chunk.map((kp) => kp.publicKey.toString())
		);

		versionedTx.sign([wallet]);

		for (const keypair of chunk) {
			versionedTx.sign([keypair]);
		}

		txsSigned.push(versionedTx);
	}

	await sendBundleWithParameters(txsSigned);
}

async function generateSOLTransferForKeypairs(SendAmt: number, steps: number = 5): Promise<TransactionInstruction[]> {
	const amount = SendAmt * LAMPORTS_PER_SOL;
	const keypairs: Keypair[] = loadKeypairs(); // Load your keypairs
	const keypairSOLIxs: TransactionInstruction[] = [];

	keypairs.forEach((keypair, index) => {
		if (index >= steps) return; // Ensure we only process up to 'steps' keypairs
		const transferIx = SystemProgram.transfer({
			fromPubkey: wallet.publicKey,
			toPubkey: keypair.publicKey,
			lamports: amount,
		});
		keypairSOLIxs.push(transferIx);
		console.log(`Transfer of ${Number(amount) / LAMPORTS_PER_SOL} SOL to Wallet ${index + 1} (${keypair.publicKey.toString()}) bundled.`);
	});

	return keypairSOLIxs;
}

async function createAndSignVersionedTx(instructionsChunk: TransactionInstruction[], blockhash: Blockhash | string, keypairs?: Keypair[]): Promise<VersionedTransaction> {
	const addressesMain: PublicKey[] = [];
	instructionsChunk.forEach((ixn) => {
		ixn.keys.forEach((key) => {
			addressesMain.push(key.pubkey);
		});
	});

	const versionedTx = new VersionedTransaction(instructionsChunk);
	const serializedMsg = versionedTx.serialize();

	console.log("Txn size:", serializedMsg.length);
	if (serializedMsg.length > 1232) {
		console.log("tx too big");
	}

	if (keypairs) {
		versionedTx.sign([wallet, ...keypairs]);
	} else {
		versionedTx.sign([wallet]);
	}

	/*
    // Simulate each txn
    const simulationResult = await connection.simulateTransaction(versionedTx, { commitment: "processed" });

    if (simulationResult.value.err) {
    console.log("Simulation error:", simulationResult.value.err);
    } else {
    console.log("Simulation success. Logs:");
    simulationResult.value.logs?.forEach(log => console.log(log));
    }
    */

	return versionedTx;
}

async function processInstructionsSOL(blockhash: string | Blockhash, keypairSOLIxs: TransactionInstruction[]): Promise<VersionedTransaction[]> {
	const instructionChunks = chunkArray(keypairSOLIxs, 10); // Adjust the chunk size as needed
	const sendTxns: VersionedTransaction[] = [];

	for (let i = 0; i < instructionChunks.length; i++) {
		const versionedTx = await createAndSignVersionedTx(instructionChunks[i], blockhash);
		sendTxns.push(versionedTx);
	}

	return sendTxns;
}

async function distributeWSOL(jitoTip: number, steps = 5) {
	const keypairs = loadKeypairs();
	let totalSolRequired = 0;
	const ixsTransfer: TransactionInstruction[] = [];

	for (let i = 0; i < Math.min(steps, keypairs.length); i++) {
		const amountInSOL = parseFloat(prompt(`Enter the amount of WSOL to send to Wallet ${i + 1}: `));
		const distributeAmt = amountInSOL * LAMPORTS_PER_SOL; // Convert SOL to lamports
		totalSolRequired += amountInSOL;

		const keypair = keypairs[i];
		const ataAddressKeypair = await spl.getAssociatedTokenAddress(new PublicKey(spl.NATIVE_MINT), keypair.publicKey);

		console.log(`Distributed ${distributeAmt / LAMPORTS_PER_SOL} WSOL to Wallet ${i + 1} (${keypair.publicKey.toString()}) ATA`);
	}

	ixsTransfer.push(
		SystemProgram.transfer({
			fromPubkey: wallet.publicKey,
			toPubkey: tipAcct,
			lamports: BigInt(jitoTip),
		})
	);
	console.log("tip pushed :)");

	const bundleTxns: VersionedTransaction[] = [];
	const chunkSize = 6; // EDIT CHUNK SIZE
	const ixsChunks = chunkArray(ixsTransfer, chunkSize);

	const { blockhash } = await connection.getLatestBlockhash();

	// Create and sign each chunk of instructions
	for (const chunk of ixsChunks) {
		const versionedTx = await createAndSignVersionedTx(chunk, blockhash);
		bundleTxns.push(versionedTx);
	}

	// Finally... SEND BUNDLE
	await sendBundleWithParameters(bundleTxns);
	bundleTxns.length = 0;
	ixsTransfer.length = 0;
}

async function generateWSOLATAForKeypairs(steps: number = 5): Promise<TransactionInstruction[]> {
	const keypairs: Keypair[] = loadKeypairs();
	const keypairWSOLATAIxs: TransactionInstruction[] = [];

	for (const [index, keypair] of keypairs.entries()) {
		if (index >= steps) break;
		const wsolataAddress = await spl.getAssociatedTokenAddress(new PublicKey(spl.NATIVE_MINT), keypair.publicKey);
		const createWSOLAta = spl.createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey, wsolataAddress, keypair.publicKey, new PublicKey(spl.NATIVE_MINT));

		keypairWSOLATAIxs.push(createWSOLAta);
		console.log(`Created WSOL ATA for Wallet ${index + 1} (${keypair.publicKey.toString()}).`);
	}

	return keypairWSOLATAIxs;
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
	const chunks = [];
	for (let i = 0; i < array.length; i += chunkSize) {
		chunks.push(array.slice(i, i + chunkSize));
	}
	return chunks;
}

async function processWSOLInstructionsATA(jitoTipAmt: number, blockhash: string | Blockhash, keypairWSOLATAIxs: TransactionInstruction[]): Promise<VersionedTransaction[]> {
	const instructionChunks = chunkArray(keypairWSOLATAIxs, 10); // Adjust the chunk size as needed
	const WSOLtxns: VersionedTransaction[] = [];

	for (let i = 0; i < instructionChunks.length; i++) {
		if (i === instructionChunks.length - 1) {
			const tipIxn = SystemProgram.transfer({
				fromPubkey: wallet.publicKey,
				toPubkey: tipAcct,
				lamports: BigInt(jitoTipAmt),
			});
			instructionChunks[i].push(tipIxn);
			console.log("Jito tip added :).");
		}
		const versionedTx = await createAndSignVersionedTx(instructionChunks[i], blockhash);
		WSOLtxns.push(versionedTx);
	}

	return WSOLtxns;
}

async function sendBundleWithParameters(bundledTxns: VersionedTransaction[]) {
	/*
        // Simulate each transaction
        for (const tx of bundledTxns) {
            try {
                const simulationResult = await connection.simulateTransaction(tx, { commitment: "processed" });
                console.log(simulationResult);

                if (simulationResult.value.err) {
                    console.error("Simulation error for transaction:", simulationResult.value.err);
                } else {
                    console.log("Simulation success for transaction. Logs:");
                    simulationResult.value.logs?.forEach(log => console.log(log));
                }
            } catch (error) {
                console.error("Error during simulation:", error);
            }
        }
    */

	try {
		const bundleId = await searcherClient.sendBundle(new JitoBundle(bundledTxns, bundledTxns.length));
		console.log(`Bundle ${bundleId} sent.`);
	} catch (error) {
		const err = error as any;
		console.error("Error sending bundle:", err.message);

		if (err?.message?.includes("Bundle Dropped, no connected leader up soon")) {
			console.error("Error sending bundle: Bundle Dropped, no connected leader up soon.");
		} else {
			console.error("An unexpected error occurred:", err.message);
		}
	}
}

async function generateATAandSOL() {
	const BundledTxns: VersionedTransaction[] = [];

	console.log("\n!!! WARNING: SOL IS FOR TXN FEES ONLY !!!");
	const SolAmt = prompt("Sol to send (Ex. 0.005): ");
	const jitoTipAmtInput = prompt("Jito tip in Sol (Ex. 0.01): ");
	const SendAmt = parseFloat(SolAmt);
	const jitoTipAmt = parseFloat(jitoTipAmtInput) * LAMPORTS_PER_SOL;

	const { blockhash } = await connection.getLatestBlockhash();

	const sendSolIxs = await generateSOLTransferForKeypairs(SendAmt);
	const sendSolTxns = await processInstructionsSOL(blockhash, sendSolIxs);
	BundledTxns.push(...sendSolTxns);

	const wsolATAixs = await generateWSOLATAForKeypairs();
	const wsolATATxns = await processWSOLInstructionsATA(jitoTipAmt, blockhash, wsolATAixs);
	BundledTxns.push(...wsolATATxns);

	await sendBundleWithParameters(BundledTxns);
}

export async function sender() {
	let running = true;

	while (running) {
		console.log("\nBuyer UI:");
		console.log("1. Generate WSOL ATA and Send SOL");
		console.log("2. Send WSOL (Volume)");

		const answer = prompt("Choose an option or 'exit': "); // Use prompt-sync for user input

		switch (answer) {
			case "1": // NEED
				await generateATAandSOL();
				break;
			case "2": // WSOL SEND
				const jitoTipIn = prompt("Jito tip in Sol (Ex. 0.01): ");
				const TipAmt = parseFloat(jitoTipIn) * LAMPORTS_PER_SOL;
				await distributeWSOL(TipAmt);
				break;
			case "exit":
				running = false;
				break;
			default:
				console.log("Invalid option, please choose again.");
		}
	}

	console.log("Exiting...");
}
