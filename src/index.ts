import "dotenv/config"
import * as readline from "readline"
import { OpenAIModel, type ModelConfig } from "./model/openai"
import { ToolRegistry } from "./tool/base"
import { GetCurrentTimeTool } from "./tool/time"
import { AgentLoop } from "./agent/loop"
import systemPrompt from "./agent/prompt/builder.txt" with { type: "text" }

function loadConfig(): ModelConfig {
  const baseUrl = process.env.OPENAI_BASE_URL
  const apiKey = process.env.MIMO_API_KEY
  const model = process.env.MODEL_NAME ?? "mimo-v2.5-pro"

  if (!baseUrl) throw new Error("Missing OPENAI_BASE_URL environment variable")
  if (!apiKey) throw new Error("Missing MIMO_API_KEY environment variable")

  return {
    baseUrl,
    apiKey,
    model,
    maxTokens: 4096,
  }
}

async function main() {
  console.log("🎲 DiceCraft - Tabletop Game Creation & Play Platform")
  console.log("Phase: Agent Loop Validation")
  console.log("Type /quit to exit\n")

  const config = loadConfig()
  const model = new OpenAIModel(config)

  const registry = new ToolRegistry()
  registry.register(GetCurrentTimeTool)

  const agent = new AgentLoop(model, registry, { systemPrompt })

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const ask = () => {
    rl.question("user$ ", async (input) => {
      const trimmed = input.trim()
      console.log("")

      if (trimmed === "/quit") {
        console.log("Goodbye!")
        rl.close()
        return
      }

      if (!trimmed) {
        ask()
        return
      }

      try {
        console.log("<agent>")
        const { response } = await agent.run(trimmed, [], {
          onToken: (token) => process.stdout.write(token),
        })
        console.log("\n</agent>\n")
      } catch (error) {
        console.error("\nError:", error instanceof Error ? error.message : error)
      }

      ask()
    })
  }

  ask()
}

main().catch(console.error)
