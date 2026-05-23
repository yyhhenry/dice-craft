import * as readline from "readline"
import { createApp } from "./app"
import { WorkspaceManager } from "./workspace/manager"

async function main() {
  console.log("🎲 DiceCraft - Tabletop Game Creation & Play Platform")
  console.log("Phase: Workspace & Session Support\n")

  const workspaceManager = new WorkspaceManager("data/workspaces")
  const workspace = workspaceManager.initCLI()

  const app = createApp({ dataDir: "data", workspaceId: workspace.id })

  // Restore last session
  const lastSession = app.sessionManager.getLastSession(workspace.id)
  let sessionId: string | undefined

  if (lastSession) {
    sessionId = lastSession.id
    const messages = app.sessionManager.getMessages(lastSession.id)
    // Strip _meta and set as history (skip system prompt, which is handled by AgentLoop)
    const history = messages.map(({ _meta, ...rest }) => rest)
    app.primaryAgent.setHistory(history)
    console.log(`Restored session: ${lastSession.title} (${lastSession.messageCount} messages)`)

    // Restore subagent sessions
    const subagents = app.sessionManager.listSubagents(lastSession.id)
    for (const sub of subagents) {
      app.dispatcher.restore(sub.id)
    }
    if (subagents.length > 0) {
      console.log(`Restored ${subagents.length} subagent session(s)`)
    }
    console.log("")
  }

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

    // Create session on first message if needed
    if (!sessionId) {
      const session = app.sessionManager.create({
        workspaceId: workspace.id,
        agentType: "primary",
        title: input.slice(0, 50),
      })
      sessionId = session.id
    }

    try {
      console.log("<agent>")
      const { history } = await app.primaryAgent.run(input, undefined, {
        onToken: (token) => process.stdout.write(token),
      })
      console.log("\n</agent>\n")

      // Persist messages to session
      app.sessionManager.clearMessages(sessionId)
      for (const msg of history) {
        app.sessionManager.appendMessage(sessionId, msg)
      }
    } catch (error) {
      console.error("\nError:", error instanceof Error ? error.message : error)
    }
  }
}

main().catch(console.error)
