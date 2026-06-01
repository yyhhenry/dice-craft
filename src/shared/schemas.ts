import { z } from "zod"

export const WorkspaceConfigSchema = z.object({
  apiBaseUrl: z.url(),
  apiKey: z.string().min(1),
  modelName: z.string().min(1),
})

export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>

export const SendMessageSchema = z.object({
  content: z.string().min(1),
})

export type SendMessagePayload = z.infer<typeof SendMessageSchema>
