interface MockResponse {
  content?: string | null
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }> | null
  finishReason?: string
}

function buildCompletion(response: MockResponse): object {
  const id = "chatcmpl-mock-001"
  const toolCalls = response.toolCalls?.map((tc, i) => ({
    id: tc.id,
    index: i,
    type: "function",
    function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
  }))

  return {
    id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "mock-model",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: response.content ?? null,
          ...(toolCalls ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: response.finishReason ?? (toolCalls ? "tool_calls" : "stop"),
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  }
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
        const completion = buildCompletion(response)
        return Response.json(completion)
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
