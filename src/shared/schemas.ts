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

// --- SceneState schemas ---

export const SceneMapCellSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  terrain: z.string(),
})

export const SceneOverlaySchema = z.object({
  id: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  type: z.string(),
  label: z.string().optional(),
})

export const MapLabelSchema = z.object({
  id: z.string(),
  text: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  style: z.enum(["area", "label", "alert"]).optional(),
})

export const SceneMapSchema = z.object({
  title: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  cells: z.array(SceneMapCellSchema).optional(),
  overlays: z.array(SceneOverlaySchema).optional(),
  labels: z.array(MapLabelSchema).optional(),
})

export const SceneTextSchema = z.object({
  id: z.string(),
  content: z.string(),
  style: z.enum(["narrative", "status", "alert", "info"]).optional(),
})

export const SceneDMSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["idle", "thinking", "speaking", "offline"]),
  latestSummary: z.string().optional(),
})

export const CharacterRoleSchema = z.enum(["npc", "player", "enemy", "ally", "neutral"])

export const SceneCharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: CharacterRoleSchema,
  sessionId: z.string().optional(),
  summary: z.string().optional(),
  status: z.string().optional(),
  location: z.string().optional(),
  visible: z.boolean(),
})

export const SceneObjectiveSchema = z.object({
  id: z.string(),
  text: z.string(),
  status: z.enum(["active", "completed", "failed", "hidden"]),
})

export const SceneQuestSchema = z.object({
  title: z.string(),
  summary: z.string().optional(),
  objectives: z.array(SceneObjectiveSchema),
})

export const StatEntrySchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  max: z.union([z.string(), z.number()]).optional(),
})

export const ScenePlayerCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string().optional(),
  stats: z.array(StatEntrySchema).optional(),
  resources: z.array(StatEntrySchema).optional(),
  conditions: z.array(z.string()).optional(),
})

export const SceneStateSchema = z.object({
  sessionId: z.string(),
  version: z.number().int(),
  title: z.string().optional(),
  dm: SceneDMSchema,
  map: SceneMapSchema,
  texts: z.array(SceneTextSchema).optional(),
  characters: z.array(SceneCharacterSchema),
  mainQuest: SceneQuestSchema.optional(),
  playerCard: ScenePlayerCardSchema.optional(),
  updatedAt: z.string(),
})

export type SceneMapCell = z.infer<typeof SceneMapCellSchema>
export type SceneOverlay = z.infer<typeof SceneOverlaySchema>
export type MapLabel = z.infer<typeof MapLabelSchema>
export type SceneMap = z.infer<typeof SceneMapSchema>
export type SceneText = z.infer<typeof SceneTextSchema>
export type SceneDM = z.infer<typeof SceneDMSchema>
export type SceneCharacter = z.infer<typeof SceneCharacterSchema>
export type SceneObjective = z.infer<typeof SceneObjectiveSchema>
export type SceneQuest = z.infer<typeof SceneQuestSchema>
export type ScenePlayerCard = z.infer<typeof ScenePlayerCardSchema>
export type SceneState = z.infer<typeof SceneStateSchema>
