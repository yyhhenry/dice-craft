import type { Tool, ToolResult } from "./base"
import type { SceneManager, UpdateScenePatch } from "../scene/manager"
import type { SceneState } from "../shared/schemas"

export function createUpdateSceneTool(
  sceneManager: SceneManager,
  sessionRef: { id: string },
  workspacePath: string,
  onUpdate: (state: SceneState) => void,
): Tool {
  return {
    id: "update_scene",
    description:
      "Update the game scene displayed to the player. Pass only the fields you want to change. " +
      "Array fields (characters, overlays, labels) are FULL REPLACEMENT — " +
      "include ALL items you want to keep; omitted items are removed.\n\n" +
      "Map grid: write a CSV file first (.map.csv), one terrain name per cell, comma-separated. " +
      "Valid terrain: wall, grass, stone, wood, dirt, sand, water, lava, ice, void (or empty). " +
      "Append .dark or .light for shade variants (e.g. wood.dark for furniture vs wood floor). " +
      "Then pass its path as map.mapFile.\n\n" +
      'Characters: set location to "x,y" to place on grid. ' +
      "Set hidden: true to hide from the player.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Scene title" },
        map: {
          type: "object",
          description: "Map configuration",
          properties: {
            title: { type: "string" },
            mapFile: {
              type: "string",
              description: "Path to CSV map file in workspace (e.g. .game-state/tavern.map.csv)",
            },
            overlays: {
              type: "array",
              description: "Map overlays (doors, chests, etc). Full replacement.",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  x: { type: "integer" },
                  y: { type: "integer" },
                  type: { type: "string", description: "door, chest, trap, stairs, marker" },
                  label: { type: "string" },
                },
                required: ["id"],
              },
            },
            labels: {
              type: "array",
              description: "Text labels on the map grid. Full replacement.",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  text: { type: "string" },
                  x: { type: "integer" },
                  y: { type: "integer" },
                  style: { type: "string", enum: ["area", "label", "alert"] },
                },
                required: ["id"],
              },
            },
          },
        },
        characters: {
          type: "array",
          description: "ALL characters in the scene. Full replacement — include every character you want to keep.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              role: { type: "string", enum: ["npc", "player", "enemy", "ally", "neutral"] },
              sessionId: { type: "string" },
              summary: { type: "string" },
              status: { type: "string" },
              location: { type: "string", description: 'Grid position as "x,y"' },
              hidden: { type: "boolean", description: "Set true to hide from the player" },
            },
            required: ["id"],
          },
        },
        mainQuest: {
          type: "object",
          description: "Main quest. Full replacement when provided.",
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            objectives: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  text: { type: "string" },
                  status: { type: "string", enum: ["active", "completed", "failed", "hidden"] },
                },
                required: ["id"],
              },
            },
          },
        },
        playerCard: {
          type: "object",
          description: "Player character card (partial update)",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            summary: { type: "string" },
            stats: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  value: {},
                  max: {},
                },
                required: ["label", "value"],
              },
            },
            resources: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  value: {},
                  max: {},
                },
                required: ["label", "value"],
              },
            },
            conditions: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
    async execute(args: Record<string, unknown>): Promise<ToolResult> {
      try {
        const patch = args as unknown as UpdateScenePatch
        const state = sceneManager.updateState(sessionRef.id, patch, workspacePath)
        onUpdate(state)
        return { content: `Scene updated (v${state.version})` }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: `Error updating scene: ${msg}`, isError: true }
      }
    },
  }
}
