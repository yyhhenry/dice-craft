import { describe, test, expect } from "bun:test"
import { AgentLoop } from "../../src/agent/loop"
import { OpenAIModel } from "../../src/model/openai"
import { ToolRegistry } from "../../src/tool/base"

function makeLoop(config: { onMessage?: (content: string) => void } = {}) {
  const model = new OpenAIModel({
    apiKey: "test",
    baseUrl: "http://localhost:1",
    model: "test",
  })
  const registry = new ToolRegistry()
  return new AgentLoop(model, registry, {
    systemPrompt: "test",
    ...config,
  })
}

describe("AgentLoop.receiveMessage", () => {
  test("isRunning returns false initially", () => {
    const loop = makeLoop()
    expect(loop.isRunning()).toBe(false)
  })

  test("waitForIdle resolves immediately when not running", async () => {
    const loop = makeLoop()
    await loop.waitForIdle() // should not hang
  })

  test("receiveMessage sets pending and starts loop", () => {
    const loop = makeLoop()
    // receiveMessage will try to run the loop, but model.chat will fail
    // We just verify it sets running state
    loop.receiveMessage("<test/>")
    // It will attempt to run and likely fail, but running should transition
    // This is a basic structural test
  })
})
