import * as readline from "readline"
import { createApp } from "./app"
import { WorkspaceManager } from "./workspace/manager"

function wrapChatXml(sender: string, senderName: string, content: string): string {
  return `<chat sender="${sender}" sender_name="${senderName}">${content}</chat>`
}

async function main() {
  console.log("🎲 DiceCraft - Tabletop Game Creation & Play Platform")
  console.log("Chat Mode: messages flow through chat.jsonl\n")

  const workspaceManager = new WorkspaceManager("data/workspaces")
  const workspace = workspaceManager.initCLI()

  let primarySessionId = "sess_primary"

  const app = createApp({
    dataDir: "data",
    workspaceId: workspace.id,
    workspacePath: workspace.path,
    skillsDir: workspace.skillsDir,
    primarySessionId,
    onMessage: (senderName, content) => {
      console.log(`[${senderName}] ${content}\n`)
    },
  })

  // Restore last session
  const lastSession = app.sessionManager.getLastSession(workspace.id)

  if (lastSession) {
    primarySessionId = lastSession.id
    const messages = app.sessionManager.getMessages(lastSession.id)
    const history = messages.map(({ _meta, ...rest }) => rest)
    app.primaryAgent.setHistory(history)
    console.log(`Restored session: ${lastSession.title} (${lastSession.messageCount} messages)`)

    const subagents = app.sessionManager.listSubagents(lastSession.id)
    for (const sub of subagents) {
      app.dispatcher.restore(sub.id)
    }
    if (subagents.length > 0) {
      console.log(`Restored ${subagents.length} subagent session(s)`)
    }

    // Show recent chat history
    const chatHistory = app.chatManager.getRecentMessages(primarySessionId, 5)
    if (chatHistory.length > 0) {
      console.log("\nRecent chat:")
      for (const msg of chatHistory) {
        console.log(`  [${msg.senderName}] ${msg.content}`)
      }
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
    if (!lastSession) {
      const session = app.sessionManager.create({
        workspaceId: workspace.id,
        agentType: "primary",
        title: input.slice(0, 50),
      })
      primarySessionId = session.id
    }

    try {
      // Write user message to chat
      app.chatManager.sendMessage(primarySessionId, {
        content: input,
        senderId: "user",
        senderName: "玩家",
        senderRole: "user",
      })

      // Send to primary agent via receiveMessage
      const chatXml = wrapChatXml("user", "玩家", input)
      app.primaryAgent.receiveMessage(chatXml)
      await app.primaryAgent.waitForIdle()

      // Persist agent internal messages
      const history = app.primaryAgent.getHistory()
      app.sessionManager.clearMessages(primarySessionId)
      for (const msg of history) {
        app.sessionManager.appendMessage(primarySessionId, msg)
      }
    } catch (error) {
      console.error("\nError:", error instanceof Error ? error.message : error)
    }
  }
}

main().catch(console.error)
