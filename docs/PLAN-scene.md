# Plan: Scene 渲染系统 — 2D 像素风格瓦片地图

## 背景

WebUI v1 的中央场景区目前为空占位。本文档在 [PLAN-webui-v1.md](PLAN-webui-v1.md) 的 `SceneState` 数据模型基础上，设计 **2D 像素风格瓦片地图渲染系统**，让 GM agent 能够使用预定义素材搭建可变场景，并为未来的 NPC 空间感知预留接口。

### 核心思路

- **瓦片拼接**：提供一套内置地形瓦片（grass、stone、water 等），GM 通过文本艺术文件编辑地图，前端用 SVG 逐格渲染。
- **像素风方块**：瓦片纹理为 16×16 像素程序化生成，SVG `<pattern>` 填充 + `shape-rendering: crispEdges` 实现方块像素感。
- **角色 Token**：角色以带首字母标签的彩色圆形绘制在网格上，颜色按阵营区分。
- **缩放/平移**：SVG `viewBox` 天然支持滚轮缩放和拖拽平移。

## 显示层抽象

SceneState 的各字段对应桌游中的四类实体和一类事件。以下定义这些抽象在系统中的身份、显示映射和交互方式。

### GM (Game Master)

| 维度 | 说明 |
|------|------|
| 系统身份 | Builder agent（primary agent），唯一拥有全部工具的 agent |
| 显示映射 | `SceneDM` → `DMPanel` |
| 显示内容 | 名称、运行状态（idle/thinking/speaking/offline）、最近旁白摘要 |
| 状态来源 | `status` 来自 agent 运行状态（`agent.status_changed` 事件）；`latestSummary` 由 GM 通过 `update_scene` 主动设置 |

GM 是场景的唯一控制者——搭建地图、放置角色、推进任务、更新玩家数据，全部通过 `update_scene` 工具完成。

### 玩家 (Player/User)

| 维度 | 说明 |
|------|------|
| 系统身份 | 人类用户，通过 WebSocket 发送文本消息 |
| 显示映射 | `ScenePlayerCard` → `PlayerCard`（角色卡面板）；同时作为 `SceneCharacter`（role=`"player"`）出现在地图上 |
| 角色卡内容 | 角色名、摘要、属性（stats）、资源（resources）、状态效果（conditions） |
| 地图 Token | 蓝色圆形 token，位置由 GM 设置的 `location` 决定 |

### 游戏角色 (NPC/Character)

| 维度 | 说明 |
|------|------|
| 系统身份 | NPC subagent（持久后台 agent session），或纯展示角色（无 session） |
| 显示映射 | `SceneCharacter[]` → `CharacterBadge`（信息面板）+ 地图 Token |
| 阵营/role | `npc`（中立 NPC）、`ally`（友方）、`enemy`（敌对）、`neutral`（无关） |
| 可见性 | `visible: false` 的角色不在前端显示（GM 用于追踪隐藏角色） |
| 地图 Token | 颜色按 role 区分，位置由 `location` 字段决定 |

注意：不是所有 `SceneCharacter` 都有对应的 NPC subagent session。GM 可以创建纯展示角色（无 `sessionId`），只在地图上显示 token，不参与 AI 对话。有 `sessionId` 的角色才能被 `notify` 触达。

### 用户行动 (User Actions)

玩家通过右侧聊天输入框发送自然语言文本，GM 解读为游戏内行动。

```
玩家输入 "我走到吧台前和酒保说话"
     ↓ WebSocket message.send
GM agent 接收
     ↓ 解读为：移动 + 对话触发
     ├── update_scene: 移动玩家 token 到吧台位置
     ├── notify: 通知酒保 NPC "玩家走到你面前想交谈"
     ├── message: "你走到吧台前，老酒保抬起头看向你。"
     └── 更新 .game-state/（如果有状态变化）
```

- 前端不区分行动类型——全部是自然语言，GM 自行解析意图。
- GM 根据游戏规则判定行动合法性和结果（骰子检定、距离检查等）。
- 一次用户输入可能触发多个场景更新（移动 + 状态变化 + NPC 反应）。

## 内部状态与显示对齐

### 两层状态架构

```
workspace/
├── .game-state/              ← 内部状态：完整且私密
│   └── <skill-name>.json     ← 由 skill 决定具体结构
├── skills/                   ← 游戏规则和机制
└── (其他 skill 文件)

data/sessions/<sessionId>/
├── chat.jsonl                ← 聊天记录（叙事层）
├── scene-state.json          ← 显示状态：SceneState（玩家可见）
└── messages.jsonl            ← agent 对话历史（恢复用）
```

| 状态层 | 存储位置 | 写入方式 | 可见性 |
|--------|----------|----------|--------|
| 内部状态 | `.game-state/*.json` | GM 用 `read`/`write`/`edit` 文件工具 | 仅 GM 可见 |
| 显示状态 | `scene-state.json` | GM 用 `update_scene` 工具 | 前端 + 玩家可见 |
| 叙事记录 | `chat.jsonl` | `message` 工具自动写入 | 前端聊天面板可见 |

### 内部状态包含什么

内部状态是游戏规则引擎的完整数据，包括玩家不应看到的信息：

- 隐藏数字、答案、谜题解法
- NPC 的真实动机、秘密信息
- 未探索区域的地图布局
- 骰子判定的内部阈值
- 背包/物品的详细属性
- 游戏进度标记、触发条件

结构由 skill 自行定义，平台不规定。例如猜数字游戏可能是：

```json
// .game-state/bluff-number-guess.json（GM 私有）
{
  "secretNumber": 42,
  "range": [1, 100],
  "roundsLeft": 5,
  "history": [{"guess": 30, "hint": "higher"}]
}
```

### 显示状态如何对齐

GM 的工作流是：**先更新内部状态，再投影到显示状态**。

```
用户行动 → GM 判定
    ├── 1. 更新 .game-state/（write 工具）
    ├── 2. 投影可见部分到 SceneState（update_scene 工具）
    └── 3. 叙述结果给玩家（message 工具）
```

投影规则由 GM 根据游戏逻辑决定：
- 地图：只投影玩家已探索/可见的区域
- 角色：只投影 `visible: true` 的角色
- 任务目标：`"hidden"` 状态的目标不显示具体文本
- 玩家属性：投影玩家已知的属性值

对应的 builder prompt 修改见下文 [Builder Prompt 更新](#builder-prompt-更新) 段落。

## 数据模型

### SceneMap

地图始终是同一个结构。有 `width`/`height` → 渲染网格；没有 → 空地图区域（texts 仍可显示）。

```ts
interface SceneMap {
  title?: string
  width?: number              // 网格列数，无网格时省略
  height?: number             // 网格行数
  cells?: SceneMapCell[]      // 由 map file 解析生成，前端不关心来源
  overlays?: SceneOverlay[]   // 稀疏：门、宝箱等可交互物，按 id 合并
  labels?: MapLabel[]         // 地图**内**文本：定位在网格坐标上，按 id 合并
}

interface SceneMapCell {
  x: number
  y: number
  terrain: string
}

interface SceneOverlay {
  id: string                  // 合并用
  x: number
  y: number
  type: string                // "door" | "chest" | "trap" | "marker" 等
  label?: string
}

interface MapLabel {
  id: string
  text: string
  x: number                   // 格子坐标
  y: number
  style?: "area" | "label" | "alert"   // 渲染风格
}
```

### SceneText — 地图**外**文本

独立于地图网格的文本块——状态提示、叙事描述、回合信息等。渲染在地图面板的周边区域。无网格时，这些文本成为中央区域的主要内容。

```ts
interface SceneText {
  id: string
  content: string
  style?: "narrative" | "status" | "alert" | "info"
}
```

### SceneCharacter

```ts
interface SceneCharacter {
  id: string
  name: string
  role: "npc" | "player" | "enemy" | "ally" | "neutral"
  sessionId?: string          // 有 session 的 NPC 可被 notify
  summary?: string
  status?: string
  location?: string           // "x,y" 格式（如 "3,5"）
  visible: boolean
}
```

一个格子可以有多个角色。`visible: false` 的角色不在前端渲染。

### 完整 SceneState

```ts
interface SceneState {
  sessionId: string
  version: number
  title?: string
  dm: SceneDM
  map: SceneMap               // 网格 + 地图内文本/叠加物
  texts?: SceneText[]         // 地图外文本块，按 id 合并
  characters: SceneCharacter[]
  mainQuest?: SceneQuest
  playerCard?: ScenePlayerCard
  updatedAt: string
}
```

### 所有数组字段的合并规则

统一模式：**按 `id` 合并**。传入已有 id → 更新字段；新 id → 追加；`{ id, _remove: true }` → 删除。

适用于：`characters`、`texts`、`map.overlays`、`map.labels`、`mainQuest.objectives`。

## 内置素材

### 地形瓦片

所有瓦片在前端程序化生成，16×16 像素，无需外部图片资源。渲染方式见前端渲染架构。

| 字符 | terrain ID | 名称 | 基色 | 描述 |
|------|------------|------|------|------|
| `.` | `void` | 虚空 | `#1a1a2e` | 地图边界/暗区（默认） |
| `g` | `grass` | 草地 | `#4a8c3f` | 散布深色草点 |
| `s` | `stone` | 石板 | `#808080` | 砖缝纹理 |
| `f` | `wood` | 木板 | `#8b6914` | 木纹条纹（floor） |
| `d` | `dirt` | 泥地 | `#7a6040` | 颗粒感变化 |
| `a` | `sand` | 沙地 | `#d4b896` | 细粒点缀 |
| `w` | `water` | 水面 | `#3070b0` | 波纹高光 |
| `W` | `wall` | 墙壁 | `#5a4a3a` | 砖块+灰缝 |
| `l` | `lava` | 岩浆 | `#c03010` | 流动纹理 |
| `i` | `ice` | 冰面 | `#a0d0e8` | 反光高光 |

前端遇到未知字符/terrain ID 时 fallback 到 `void`。

### 叠加物（Overlay）

绘制在地形瓦片之上的小图标，程序化生成。数量少，直接在 `update_scene` 调用中指定坐标。

| overlay ID | 名称 | 图标 |
|------------|------|------|
| `door` | 门 | 矩形轮廓 + 圆形把手 |
| `chest` | 宝箱 | 矩形 + 锁扣 |
| `trap` | 陷阱 | 三角警告 |
| `stairs` | 楼梯 | 箭头 |
| `marker` | 标记点 | 菱形 |

### 角色 Token

绘制在格子中央，样式规则：

| role | 颜色 | 说明 |
|------|------|------|
| `player` | `#4a90d9` 蓝 | 当前玩家 |
| `ally` | `#d4a940` 金 | 友方 NPC |
| `npc` | `#50b050` 绿 | 中立 NPC |
| `enemy` | `#c04040` 红 | 敌对角色 |
| `neutral` | `#909090` 灰 | 中立/无关角色 |

Token 内显示角色名首字母（中文取第一个字），外圈描边。

## 地图文件格式

Agent 不直接在 `update_scene` 中编写 cells 数组。地图网格通过 **文本艺术文件** 表达——每个字符对应一格地形，agent 用 `write`/`edit` 工具维护该文件，`update_scene` 读取并解析。

### 基本格式

文件存放在 workspace 的 `.game-state/` 下，如 `.game-state/tavern.map`：

```
WWWWWWWW
WffffffW
WffffffW
WffffffW
WffffffW
WWWfWWWW
```

- 每行 = 一行格子，每字符 = 一列
- 宽度 = 最长行的字符数，高度 = 行数
- 字符映射见上方素材表（`W`=wall, `f`=wood, `g`=grass, ...）
- `#` 开头的行为注释，解析时跳过

### Agent 编辑地图的方式

**创建**：用 `write` 工具一次写整个 map 文件。Agent 像画 ASCII art 一样画地图。

**小范围修改**：用 `edit` 工具替换文件中的特定行或字符。例如把酒馆入口打开：
```
edit: old="WWWfWWWW" new="WWWdWWWW"  → 把木板换成泥地
```

**算法生成/批量操作**：用 `bash` 工具调用脚本。workspace 的 skill 可以提供地图操作脚本。例如：
```bash
# 爆炸效果：以 (3,3) 为中心、半径 2 的区域变成 lava
python skills/map-utils/blast.py .game-state/tavern.map 3 3 2 l
```

**应用到场景**：修改文件后，调用 `update_scene` 并指定 `mapFile` 路径，工具读取文件并刷新前端。

### 为什么不直接在 update_scene 中传 cells

- 一个 8×6 的地图有 48 格，逐格 JSON 是 ~1.5KB 纯重复结构——浪费 token
- Agent 不擅长精确编辑大型 JSON 数组（容易坐标错位）
- 文本文件的编辑直观得多，`edit` 工具替换一行字符串就能改一整行地形
- 文件持久化在 workspace 中，刷新/重连后 `update_scene` 重读即可恢复

## 前端渲染架构

### 为什么选 SVG 而非 Canvas

- **缩放/平移**：SVG 的 `viewBox` 天然支持坐标变换，滚轮缩放和拖拽平移只需改 viewBox 参数。Canvas 需要手动管理 camera + 每帧重绘。
- **交互**：每个 SVG 元素是 DOM 节点，原生支持 click/hover/tooltip。Canvas 需要手动做 hit testing。
- **React 友好**：SVG 元素可以是 React 组件，局部更新高效。
- **文本渲染**：SVG `<text>` 原生支持，Canvas 文本测量和渲染复杂。
- **像素风格**：`shape-rendering="crispEdges"` + 纯色 `<rect>` 实现方块感。纹理图案可通过 SVG `<pattern>` 或预渲染 `<image>` 实现。

### 组件层级

```
MapPanel.tsx                          ← 地图区域总容器
├── SceneTexts.tsx                    ← 地图外文本块（texts[]）
└── TileMapSvg.tsx                    ← SVG 网格（width/height > 0 时渲染）
    ├── <defs>                        ← 瓦片 pattern 定义（每种 terrain 一个）
    ├── Terrain layer                 ← <rect> tiles，fill 引用 pattern
    ├── Overlay layer                 ← 叠加物图标
    ├── Label layer                   ← 地图内文本 (map.labels[])
    ├── Token layer                   ← 角色 token（circle + text）
    └── Interaction layer             ← 透明 rect 捕获 click/hover
```

无网格时只渲染 `SceneTexts`。有网格时两者共存。

### 缩放与平移

```ts
// TileMapSvg 内部状态
const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: width * CELL, h: height * CELL })

// 滚轮缩放：以鼠标位置为锚点
onWheel(e) → viewBox.w/h *= (1 ± 0.1)，调整 x/y 保持鼠标锚点不动

// 左键拖拽平移
onMouseDown → 记录起点
onMouseMove → viewBox.x/y -= delta（鼠标移动量 × 缩放比例）
onMouseUp → 结束拖拽
```

`<svg viewBox={...} shape-rendering="crispEdges">` 自动处理所有坐标变换。

### 渲染参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| CELL | 40 | 每格逻辑像素大小（SVG 坐标系内） |
| 初始 viewBox | 整个地图 | 首次渲染时显示全貌 |
| 缩放范围 | 0.5x ~ 3x | 相对于初始视图 |

## GM 场景控制工具

### update_scene

接收 SceneState 的部分字段，与当前状态合并。地图网格通过 `mapFile` 路径引用。

#### 参数

```ts
{
  id: "update_scene",
  parameters: {
    title?: string,
    dm?: Partial<SceneDM>,
    map?: {
      title?: string,
      mapFile?: string,           // workspace 内 map 文件路径
      overlays?: SceneOverlay[],  // 按 id 合并
      labels?: MapLabel[],        // 按 id 合并
    },
    texts?: SceneText[],          // 按 id 合并
    characters?: SceneCharacter[],// 按 id 合并
    mainQuest?: Partial<SceneQuest>,
    playerCard?: Partial<ScenePlayerCard>,
  }
}
```

#### 合并规则

| 字段 | 合并方式 |
|------|----------|
| `title`, `dm`, `playerCard` | 浅合并 |
| `map` 的网格部分 | 有 `mapFile` → 读文件解析为 cells/width/height，替换网格。无 `mapFile` → 保留现有网格 |
| `map.overlays`, `map.labels` | 按 `id` 合并 |
| `texts`, `characters` | 按 `id` 合并 |
| `mainQuest.objectives` | 按 `id` 合并 |

**删除**：传入 `{ id: "xxx", _remove: true }` 即可删除任何 id-keyed 元素。

#### 典型调用模式

**搭建初始场景**（write 地图 + update_scene 一次性设置）：
```
write(".game-state/tavern.map", "WWWWWWWW\nWffffffW\n...")
update_scene({
  title: "破晓酒馆",
  map: { mapFile: ".game-state/tavern.map", overlays: [{id:"door1",x:3,y:5,type:"door"}] },
  texts: [{id:"desc",content:"昏黄灯光洒满大厅",style:"narrative"}],
  characters: [{id:"bartender",name:"老酒保",role:"npc",location:"4,2",visible:true}]
})
```

**移动一个角色**：
```json
{ "characters": [{"id":"player","location":"4,3"}] }
```

**添加/更新一个文本块**：
```json
{ "texts": [{"id":"round","content":"第 3 回合","style":"status"}] }
```

**给地图加一个标签**：
```json
{ "map": { "labels": [{"id":"area1","text":"吧台区","x":4,"y":2,"style":"area"}] } }
```

**添加叠加物**：
```json
{ "map": { "overlays": [{"id":"chest1","x":6,"y":3,"type":"chest","label":"宝箱"}] } }
```

**删除一个角色**：
```json
{ "characters": [{"id":"old_npc","_remove":true}] }
```

**局部改地图 + 刷新**：
```
edit(".game-state/tavern.map", old="WffffffW", new="WfflfffW")
update_scene({ map: { mapFile: ".game-state/tavern.map" } })
```

### Builder Prompt 更新

在 builder.txt 末尾追加（精简版，详细参数靠 tool description 承载）：

```
## Scene & State

Maintain internal game state in `.game-state/` (file tools) — private. Use `update_scene` to control what the player sees — public. After game actions: update internal → update_scene → message.

### Maps
Write a text-art map file (`.game-state/*.map`), one char per cell:
W=wall g=grass s=stone f=wood d=dirt a=sand w=water l=lava i=ice .=void
Then call `update_scene` with `mapFile` path. Use `edit` for tweaks, `bash` for algorithmic effects.

Never leak hidden info into SceneState.
```

## 用户地图交互（本期预留，不实现）

### 目标

未来允许玩家直接在地图上操作：点击格子移动角色、点击物品交互、点击 NPC 对话等。

### 交互流程设计

```
玩家在 SVG 上点击格子 (5, 3)
     ↓ 前端识别点击目标（空格子 / 角色 / 物品）
     ↓ WebSocket 发送
{ type: "scene.interact", payload: { action: "click", x: 5, y: 3, targetId?: "chest1" } }
     ↓ 后端注入到 GM agent
primaryAgent.injectEvent("scene_interact", "<scene_interact action=click x=5 y=3 target=chest1/>")
     ↓ GM 解读意图并响应
update_scene / message / notify ...
```

### v1 需要遵守的约束

- **SVG 元素可点击**：用 SVG 渲染天然满足，每个 token/overlay 都是 DOM 节点。
- **WebSocket 协议可扩展**：预留 `scene.interact` 事件类型（v1 不需要前端发送，也不需要后端处理）。
- **`injectEvent` 已存在**：`AgentLoop.injectEvent()` 是现有接口，v2 直接复用。
- **不在前端硬编码行动类型**：前端只发送"哪里被点了"，GM 决定含义。

## NPC 场景感知（本期设计，下期实现）

### 当前（v1）：GM 中心化控制

```
Player ←→ GM (builder) ←→ SceneState (文件)
                ↕                    ↓
              notify           WebSocket → 前端
                ↓
              NPC agents (无场景感知)
```

- 只有 GM 拥有 `update_scene` 工具
- NPC 不知道自己在哪里，也不知道场景布局
- GM 通过 `notify` 的文本内容描述空间信息

### 未来（v2）：NPC 空间感知

```
Player ←→ GM (builder) ←→ SceneState (文件)
                ↕                    ↓
              notify (+场景上下文)  WebSocket → 前端
                ↓
              NPC agents
                ↓ observe_scene (只读)
                ↓ request_action (请求移动/交互)
                ↕
              GM 审批 → update_scene
```

### 扩展点设计

以下设计确保 v1 架构不堵死 v2 的路径：

#### 1. SceneManager.getViewForCharacter(characterId)

SceneManager 预留按角色 ID 生成视角过滤后的 SceneState 的能力。v1 不实现过滤逻辑，但接口签名预留：

```ts
class SceneManager {
  getState(sessionId: string): SceneState | null
  updateState(sessionId: string, patch: Partial<SceneState>): SceneState
  // v2 扩展：返回该角色视角的场景（基于位置和视野范围过滤）
  // getViewForCharacter(sessionId: string, characterId: string): SceneState
}
```

#### 2. NPC 工具注册点

当前 NPC 的 ToolRegistry 在 `app.ts` 中创建，只包含 `message` 工具。v2 时可在此处追加：

```ts
// app.ts — NPC registry 构建（现有代码 + v2 扩展注释）
const npcRegistry = new ToolRegistry()
// ...existing tools...
npcRegistry.register(createMessageTool(...))
// v2: npcRegistry.register(createObserveSceneTool(sceneManager, npcSessionId))
// v2: npcRegistry.register(createRequestActionTool(dispatcher, npcSessionId))
```

#### 3. notify 工具场景注入

`notify` 工具的 `content` 目前是纯文本。v2 可以在 NotifyFn 内部自动注入场景上下文：

```ts
// v2: notify 自动注入场景
const notifyFn = async (content: string, targets: NotifyTarget[]) => {
  for (const target of targets) {
    const npcView = sceneManager.getViewForCharacter(sessionId, target.session_id)
    const enrichedContent = npcView
      ? `<scene>\n${JSON.stringify(npcView)}\n</scene>\n\n${content}`
      : content
    await dispatcher.notify(target, enrichedContent)
  }
}
```

#### 4. NPC 行动请求机制

NPC 不直接修改 SceneState（避免多源冲突）。v2 的 `request_action` 工具将请求发送给 GM agent：

```ts
// v2: NPC 请求行动 → 注入到 GM 的消息队列
primaryAgent.injectEvent("npc_action_request", `
  <action_request npc="${npcName}" session="${sessionId}">
    ${JSON.stringify({ type: "move", target: "5,3" })}
  </action_request>
`)
```

GM 收到后决定是否执行 → 调用 `update_scene` → 场景更新广播。

#### 5. 关键设计约束（v1 必须遵守）

- **单一数据源**：角色位置只存在于 `SceneState.characters[].location`，不在 NPC session 中维护副本。
- **坐标标准化**：grid 模式统一使用 `"x,y"` 格式（整数，0-based），x 为列，y 为行。
- **GM 权威**：所有场景变更经由 GM 的 `update_scene`。前端只读。
- **SceneState 广播可扩展**：`WsManager.broadcastScene()` 的签名接受 sessionId，v2 时可改为按角色过滤后推送不同版本。

## 后端变更

### 1. SceneManager（新增）

```ts
// src/scene/manager.ts
class SceneManager {
  constructor(private dataDir: string) {}

  getState(sessionId: string): SceneState | null
  // 读取 data/sessions/<sessionId>/scene-state.json

  updateState(sessionId: string, patch: UpdateScenePatch, workspacePath: string): SceneState
  // 如有 patch.map.mapFile → 从 workspacePath 下读取文本文件 → 解析为 cells/width/height
  // 合并 → version++ → 写回 → 返回完整 state

  parseMapFile(filePath: string): { width: number; height: number; cells: SceneMapCell[] }
  // 解析文本艺术地图文件
}
```

场景文件路径：`data/sessions/<sessionId>/scene-state.json`。

### 2. update_scene 工具（新增）

```ts
// src/tool/scene.ts
function createUpdateSceneTool(
  sceneManager: SceneManager,
  sessionRef: { id: string },
  workspacePath: string,        // 用于解析 mapFile 相对路径
  onUpdate: (state: SceneState) => void,
): Tool
```

在 `app.ts` 的 `createApp()` 中注册到 builder 的 ToolRegistry。tool description 中包含地形字符图例和基本用法，替代长 prompt。

### 3. REST 端点（新增）

```ts
// src/server/routes/sessions.ts 中追加
app.get("/sessions/:id/scene", async (c) => {
  const state = sceneManager.getState(sessionId)
  return c.json({ code: 0, message: "ok", data: state ?? defaultEmptyScene(sessionId) })
})
```

### 4. WebSocket 事件（新增）

在 `WsManager` 中增加 `broadcastScene` 方法：

```ts
broadcastScene(sessionId: string, state: SceneState): void {
  this.broadcast(sessionId, JSON.stringify({ type: "scene.updated", payload: state }))
}
```

通过 `AppPool` 的 `onSceneUpdate` 回调连接到 `update_scene` 工具。

### 5. App 接口变更

`App` 和 `createApp` 需要：
- 创建 `SceneManager` 实例
- 注册 `update_scene` 工具
- 提供 `onSceneUpdate` 回调接口

## 实施步骤

### Step 1: 数据模型 + Zod Schema

- 在 `src/shared/schemas.ts` 中新增 `SceneState` 相关 Zod schema
- 确保前后端共享同一套类型定义

### Step 2: SceneManager + update_scene 工具

- 实现 `src/scene/manager.ts`（含 map file 解析器）
- 实现 `src/tool/scene.ts`
- 在 `app.ts` 中集成
- 更新 builder prompt（~15 行）

### Step 3: 后端 API

- `GET /sessions/:id/scene` 端点
- `scene.updated` WebSocket 事件广播
- `AppPool` 中连接 onSceneUpdate 回调

### Step 4: 前端地图渲染

- SVG 瓦片 pattern 定义（`useTilePatterns` hook，程序化生成 `<pattern>`）
- `TileMapSvg` 组件：SVG 渲染 terrain + overlay + label + token
- 缩放（滚轮）/ 平移（拖拽）交互
- `SceneTexts` 组件：地图外文本块
- `MapPanel` 组件：组合 SVG 地图 + 文本
- `useScene` hook：REST 加载 + WebSocket 实时更新

### Step 5: 前端其他场景组件

- `DMPanel`、`CharacterBadge`、`QuestPanel`、`PlayerCard` 组件
- `PlaySurface` 组装所有子组件
- `SessionShell` 替换 v0 聊天主视图为三栏布局

### Step 6: 集成验证

- 启动后端 + 前端 dev server
- 创建 workspace + session，通过聊天指示 GM 创建场景
- 验证：地图渲染、角色 token 显示、角色移动、任务更新
- 验证：刷新页面后场景恢复
- `bun run check` 全量验证

## 不在本期范围

- 用户地图交互（点击格子/角色触发行动）— 架构已预留，见上文
- NPC 感知工具（observe_scene、request_action）— v2
- 自定义瓦片素材/精细像素纹理 — v2
- 动画效果（角色移动过渡、水面流动）— v2
- 多层地图（地下城多层）— v2
- 战争迷雾/视野遮蔽 — v2
