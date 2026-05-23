import * as readline from "readline"
import { createApp } from "./assembly"

async function main() {
  console.log("🎲 DiceCraft - Tabletop Game Creation & Play Platform")
  console.log("Phase: Subagent Support")
  console.log("Type /quit to exit\n")

  const app = createApp()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve))

  while (true) {
    const input = (await question("user$ ")).trim()
    console.log("")

    if (input === "/quit") {
      console.log("Goodbye!")
      rl.close()
      break
    }

    if (!input) continue

    try {
      console.log("<agent>")
      await app.primaryAgent.run(input, [], {
        onToken: (token) => process.stdout.write(token),
      })
      console.log("\n</agent>\n")
    } catch (error) {
      console.error("\nError:", error instanceof Error ? error.message : error)
    }
  }
}

main().catch(console.error)
