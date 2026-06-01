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
      "Array fields (characters, texts, map.overlays, map.labels, objectives) merge by id — " +
      "pass {id, _remove: true} to delete an element.\n\n" +
      "Map grid: write a text-art file first (one char per cell), then pass its path as map.mapFile. " +
      "Terrain legend: W=wall g=grass s=stone f=wood d=dirt a=sand w=water l=lava i=ice .=void\n\n" +
      "Characters: set location to \"x,y\" to place on grid. " +
      "Set visible: false to hide from the player.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Scene title" },
        dm: {
          type: "object",
          description: "DM display state (partial update)",
          properties: {
            name: { type: "string" },
            status: { type: "string", enum: ["idle", "thinking", "speaking", "offline"] },
            latestSummary: { type: "string" },
          },
        },
        map: {
          type: "object",
          description: "Map configuration",
          properties: {
            title: { type: "string" },
            mapFile: {
              type: "string",
              description: "Path to text-art map file in workspace (e.g. .game-state/tavern.map)",
            },
            overlays: {
              type: "array",
              description: "Map overlays (doors, chests, etc). Merge by id.",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  x: { type: "integer" },
                  y: { type: "integer" },
                  type: { type: "string", description: "door, chest, trap, stairs, marker" },
                  label: { type: "string" },
                  _remove: { type: "boolean" },
                },
                required: ["id"],
              },
            },
            labels: {
              type: "array",
              description: "Text labels on the map grid. Merge by id.",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  text: { type: "string" },
                  x: { type: "integer" },
                  y: { type: "integer" },
                  style: { type: "string", enum: ["area", "label", "alert"] },
                  _remove: { type: "boolean" },
                },
                required: ["id"],
              },
            },
          },
        },
        texts: {
          type: "array",
          description: "Text blocks displayed outside the map area. Merge by id.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              content: { type: "string" },
              style: { type: "string", enum: ["narrative", "status", "alert", "info"] },
              _remove: { type: "boolean" },
            },
            required: ["id"],
          },
        },
        characters: {
          type: "array",
          description: "Characters on the scene. Merge by id. Set location to \"x,y\" for grid placement.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              role: { type: "string", enum: ["npc", "player", "enemy", "ally", "neutral"] },
              sessionId: { type: "string" },
              summary: { type: "string" },
              status: { type: "string" },
              location: { type: "string", description: "Grid position as \"x,y\"" },
              visible: { type: "boolean" },
              _remove: { type: "boolean" },
            },
            required: ["id"],
          },
        },
        mainQuest: {
          type: "object",
          description: "Main quest (partial update). Objectives merge by id.",
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
                  _remove: { type: "boolean" },
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
