import { createKeypairs } from "./src/createKeys";
import { volume } from "./src/bot";
import { sender, createReturns } from "./src/distribute";
import { calculateVolumeAndSolLoss } from "./src/simulate";
import promptSync from "prompt-sync";

const prompt = promptSync();

async function main() {
	let running = true;

	while (running) {
		console.log("DM me for info");
		console.log("https://t.me/benorizz0");
		console.log("solana-scripts.com");
		console.log("\nMenu:");
		console.log("1. Create Keypairs");
		console.log("2. Distribute SOL/WSOL");
		console.log("3. Simulate Volume");
		console.log("4. Start Volume");
		console.log("5. Reclaim SOL/WSOL");
		console.log("Type 'exit' to quit.");

		const answer = prompt("Choose an option or 'exit': "); // Use prompt-sync for user input

		switch (answer) {
			case "1":
				await createKeypairs();
				break;
			case "2":
				await sender();
				break;
			case "3":
				await calculateVolumeAndSolLoss();
				break;
			case "4":
				await volume();
				break;
			case "5":
				await createReturns();
				break;
			case "exit":
				running = false;
				break;
			default:
				console.log("Invalid option, please choose again.");
		}
	}

	console.log("Exiting...");
	process.exit(0);
}

main().catch((err) => {
	console.error("Error:", err);
});
