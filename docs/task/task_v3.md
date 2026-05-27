# DiceCraft DND 桌游方向任务拆分

## 任务背景

DiceCraft 已具备 Bun + TypeScript 的多 Agent 基础设施：Primary Agent、Subagent、Workspace、Session、Chat、Message/Notify、文件工具、Bash 工具和 Skill 自动发现。下一阶段将项目方向收敛到 DND 式桌游创作与游玩。

DND 本质上是玩家与 DM 共同创造游戏经历的过程，适合 DiceCraft 的多 Agent 架构：

- **开发阶段**：多个 Agent 协作生成主持游戏所需资料，包括世界设定、剧情线、怪物图鉴、地图、骰子规则、隐藏线索，并由 Review Agent 做规则检验和数值平衡审查。
- **游玩阶段**：Primary Agent 扮演 DM，依据生成的世界设定和规则主持游戏。普通 NPC 可由 DM 即时生成回答，重要 NPC（如长期同行伙伴、关键反派、阵营代表）由 Subagent 实现，保留独立记忆和立场。
- **通用能力**：游戏设定可以不断创造，但前端、角色卡、掷骰、状态管理、攻击判定、伤害计算等元素应尽量复用。

## Demo 目标

### 游戏创造阶段

1. 用户输入：“我想玩指环王里面的冒险。”
2. Build Agent 生成：
   - 世界设定
   - 玩家可选角色
   - 任务目标
   - 关键 NPC
   - 骰子规则
   - 隐藏线索
3. Review Agent 检查逻辑、难度、信息泄露风险和数值平衡。

### 游玩阶段

1. DM Agent 开始主持冒险。
2. 重要 NPC Subagent 拥有自己的记忆、性格、目标和阵营立场。
3. DM Agent 按需调用 Skill：
   - 游戏设定 Skill：由游戏创造阶段产出，不同冒险各不相同。
   - 通用 DND Skill：掷骰判定、角色卡信息管理、攻击判定、伤害计算等。

## 并行开发原则

1. 每个模块应有清晰边界、输入输出和验收标准。
2. 能独立开发的模块保持独立，例如前端项目与 Agent 自动测试流程互不阻塞。
3. 对必须协作的模块，先产出契约文档，降低并行冲突。例如前后端并行时先完成 `docs/api_doc.md`，规则数据与 Skill 并行时先完成 `docs/dnd_schema.md`。
4. 模块负责人只修改自己模块内的文件，跨模块变更先更新契约文档。
5. 每个模块完成后运行相关测试；修改源码后运行 `bun run check`。

## 模块 A：API 契约

**目标**：定义后续模块共享的结构化协议，作为多人并行开发的前置任务。

**建议负责人**：后端架构 / 全栈接口负责人

**交付物**：

- `docs/api_doc.md`
  - Workspace API
  - Session API
  - Chat API
  - Game creation API
  - Game runtime API
  - WebSocket event 协议

**依赖**：无。

**可并行性**：应优先完成；完成后可支持前端、后端、Skill、测试模块并行。

**验收标准**：

- 文档能说明每个核心对象的字段、含义、示例和版本兼容策略。
- 前端和后端可仅依赖契约文档开始开发。

## 模块 B：DND 游戏创造流程

**目标**：让 Build Agent 从用户自然语言生成一套可主持的 DND 冒险资料。

**建议负责人**：Agent 构建流程负责人

**交付物**：

- 更新 `src/agent/prompt/builder.txt`，从以下几个方面完善游戏创造（先完成对应的模板设计）
    - WorldSetting，用于决定 DM 叙事风格
        - 对应模板 `templates/game/world.md`
    - AdventureOutline，用于 DM 决定游戏走向 
        - Quest 
        - Map 
        - ImportantNPCs
        - 对应模板 `templates/game/adventure.json`
    - CharacterInfo，用于创建角色，动态记录角色状态
        - 现有能力和物品 
        - 对应模板  `templates/game/adventure.json`
    - Monster，用于 DM 在冒险中安排遇到的敌人
        - 对应模板 `templates/game/monsters.json`
    - Rules，战斗系统与互动系统
        - CombatAction
        - StatusEffect
        - 对应模板 `templates/game/rules.md`
    - Item，有哪些物品可以互动，获得，使用
        - 对应模板 `templates/game/items.md`
- 效果：Build Agent 创建冒险时根据上述必要内容，根据对应模板应产出相应文件，放在比如 `game/king_of_ring_adventure` 里面
    - `game/` 文件夹放已经生成的游戏

**依赖**：无

**可并行性**：可与模块 C、D、E 并行，但字段命名应遵循模块 A。

**验收标准**：

- 输入“我想玩指环王里面的冒险”后，能生成完整可游玩的冒险资料。
- 生成内容区分玩家可见信息和 DM 私有信息。
- 生成内容可被 Review Agent 和 DM Agent 读取。

## 模块 C：规则检验与平衡性 Review

**目标**：让 Review Agent 在干净上下文中审查 DND 冒险资料，发现逻辑、难度、规则和信息隔离问题。

**建议负责人**：Agent Review / 质量负责人

**交付物**：

- 更新 `src/agent/prompt/review.txt`。
- 增加 Review 输出格式：
  - blocking issues
  - balance risks
  - hidden information leaks
  - missing assets
  - suggested fixes

**依赖**：模块 A；可读取模块 B 的生成产物。

**可并行性**：可与模块 B 并行开发 prompt 和报告格式，后期联调。

**验收标准**：

- 能识别过强怪物、无解任务、隐藏线索泄露、关键 NPC 动机冲突。
- Review 结果可被 Build Agent 用于修改冒险资料。

## 模块 D：DM 主持游玩流程

**目标**：让 Primary Agent 在游玩阶段作为 DM 主持 DND 冒险。

**建议负责人**：运行时 Agent 负责人

**交付物**：

- 修改 `agent` 模块中 primary agent 的行为
- 明确“创建模式”和“游玩模式”的切换方式。
- 更新 builder/DM prompt，使其在游玩阶段：通过读取 `game/` 中的游戏设定相关内容，与玩家互动
  - 读取游戏资料
  - 描述场景
  - 接收玩家行动
  - 决定是否需要掷骰
  - 调用角色卡、掷骰、战斗、状态 Skill
  - 更新游戏状态
  - 控制普通 NPC 和重要 NPC 的信息流

**依赖**：模块 A；与模块 E、F 有集成关系。基于现有的 `session`, `chat` 和 `tool` 功能模块

**可并行性**：可先用 mock Skill 开发 DM 流程，等待模块 F 接入真实 Skill。

**验收标准**：

- DM 能主持至少一个完整场景：介绍场景、处理行动、进行判定、更新状态、推进剧情。
- DM 不直接泄露隐藏线索。
- DM 能区分普通 NPC 即时回答和重要 NPC Subagent。

## 模块 E：重要 NPC Subagent 机制

**目标**：为重要 NPC 提供独立 session、记忆、立场和可控信息流。

**建议负责人**：Subagent / 信息隔离负责人

**交付物**：

- 重要 NPC 创建规范：
  - 名称
  - 公开身份
  - 私有目标
  - 已知信息
  - 关系网络
  - 记忆文件
- NPC Subagent 初始化流程。
- DM 通过 `notify` 给 NPC 发送不同粒度的信息。
- NPC 发言通过 `message` 写入主 chat。

**依赖**：已有 Subagent、Chat、Message、Notify 基础设施；

**可并行性**：可独立于前端和 DND Skill 开发。

**验收标准**：

- 重要 NPC 能保持跨轮次记忆和稳定立场。
- 未被通知的信息不会进入 NPC 上下文。
- DM 可控制 NPC 是否回复。

## 模块 G：前端通用桌游 UI

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

**依赖**：模块 A 的 `docs/api_doc.md`；可用 mock 数据先行。

**可并行性**：前端可在 API 契约完成后独立开发。

**验收标准**：

- 不依赖具体冒险硬编码。
- 能展示聊天、角色卡、掷骰结果和基础状态。
- 可用 mock server 或静态 fixture 完成前端测试。

## 模块 H：HTTP / WebSocket 服务化

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

**依赖**：模块 A 的 `docs/api_doc.md`。

**可并行性**：可与模块 G 并行，双方通过 API 文档联调。

**验收标准**：

- WebUI 可创建 session、发送消息、接收 Agent 消息。
- 服务端复用现有 SessionManager、WorkspaceManager、ChatManager。
- 不破坏 CLI 行为。

## 模块 I：Agent 自动测试游戏流程

**目标**：自动验证 DND 冒险创建和游玩流程，减少 prompt 和工具改动带来的回归。

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
  - Review 是否能发现人为注入的问题
  - DM 是否调用正确 Skill
  - NPC 是否保持信息隔离
- 可选：mock model server，保证测试稳定。

**依赖**：模块 A；可逐步接入 B、C、D、E、F。

**可并行性**：可先写 mock 和 fixture，等待功能模块接入。

**验收标准**：

- 新增或修改 Agent prompt、Skill、运行流程后可通过自动测试发现明显回归。
- 测试可在 `bun test` 或 `bun run check` 中运行。

## 模块 J：文档与演示材料

**目标**：把 DND 方向、架构、Demo 流程和分工整理为展示材料。

**建议负责人**：文档 / 展示负责人

**交付物**：

- 更新 `README.md`。
- 更新进度报告。
- 准备 Demo 脚本：
  - 创建“指环王式冒险”
  - Review 修正
  - 玩家进入场景
  - 与重要 NPC 对话
  - 掷骰判定
  - 战斗或线索发现
- `docs/PPT/ppt_version_0.md` 等等
    - PPT 要点：项目背景、目标、技术路线、分工、阶段成果。

**依赖**：其他模块的阶段性结果。

**可并行性**：可持续跟进，不阻塞开发。

**验收标准**：

- 展示材料能在 5 分钟内说明项目价值和技术亮点。
- Demo 路径可重复执行。

## 推荐开发顺序

| 顺序 | 模块 | 原因 |
|------|------|------|
| 1 | 模块 A：DND 数据契约与 API 契约 | 解耦多人并行开发 |
| 2 | 模块 B：DND 游戏创造流程 | 产出 Demo 的核心游戏资料 |
| 3 | 模块 C：规则检验与平衡性 Review | 保证生成内容可玩 |
| 4 | 模块 F：DND 通用 Skill | 为游玩阶段提供可靠机制 |
| 5 | 模块 D：DM 主持游玩流程 | 串起游戏资料和 Skill |
| 6 | 模块 E：重要 NPC Subagent 机制 | 展示多 Agent 信息隔离优势 |
| 7 | 模块 H：HTTP / WebSocket 服务化 | 支撑 WebUI |
| 8 | 模块 G：前端通用桌游 UI | 提升演示效果和可用性 |
| 9 | 模块 I：Agent 自动测试游戏流程 | 稳定迭代 |
| 10 | 模块 J：文档与演示材料 | 汇总成果 |

## 并行分工建议

| 小组 | 负责模块 | 主要边界 |
|------|----------|----------|
| 架构与契约组 | A、H | schema、API、服务入口 |
| Agent 构建组 | B、C | 游戏创造和 Review |
| 运行时组 | D、E | DM 主持、NPC Subagent、信息隔离 |
| Skill 组 | F | DND 通用规则机制 |
| 前端组 | G | 通用桌游 UI |
| 测试与展示组 | I、J | 自动测试、Demo、报告 |

## 当前阶段验收目标

1. 用户可输入 DND 冒险主题，系统生成完整冒险资料。
2. Review Agent 能审查生成资料并给出可执行修改建议。
3. DM Agent 能主持一个最小可玩场景。
4. 至少一个重要 NPC 由 Subagent 实现，且具备独立记忆和信息隔离。
5. 至少三个 DND 通用 Skill 可用：掷骰、角色卡、攻击/伤害。
6. README 与任务文档反映当前项目实际结构和下一阶段方向。
