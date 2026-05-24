# DiceCraft

人工智能应用开发大作业 — 基于多Agent的桌游创作与游玩平台。

## 技术栈

- **运行时**: Bun
- **语言**: TypeScript
- **AI SDK**: OpenAI SDK (兼容 MiMo API)

## 快速开始

```bash
# 安装依赖
bun install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入 MIMO_API_KEY

# 运行 CLI
bun run dev
```

输入对话即可与 Dice Agent 交互，输入 `/quit` 退出。

## 开发

```bash
bun test             # 运行测试
bun run typecheck    # 类型检查
bun run check        # 测试 + 类型检查（改完代码必跑）
```
