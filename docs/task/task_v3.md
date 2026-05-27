# DiceCraft DND 桌游方向任务拆分

## 任务背景

DiceCraft 已具备 Bun + TypeScript 的多 Agent 基础设施：Primary Agent、Subagent、Workspace、Session、Chat、Message/Notify、文件工具、Bash 工具和 Skill 自动发现。下一阶段将项目方向收敛到 DND 式桌游创作与游玩。

DND 本质上是玩家与 DM 共同创造游戏经历的过程，适合 DiceCraft 的多 Agent 架构：

- **开发阶段**：Builder Agent 根据用户输入生成主持游戏所需资料，包括世界设定、剧情线、怪物图鉴、地图、骰子规则、隐藏线索，并进行基础规则检验和数值平衡检查。
- **游玩阶段**：DM Agent 依据生成的世界设定和规则主持游戏。普通 NPC 可由 DM 即时生成回答，重要 NPC 由 Subagent 实现，保留独立记忆和立场。
- **通用能力**：游戏设定可以不断创造，但前端、角色卡、掷骰、状态管理、攻击判定、伤害计算等元素应尽量复用。

## Demo 目标

### 游戏创造阶段

1. 用户输入：“我想玩指环王式的冒险。”
2. Builder Agent 生成：
   - 世界设定
   - 玩家可选角色
   - 任务目标
   - 关键 NPC
   - 骰子规则
   - 隐藏线索
3. Builder Agent 对生成结果做基础检查：
   - 逻辑是否自洽
   - 难度是否明显失衡
   - 是否泄露隐藏信息
   - 是否缺少必要素材

### 游玩阶段

1. DM Agent 开始主持冒险。
2. 重要 NPC Subagent 拥有自己的记忆、性格、目标和阵营立场。
3. DM Agent 按需调用通用 DND 能力：
   - 掷骰判定
   - 角色卡信息管理
   - 攻击判定
   - 伤害计算
   - 状态更新

## 总体分组

后续任务减少为三个方向：

1. **服务方向**：先定义 API 契约，再做前端通用 DND 桌游 UI，最后把后端能力服务化。
2. **本体逻辑细化方向**：细化 DND 游戏创造与游玩逻辑，明确 Builder 和 DM 使用两个不同 prompt。
3. **其他方向**：制作 PPT / 展示材料，并增加 Agent 自动测试覆盖游戏流程。

## 并行开发原则

1. 每个模块应有清晰边界、输入输出和验收标准。
2. 能独立开发的模块保持独立，例如前端项目与 Agent 自动测试流程互不阻塞。
3. 对必须协作的模块，先产出契约文档，降低并行冲突。
4. 模块负责人只修改自己模块内的文件，跨模块变更先更新契约文档。
5. 每个模块完成后运行相关测试；修改源码后运行 `bun run check`。

## 方向一：服务方向

### 模块 A：API 契约设计

**目标**：定义前端、后端、Agent 流程和游戏状态共享的结构化协议，作为并行开发的前置任务。

**建议负责人**：后端架构 / 全栈接口负责人

**交付物**：

- `docs/api_doc.md`
  - Workspace API
  - Session API
  - Chat API
  - Game creation API
  - Game runtime API
  - WebSocket event 协议
  - DND 游戏数据对象说明

**依赖**：无。

**可并行性**：应优先完成；完成后可支持前端、后端、Agent 逻辑、测试模块并行。

**验收标准**：

- 文档能说明每个核心对象的字段、含义、示例和版本兼容策略。
- 前端和后端可仅依赖契约文档开始开发。
- 游戏资料、角色状态、掷骰结果、场景状态和 NPC 消息都有明确结构。

### 模块 B：前端通用 DND 桌游 UI 设计

**目标**：为 DND 和未来桌游提供可复用前端元素，而不是为单个冒险写死界面。

**建议负责人**：前端负责人

**交付物**：

- WebUI 项目：`packages/dice-craft-webui/`。
- 通用界面组件：
  - Workspace / Session sidebar
  - 聊天流
  - DM 旁白
  - NPC 消息
  - 角色卡面板
  - 背包与状态面板
  - 掷骰结果面板
  - 战斗回合条
  - 地图 / 场景画布占位
- 按 `docs/api_doc.md` 对接后端 REST / WebSocket。

**依赖**：模块 A；可用 mock 数据先行。

**可并行性**：API 契约完成后可独立开发。

**验收标准**：

- 不依赖具体冒险硬编码。
- 能展示聊天、角色卡、掷骰结果和基础状态。
- 可用 mock server 或静态 fixture 完成前端测试。

### 模块 C：后端接口服务化

**目标**：将现有 CLI 能力包装为 WebUI 可调用的后端服务。

**建议负责人**：后端服务负责人

**交付物**：

- Hono 或 Bun.serve 入口。
- REST API：
  - workspaces
  - sessions
  - messages
  - game creation
  - game runtime
  - model config
- WebSocket 事件：
  - message
  - agent_thinking
  - tool_call
  - dice_result
  - state_update
  - scene_update
- CLI 与 server 模式共存，例如：
  - `bun run dev`
  - `bun run serve`

**依赖**：模块 A；与模块 B 联调。

**可并行性**：可在 API 契约完成后与前端并行开发，双方通过 mock / fixture 联调。

**验收标准**：

- WebUI 可创建 session、发送消息、接收 Agent 消息。
- 服务端复用现有 SessionManager、WorkspaceManager、ChatManager。
- 不破坏 CLI 行为。

## 方向二：本体逻辑细化方向

### 模块 D：创造游戏

**目标**：让 Builder Agent 从用户自然语言生成一套可主持的 DND 冒险资料，并在生成后做基础规则与平衡检查。

**建议负责人**：Agent 构建流程负责人

**交付物**：

- 更新 `src/agent/prompt/builder.txt`，使 Builder Agent 专注于“创造游戏”。
- 设计并使用游戏资料模板：
  - WorldSetting，用于决定 DM 叙事风格
    - 对应模板 `templates/game/world.md`
  - AdventureOutline，用于 DM 决定游戏走向
    - Quest
    - Map
    - ImportantNPCs
    - 对应模板 `templates/game/adventure.json`
  - CharacterInfo，用于创建角色，动态记录角色状态
    - 现有能力和物品
    - 可放入 `templates/game/adventure.json` 或后续拆分为独立角色模板
  - Monster，用于 DM 在冒险中安排遇到的敌人
    - 对应模板 `templates/game/monsters.json`
  - Rules，战斗系统与互动系统
    - CombatAction
    - StatusEffect
    - 对应模板 `templates/game/rules.md`
  - Item，有哪些物品可以互动、获得、使用
    - 对应模板 `templates/game/items.md`
- 生成的游戏资料放入当前 workspace 下的游戏目录，例如 `game/king_of_ring_adventure/`。
- 将原模块 C 的 Review 能力简化并并入本模块：
  - 检查逻辑冲突
  - 检查明显难度失衡
  - 检查隐藏信息泄露
  - 检查缺失素材
  - 输出可执行修改建议

**依赖**：模块 A 的数据结构约定。

**可并行性**：可与模块 E、G 并行，但字段命名应遵循 API 契约。

**验收标准**：

- 输入“我想玩指环王式的冒险”后，能生成完整可游玩的冒险资料。
- 生成内容区分玩家可见信息和 DM 私有信息。
- 生成内容可被 DM Agent 读取并用于主持游戏。
- Builder Agent 能对生成内容给出基础检验结果和修改建议。

### 模块 E：游戏游玩

**目标**：让 DM Agent 在游玩阶段主持 DND 冒险，并合并重要 NPC Subagent 的创建、记忆和信息隔离机制。

**建议负责人**：运行时 Agent / Subagent 负责人

**Prompt 边界**：

- Builder 使用 `src/agent/prompt/builder.txt`，负责创造游戏、生成资料、做基础检验。
- DM 使用独立 prompt，例如 `src/agent/prompt/dm.txt`，负责读取游戏资料、主持游玩、更新状态、控制 NPC 信息流。
- “创建模式”和“游玩模式”通过显式模式切换区分，不依赖同一个 prompt 临时扮演两种角色。

**交付物**：

- 新增 DM prompt。
- 明确“创建模式”和“游玩模式”的切换方式。
- DM 在游玩阶段通过读取 `game/` 中的游戏设定相关内容与玩家互动：
  - 读取游戏资料
  - 描述场景
  - 接收玩家行动
  - 决定是否需要掷骰
  - 调用角色卡、掷骰、战斗、状态能力
  - 更新游戏状态
  - 控制普通 NPC 和重要 NPC 的信息流
- 重要 NPC Subagent 机制：
  - 名称
  - 公开身份
  - 私有目标
  - 已知信息
  - 关系网络
  - 记忆保存方式
  - 初始化流程
  - DM 通过 `notify` 给 NPC 发送不同粒度的信息
  - NPC 发言通过 `message` 写入主 chat

**依赖**：模块 A；读取模块 D 的生成产物；基于现有 `session`、`chat`、`tool`、Subagent、Message、Notify 功能。

**可并行性**：可先用 mock 游戏资料和 mock 掷骰能力开发 DM 流程，等待模块 D 产物稳定后联调。

**验收标准**：

- DM 能主持至少一个完整场景：介绍场景、处理行动、进行判定、更新状态、推进剧情。
- DM 不直接泄露隐藏线索。
- DM 能区分普通 NPC 即时回答和重要 NPC Subagent。
- 重要 NPC 能保持跨轮次记忆和稳定立场。
- 未被通知的信息不会进入 NPC 上下文。
- DM 可控制 NPC 是否回复。

## 方向三：其他方向

### 模块 F：PPT 制作和展示

**目标**：把 DND 方向、架构、Demo 流程和分工整理为展示材料。

**建议负责人**：文档 / 展示负责人

**交付物**：

- 更新 `README.md`。
- 更新进度报告。
- 准备 Demo 脚本：
  - 创建“指环王式冒险”
  - 基础检查与修正
  - 玩家进入场景
  - 与重要 NPC 对话
  - 掷骰判定
  - 战斗或线索发现
- `docs/PPT/ppt_version_0.md` 等展示材料：
  - 项目背景
  - 目标
  - 技术路线
  - 分工
  - 阶段成果

**依赖**：其他模块的阶段性结果。

**可并行性**：可持续跟进，不阻塞开发。

**验收标准**：

- 展示材料能在 5 分钟内说明项目价值和技术亮点。
- Demo 路径可重复执行。

### 模块 G：游戏流程测试

**目标**：增加 Agent 自动测试，自动验证 DND 冒险创建和游玩流程，减少 prompt 和工具改动带来的回归。

**建议负责人**：测试 / 质量负责人

**交付物**：

- 测试 fixture：
  - 指环王式冒险创建输入
  - 简单战斗场景
  - 重要 NPC 对话场景
  - 隐藏线索场景
- 自动化断言：
  - 是否生成必需文件
  - schema 是否有效
  - Builder 基础检查是否能发现人为注入的问题
  - DM 是否调用正确能力
  - NPC 是否保持信息隔离
- mock model server，保证测试稳定。

**依赖**：模块 A；可逐步接入模块 D、E。

**可并行性**：可先写 mock 和 fixture，等待功能模块接入。

**验收标准**：

- 新增或修改 Agent prompt、运行流程后可通过自动测试发现明显回归。
- 测试可在 `bun test` 或 `bun run check` 中运行。

## 推荐开发顺序

| 顺序 | 模块 | 原因 |
|------|------|------|
| 1 | 模块 A：API 契约设计 | 解耦前端、后端、Agent 和测试 |
| 2 | 模块 D：创造游戏 | 产出 Demo 的核心游戏资料 |
| 3 | 模块 E：游戏游玩 | 串起游戏资料、DM、NPC 和状态更新 |
| 4 | 模块 B：前端通用 DND 桌游 UI 设计 | 提升演示效果和可用性 |
| 5 | 模块 C：后端接口服务化 | 支撑 WebUI 与真实联调 |
| 6 | 模块 G：游戏流程测试 | 稳定迭代 |
| 7 | 模块 F：PPT 制作和展示 | 汇总成果 |

## 并行分工建议

| 小组 | 负责模块 | 主要边界 |
|------|----------|----------|
| 服务契约组 | A、C | schema、API、服务入口 |
| 前端组 | B | 通用 DND 桌游 UI |
| Agent 本体组 | D、E | 游戏创造、DM 主持、NPC Subagent、信息隔离 |
| 测试与展示组 | F、G | PPT、Demo、自动测试 |

## 当前阶段验收目标

1. 用户可输入 DND 冒险主题，系统生成完整冒险资料。
2. Builder Agent 能对生成资料做基础规则和平衡检查，并给出可执行修改建议。
3. DM Agent 能通过独立 prompt 主持一个最小可玩场景。
4. 至少一个重要 NPC 由 Subagent 实现，且具备独立记忆和信息隔离。
5. API 契约能支撑前端、后端服务化和游戏流程测试并行开发。
6. README、PPT 与任务文档反映当前项目实际结构和下一阶段方向。
