interface MockResponse {
  content?: string | null
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }> | null
  finishReason?: string
}

function sseChunk(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

function buildChunks(response: MockResponse): string[] {
  const chunks: string[] = []
  const id = "chatcmpl-mock-001"

  if (response.toolCalls) {
    for (let i = 0; i < response.toolCalls.length; i++) {
      const tc = response.toolCalls[i]!
      const argsStr = JSON.stringify(tc.arguments)
      if (i === 0) {
        chunks.push(
          sseChunk({
            id,
            object: "chat.completion.chunk",
            created: Date.now(),
            model: "mock-model",
            choices: [{ index: 0, delta: { role: "assistant", content: null }, finish_reason: null }],
          }),
          sseChunk({
            id,
            object: "chat.completion.chunk",
            created: Date.now(),
            model: "mock-model",
            choices: [{ index: 0, delta: { tool_calls: [{ index: i, id: tc.id, type: "function", function: { name: tc.name, arguments: "" } }] }, finish_reason: null }],
          }),
          sseChunk({
            id,
            object: "chat.completion.chunk",
            created: Date.now(),
            model: "mock-model",
            choices: [{ index: 0, delta: { tool_calls: [{ index: i, function: { arguments: argsStr } }] }, finish_reason: null }],
          }),
        )
      } else {
        chunks.push(
          sseChunk({
            id,
            object: "chat.completion.chunk",
            created: Date.now(),
            model: "mock-model",
            choices: [{ index: 0, delta: { tool_calls: [{ index: i, id: tc.id, type: "function", function: { name: tc.name, arguments: argsStr } }] }, finish_reason: null }],
          }),
        )
      }
    }
    chunks.push(
      sseChunk({
        id,
        object: "chat.completion.chunk",
        created: Date.now(),
        model: "mock-model",
        choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
      }),
    )
  } else {
    const content = response.content ?? ""
    chunks.push(
      sseChunk({
        id,
        object: "chat.completion.chunk",
        created: Date.now(),
        model: "mock-model",
        choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
      }),
    )
    for (const char of content) {
      chunks.push(
        sseChunk({
          id,
          object: "chat.completion.chunk",
          created: Date.now(),
          model: "mock-model",
          choices: [{ index: 0, delta: { content: char }, finish_reason: null }],
        }),
      )
    }
    chunks.push(
      sseChunk({
        id,
        object: "chat.completion.chunk",
        created: Date.now(),
        model: "mock-model",
        choices: [{ index: 0, delta: {}, finish_reason: response.finishReason ?? "stop" }],
      }),
    )
  }

  chunks.push("data: [DONE]\n\n")
  return chunks
}

export type RequestHandler = (body: any) => MockResponse

export function createMockOpenAIServer(handler: RequestHandler) {
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url)

      if (url.pathname === "/v1/models") {
        return Response.json({
          object: "list",
          data: [{ id: "mock-model", object: "model", created: 0, owned_by: "mock" }],
        })
      }

      if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
        const body = (await req.json()) as any
        const response = handler(body)
        const chunks = buildChunks(response)

        return new Response(chunks.join(""), {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        })
      }

      return new Response("Not Found", { status: 404 })
    },
  })

  return {
    baseUrl: `http://localhost:${server.port}`,
    port: server.port,
    stop: () => server.stop(),
  }
}
