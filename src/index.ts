import * as readline from "readline"
import { createApp, type App } from "./app"
import { WorkspaceManager } from "./workspace/manager"
import type { WorkspaceID } from "./workspace/types"

if (process.argv.includes("--serve")) {
  const { startServer } = await import("./server/start")
  await startServer()
} else {
  main().catch(console.error)
}

function wrapChatXml(sender: string, senderName: string, content: string): string {
  return `<chat sender="${sender}" sender_name="${senderName}">${content}</chat>`
}

function loadSession(app: App, sessionId: string): void {
  app.sessionRef.id = sessionId
  const messages = app.sessionManager.getMessages(sessionId)
  const history = messages.map(({ _meta, ...rest }) => rest)
  app.primaryAgent.setHistory(history)

  // Restore subagent sessions
  const subagents = app.sessionManager.listSubagents(sessionId)
  for (const sub of subagents) {
    app.dispatcher.restore(sub.id)
  }
}

async function main() {
  console.log("🎲 DiceCraft - Tabletop Game Creation & Play Platform")
  console.log("Chat Mode: messages flow through chat.jsonl")
  console.log("Commands: /new, /sessions, /session <id>, /quit\n")

  const workspaceManager = new WorkspaceManager("data/workspaces")
  const workspace = workspaceManager.initCLI()

  const app = createApp({
    dataDir: "data",
    workspaceId: workspace.id,
    workspacePath: workspace.path,
    skillsDir: workspace.skillsDir,
    primarySessionId: "sess_primary",
    onMessage: (senderName, content) => {
      console.log(`[${senderName}] ${content}\n`)
    },
  })

  // Show last session info (don't auto-load)
  const lastSession = app.sessionManager.getLastSession(workspace.id)

  if (lastSession) {
    console.log(`Last session: ${lastSession.id} — "${lastSession.title}" (${lastSession.messageCount} messages)`)
    console.log(`  Load it with: /session ${lastSession.id}\n`)
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve))

  let firstMessage = true

  while (true) {
    const input = (await question("user$ ")).trim()
    console.log("")

    if (input === "/quit") {
      console.log("Goodbye!")
      rl.close()
      break
    }

    if (input === "/new") {
      const session = app.sessionManager.create({
        workspaceId: workspace.id as WorkspaceID,
        agentType: "primary",
        title: "New session",
      })
      loadSession(app, session.id)
      firstMessage = true
      console.log(`Created session: ${session.id}\n`)
      continue
    }

    if (input === "/sessions") {
      const sessions = app.sessionManager.listByWorkspace(workspace.id as WorkspaceID)
      if (sessions.length === 0) {
        console.log("No sessions.\n")
      } else {
        for (const s of sessions) {
          const marker = s.id === app.sessionRef.id ? " *" : ""
          console.log(`  ${s.id}  ${s.title}${marker}  (${s.messageCount} msgs)`)
        }
        console.log("")
      }
      continue
    }

    if (input.startsWith("/session ")) {
      const targetId = input.slice("/session ".length).trim()
      const session = app.sessionManager.get(targetId)
      if (!session) {
        console.log(`Session not found: ${targetId}\n`)
        continue
      }
      loadSession(app, targetId)
      firstMessage = false
      console.log(`Switched to: ${session.title} (${session.messageCount} messages)\n`)
      continue
    }

    if (!input) continue

    // Create session on first message if needed
    if (firstMessage) {
      const session = app.sessionManager.create({
        workspaceId: workspace.id as WorkspaceID,
        agentType: "primary",
        title: input.slice(0, 50),
      })
      app.sessionRef.id = session.id
      firstMessage = false
      console.log(`Created session: ${session.id}\n`)
    }

    try {
      // Write user message to chat
      app.chatManager.sendMessage(app.sessionRef.id, {
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
      app.sessionManager.clearMessages(app.sessionRef.id)
      for (const msg of history) {
        app.sessionManager.appendMessage(app.sessionRef.id, msg)
      }
    } catch (error) {
      console.error("\nError:", error instanceof Error ? error.message : error)
    }
  }
}
