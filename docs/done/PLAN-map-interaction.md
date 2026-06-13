# PLAN: 地图交互 — 点击移动与路径动画

## 设计目标

让地图从静态展示变为可交互：玩家可以点击格子移动角色，模型验证移动是否合法并返回路径动画。NPC 可以在 update_scene 时附带移动序列，前端播放移动动画。

---

## 交互流程

### 玩家移动

```
玩家点击格子 → 操作菜单 → "移动到这里"
  → 前端发送聊天消息 "（移动到 x,y）"
  → GM 判断是否合法
  ├─ 合法 → update_scene(player.location=目标, player.movePath=[路径])
  │         → 前端播放移动动画
  │         → 如果目标附近有 NPC → GM 可选触发 NPC 反应
  └─ 不合法 → GM 通过 message 提示原因
```

### 与 NPC 互动

```
玩家点击 NPC → 操作菜单 → "互动"
  → 前端发送聊天消息 "（与 [角色名] 互动）"
  → GM 自行判断：是否需要移动、移动到哪（可能隔着桌子不需要走过去）
  → GM 可选移动玩家 + notify NPC 反应
```

### NPC 移动（GM 主动）

```
GM 调用 update_scene(npc.location=新位置, npc.movePath=[路径])
→ 前端播放 NPC 移动动画
```

---

## Schema 扩展

### SceneCharacter 新增字段

```ts
export const CharacterActionSchema = z.object({
  id: z.string(),          // 动作标识，如 "attack", "heal", "trade"
  label: z.string(),       // 显示文本，如 "攻击", "治疗", "交易"
})

export const SceneCharacterSchema = z.object({
  // ...existing fields...
  location: z.string().optional(),             // 最终位置 "x,y"
  movePath: z.array(z.string()).optional(),     // 移动路径 ["3,4", "3,5", "3,6"]
  actions: z.array(CharacterActionSchema).optional(), // 自定义交互动作
})
```

### 操作菜单逻辑

点击角色弹出的菜单：
- **"互动"**（默认，始终显示）→ `<event source="map" type="interact" character="老陈"/>`
- **自定义动作**（从 character.actions 读取）→ `<event source="map" type="action" character="老陈" action="attack"/>`
- **"取消"**（关闭菜单）

点击格子弹出的菜单：
- **"移动到这里"** → `<event source="map" type="move" x="3" y="5"/>`
- **"取消"**

GM 通过 update_scene 设置角色的 actions，例如：
```json
{ "id": "player", "actions": [{ "id": "attack", "label": "攻击" }, { "id": "heal", "label": "治疗" }] }
```

### movePath 语义

- 每次 `update_scene` 是一个"分镜"，`movePath` 代表本次分镜中角色的移动
- 前端收到 scene.updated 时自动播放所有有 movePath 的角色的动画
- Replay 按钮：重放当前分镜中的所有移动动画
- 下次 update_scene 会整体替换 characters 数组——没有 movePath 的角色表示本轮没动
- 如果没有 `movePath`，角色直接显示在 `location`（向后兼容）

---

## 前端交互

### 指针悬停

- 鼠标经过格子时高亮该格子（半透明边框/底色）
- 鼠标经过角色时角色 token 放大/发光提示可交互

### 点击 → 操作菜单

点击格子或角色不是直接触发行动，而是弹出操作框（Popover / Context Menu）：

- **点击空格子**：弹出菜单
  - "移动到这里" — 发送 move_request
  - "查看地形" — 显示地形信息（可选）
  
- **点击 NPC**：弹出菜单
  - "走过去互动" — 发送 interact_request（移动 + 对话）
  - "查看信息" — 显示角色 summary/status

- **点击自己（player）**：弹出菜单
  - "查看状态" — 打开 player card
  - 其他自定义动作（后续扩展）

操作框选择后发送对应请求，等待 GM 响应时显示 pending 状态。

### 移动动画

- 角色沿 `movePath` 逐格移动，每格 200-300ms
- 动画期间角色 token 平滑滑动
- 多个角色可以同时动画（不同 movePath 并行播放）
- **动画结束后 movePath 保留在 scene state 中**，不清除

### Replay

- 场景面板提供 "Replay" 按钮
- 点击后重新播放当前 scene 中所有角色的 movePath 动画
- 用于回看本轮发生了什么移动

---

## 后端处理

### 事件格式

地图操作通过前端现有 WebSocket `send_message` 发送，但内容使用 event XML 格式与普通聊天区分：

```xml
<!-- 玩家点击格子选择"移动到这里" -->
<event source="map" type="move" x="3" y="5"/>

<!-- 玩家点击角色选择"互动"（默认动作） -->
<event source="map" type="interact" character="老陈"/>

<!-- 玩家点击角色选择自定义动作 -->
<event source="map" type="action" character="老陈" action="attack"/>
```

后端 ws.ts 识别 `<event` 开头的消息，不写入 chat（不作为聊天消息显示），直接转发给 agent：

```ts
const isEvent = content.trim().startsWith("<event")
if (isEvent) {
  // 不写入 chat.jsonl，直接发给 agent
  app.primaryAgent.receiveMessage(content)
} else {
  // 正常聊天消息流程
  app.chatManager.sendMessage(...)
  app.primaryAgent.receiveMessage(chatXml)
}
```

### update_scene tool 适配

- `movePath` 直接透传到 SceneState
- **movePath 持久化**：保存在 scene state 中不自动清除，直到下一次 update_scene 覆盖
- 前端从 `scene.updated` 事件中读取并播放动画
- GM 下次 update_scene 时如果角色没动，不传 movePath 即可（保留已有的）

---

## GM Prompt 新增

```markdown
## Map Events

Players interact with the map by clicking. You will receive events like:

  <event source="map" type="move" x="3" y="5"/>
  <event source="map" type="interact" character="老陈"/>

These are NOT chat messages — the player clicked the map, not typed text.

When you receive a map event:
1. type="move": Player wants to move to (x,y).
   - Check if valid (not wall, reasonable distance)
   - Valid → update_scene with new location + movePath
   - Invalid → message explaining why
2. type="interact": Player wants to interact with a character.
   - Decide if player needs to move closer (update_scene + movePath)
   - Notify the NPC to react to the player's approach
3. type="action": Player chose a custom action on a character.
   - Handle based on the action id (attack, heal, trade, etc.)
   - Resolve game mechanics, update scene/state as needed

You can define custom actions per character via update_scene:
  characters: [{ id: "goblin", actions: [{ id: "attack", label: "攻击" }] }]
These appear in the player's context menu when clicking that character.

movePath rules:
- Array of "x,y" from start to end (inclusive)
- Simple paths only (straight or L-shaped)
- Only set movePath for characters that moved this turn
```

---

## 实施顺序

1. SceneCharacter schema 新增 `movePath` 字段
2. 后端 ws.ts：识别 `<event` 开头消息，不写入 chat，直接转发 agent
3. 前端 TileMapSvg：悬停高亮 + 点击事件
4. 操作菜单组件（Popover：移动到这里 / 互动 / 查看信息）
5. 点击操作 → 发送 event XML 消息
6. 前端移动动画（角色沿 movePath 滑动）
7. Replay 按钮（重放当前 scene 的所有 movePath）
8. Builder prompt 新增 map events 指导
9. 端到端测试

---

## 注意事项

- 路径计算不做复杂寻路——GM 自己写路径坐标即可（直线或简单拐弯）
- 动画是纯前端表现，不影响游戏逻辑
- `movePath` 代表当前分镜的移动，随下次 update_scene 自然替换
- 向后兼容：没有 movePath 时行为和现在一样（瞬移）
