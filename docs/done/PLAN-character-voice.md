# PLAN: 角色语音生成

## 设计目标

NPC 消息可以附带一段精炼语音。不是把全文念一遍，而是 GM 决定哪些时刻值得配音，写一段精炼的台词交给 TTS。

这是大作业 demo，token 浪费无所谓，让 agent 自己判断即可。

---

## 核心设计

- **GM 决定一切**：什么时候配音、用什么音色、说什么台词，全由 GM agent 自行判断
- **两个 tool**：`voice_design`（创建/保存音色）和 `voice_speak`（生成语音片段）
- **语音是独立消息**：voice_speak 产生一条独立的 ChatMessage（带 voice 字段），sender 是角色本人
  - 用户看到的就是"角色发了一条语音"，不知道是 GM 触发的
  - 构建阶段也能用——Builder 让角色"说两句"预览音色效果
- **音色样本存 workspace**：voice_design 产物，游戏资产的一部分
- **语音片段存 session**：voice_speak 产物，随 session 持久化，刷新不丢
- **构建阶段定好声音**：GM 创建重要 NPC 时就 voice_design，不等到游戏开始

---

## Tool 定义

Tool 描述保持简洁，详细的音色编写指导和台词写法放在 skill 文件中（`skills/voice/`）。

### `voice_design` — 设计角色音色

```ts
{
  id: "voice_design",
  description:
    "设计并生成角色音色样本。用文字描述声音特征，系统生成对应音频。\n" +
    "如果指定 save_as，保存到 .voice/<save_as>.wav 供 voice_speak 复用。\n" +
    "音色描述写法详见 skill('voice')。",
  parameters: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description: "音色描述（1-2 句，描写声音本身的特征）"
      },
      sample_text: {
        type: "string",
        description: "样本台词（2-5 句，展示角色说话风格）"
      },
      save_as: {
        type: "string",
        description: "保存文件名（不含扩展名），省略则不保存"
      }
    },
    required: ["description", "sample_text"]
  }
}
```

**执行：**
1. 调用 `mimo-v2.5-tts-voicedesign`（context=description, text=sample_text）
2. 如果有 `save_as` → 保存到 `<workspace>/.voice/<save_as>.wav`
3. 返回结果

### `voice_speak` — 为角色生成语音

```ts
{
  id: "voice_speak",
  description:
    "为角色生成语音片段，附着在其最近一条消息上。\n" +
    "text 是「高光台词」——从角色消息中提取最适合说出来的 1-2 句（≤30字），不是照搬原文。\n" +
    "可在 text 中使用整体风格前缀如 (慵懒)、(温柔) 等。\n" +
    "提供 voice_file（克隆已有音色）或 voice_description（临时描述）之一作为音色来源。",
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "高光台词（≤30字，可含整体风格前缀）"
      },
      voice_file: {
        type: "string",
        description: "音色样本路径（如 '.voice/old_chen.wav'），音色克隆模式"
      },
      voice_description: {
        type: "string",
        description: "临时音色描述，音色设计模式（无需预存文件）"
      },
      character_name: {
        type: "string",
        description: "角色名（关联最近一条消息）"
      }
    },
    required: ["text", "character_name"]
  }
}
```

**执行逻辑：**
1. 如果有 `voice_file` → 读取文件，调用 `mimo-v2.5-tts-voiceclone`（voice=文件内容, text）
   - clone 模式不传复杂 context，标签保持简单
2. 否则如果有 `voice_description` → 调用 `mimo-v2.5-tts-voicedesign`（context=description, text）
3. 否则 → 报错
4. 保存音频到 `data/sessions/<sessionId>/voice/<msgId>.wav`
5. 发送一条独立的 ChatMessage：
   ```ts
   {
     senderName: character_name,
     senderRole: "npc",  // 或 "agent"（GM 自己说话时）
     content: text,       // 高光台词文本（同时显示为文字）
     voice: { asset: "voice/<msgId>.wav", duration: 2.3 }
   }
   ```
6. 通过 WebSocket 广播该消息（前端收到后渲染为语音消息气泡）

**关于标签控制：**
- voice_design 模式：标签能力较好，整体风格前缀和句中标签都可以用
- voice_clone 模式：模型训练时未赋予复杂标签能力，标签写多了容易出错
  - 推荐：只用整体风格前缀 `(慵懒)text...`，最多一两个简单标签
  - 不要堆叠标签，保持台词自然简洁

---

## GM Prompt 与 Skill

### Builder/GM system prompt 中的简要指引

```markdown
## 语音（当 TTS 可用时）

你有 voice_design 和 voice_speak 两个工具。使用 skill('voice') 获取音色编写和台词写法的详细参考。

基本原则：
- 重要 NPC 先 voice_design 保存音色，后续用 voice_speak + voice_file
- 不需要每条消息配音，选择有表现力的关键时刻（出场、转折、名台词）
- voice_speak 的 text 是「高光台词」——从消息中提取最适合说出来的 1-2 句，不照搬原文
```

### Skill 文件（`templates/skills/voice/`）

从 mimo-skills 中提取本项目需要的参考内容，新建 skill 文件：

```
templates/skills/voice/
├── voice.md            # 主 skill 文件：音色描述编写 + 高光台词写法 + 标签参考
└── (无脚本，纯指导文档)
```

**voice.md 内容要点**（从 mimo-skills SKILL.md 提炼，去掉飞书/导演模式/唱歌等无关内容）：

1. **音色描述编写规则**
   - 必写项：年龄+性别、声音质感、语速节奏、情绪底色
   - 可选项：风格锚点、辨识度小癖好
   - 硬约束：一到两句白描，不写场景动作
   - 示例若干

2. **高光台词概念**
   - 不是原文朗读，是提取最有角色感的 1-2 句
   - ≤30 中文字 / ≤60 英文字符
   - 保留角色语气和口头禅，可略微口语化

3. **标签参考**
   - 整体风格前缀表（情绪/语调/音色定位）
   - 句中标签表（节奏/情绪类）
   - 使用注意：design 模式可多用，clone 模式只用简单的

4. **预置音色表**（备用）
   - 冰糖/茉莉/苏打/白桦 + 适合角色类型

---

## 后端实现

### 新增文件

```
src/voice/
├── types.ts         # 类型
├── synthesizer.ts   # MiMo TTS API 封装（design + clone）
└── tools.ts         # voice_design + voice_speak tool 定义
```

### Synthesizer

```ts
// 封装两种 TTS 调用，都走 OpenAI-compatible API
class VoiceSynthesizer {
  constructor(private apiKey: string, private baseUrl = "https://api.xiaomimimo.com/v1") {}

  async design(description: string, text: string): Promise<Buffer> {
    // model: mimo-v2.5-tts-voicedesign
    // messages: [{ role: "user", content: description }, { role: "assistant", content: text }]
    // audio: { format: "wav" }
  }

  async clone(voiceFileBuffer: Buffer, text: string, context?: string): Promise<Buffer> {
    // model: mimo-v2.5-tts-voiceclone
    // messages: [...(context ? [{ role: "user", content: context }] : []), { role: "assistant", content: text }]
    // audio: { format: "wav", voice: dataUrl(voiceFileBuffer) }
  }
}
```

### 与现有系统的集成点

- **Tool 注册**：在 `src/tool/builtin.ts` 中注册 voice tools（仅 primary agent 可用）
- **ChatManager**：voice_speak 通过 `chatManager.sendMessage()` 发送语音消息
  - 语音消息是普通 ChatMessage + voice 字段，走现有的消息广播流程
  - 无需新增 WebSocket 事件类型——前端收到 message 时检查是否有 voice 字段即可
- **WorkspaceConfig**：新增可选 `tts: { apiBaseUrl, apiKey }` 字段
- **音频存储**：
  - voice_design 样本 → `<workspace>/.voice/<name>.wav`（游戏资产，持久化）
  - voice_speak 片段 → `data/sessions/<sessionId>/voice/<msgId>.wav`（session 级持久化）
- **HTTP 路由**：新增 `GET /api/sessions/:sid/voice/:filename` 提供音频访问
- **ChatMessage schema**：扩展可选 `voice: { asset, duration }` 字段

### 配置

```ts
// shared/schemas.ts 中 WorkspaceConfig 扩展
tts: z.object({
  apiBaseUrl: z.url().default("https://api.xiaomimimo.com/v1"),
  apiKey: z.string().min(1),
}).optional()
```

---

## 语音消息渲染

### ChatMessage schema 扩展

```ts
export interface ChatMessage {
  id: string
  sessionId: string
  senderId: string
  senderName: string
  senderRole: SenderRole
  content: string
  timestamp: string
  voice?: {                    // 新增可选字段
    asset: string             // 相对路径: "voice/<id>.wav"
    duration: number          // 秒
  }
}
```

带 `voice` 字段的消息就是语音消息。它也有 `content`（高光台词文本），可以同时显示文字和播放按钮。

### 前端 MessageBubble

语音消息渲染为角色的消息气泡，底部带播放条：

```tsx
// MessageBubble 中
{message.voice && (
  <VoicePlayer
    url={`/api/sessions/${sessionId}/voice/${message.id}.wav`}
    duration={message.voice.duration}
    autoPlay={isNew}  // 新到达的语音自动播放
  />
)}
```

角色头像、名字等和普通 NPC 消息一样渲染——用户看到的就是"角色发了一条带语音的消息"。

### VoicePlayer 组件

```tsx
function VoicePlayer({ url, duration, autoPlay }: Props) {
  // <audio src={url}>
  // play/pause 按钮 + 进度条
  // autoPlay 时挂载后自动播放
}
```

### 自动播放

- 新语音消息到达时默认自动播放
- 多条排队：前一条播完再播下一条
- 用户点暂停则停止队列
- 可选全局开关关闭自动播放

### HTTP 路由

```
GET /api/sessions/:sid/voice/:filename
```

从 `data/sessions/<sid>/voice/` 目录提供静态文件。

---

## 实施顺序

1. `VoiceSynthesizer`（TTS API 调用封装）
2. `voice_design` tool + `voice_speak` tool
3. WorkspaceConfig 扩展 + Settings UI
4. ChatMessage schema 扩展 `voice` 字段
5. 语音文件存储 + HTTP 静态路由
6. 前端 VoicePlayer 组件 + 自动播放队列
7. Skill 文件（`templates/skills/voice/voice.md`）
8. Builder prompt 更新
9. 端到端测试

---

## 注意事项

- 这是 demo，不追求完美——能跑起来、体验到语音增强即可
- Token 浪费可以接受，不需要做提取优化
- 让 agent 自己判断何时配音，不做硬编码规则
- TTS API 有随机性，同样参数可能效果不同，可以接受
- voice_file base64 编码 ≤ 10MB（API 限制）
- 语音片段存 session 目录，刷新页面后仍可播放
- 默认自动播放新到达的语音，用户可关闭
