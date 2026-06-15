import { z } from "zod"

const ToolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
})

const SystemMessageSchema = z.object({
  role: z.literal("system"),
  content: z.string(),
})

const UserMessageSchema = z.object({
  role: z.literal("user"),
  content: z.string(),
})

export const AssistantMessageSchema = z.object({
  role: z.literal("assistant"),
  content: z.string().nullable().optional(),
  reasoning_content: z.string().nullable().optional(),
  tool_calls: z.array(ToolCallSchema).optional(),
})

const ToolMessageSchema = z.object({
  role: z.literal("tool"),
  tool_call_id: z.string(),
  content: z.string(),
})

export const ModelMessageSchema = z.discriminatedUnion("role", [
  SystemMessageSchema,
  UserMessageSchema,
  AssistantMessageSchema,
  ToolMessageSchema,
])

export type ModelMessage = z.infer<typeof ModelMessageSchema>

export const StoredMessageSchema = ModelMessageSchema.and(
  z.object({
    _meta: z
      .object({
        id: z.string(),
        timestamp: z.string(),
      })
      .optional(),
  }),
)

export type StoredMessage = z.infer<typeof StoredMessageSchema>
