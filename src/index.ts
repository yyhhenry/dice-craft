import "dotenv/config"
import * as readline from "readline"
import { OpenAIModel, type ModelConfig } from "./model/openai"
import { ToolRegistry } from "./tool/base"
import { GetCurrentTimeTool } from "./tool/time"
import { AgentLoop } from "./agent/loop"
import { AgentRegistry } from "./agent/agent"
import { SubagentDispatcher } from "./agent/subagent"
import { createSpawnSubagentTool } from "./tool/task"
import systemPrompt from "./agent/prompt/builder.txt" with { type: "text" }
import explorePrompt from "./agent/prompt/explore.txt" with { type: "text" }
import reviewPrompt from "./agent/prompt/review.txt" with { type: "text" }

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
  console.log("Phase: Subagent Support")
  console.log("Type /quit to exit\n")

  const config = loadConfig()
  const model = new OpenAIModel(config)

  // Register agents
  const agentRegistry = new AgentRegistry()
  agentRegistry.register({
    name: "build",
    description: "Primary agent for building and creating",
    mode: "primary",
    systemPrompt,
  })
  agentRegistry.register({
    name: "explore",
    description: "Research and search for information",
    mode: "subagent",
    systemPrompt: explorePrompt,
  })
  agentRegistry.register({
    name: "review",
    description: "Review code and find issues",
    mode: "subagent",
    systemPrompt: reviewPrompt,
  })

  // Register tools
  const registry = new ToolRegistry()
  registry.register(GetCurrentTimeTool)

  // Create subagent dispatcher
  const dispatcher = new SubagentDispatcher(model, registry, agentRegistry)
  registry.register(createSpawnSubagentTool(dispatcher))

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
