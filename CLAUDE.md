# DiceCraft - 基于多Agent的桌游创作与游玩平台

本项目基于 Bun + TypeScript 开发。

## 技术栈

- **运行时**: Bun
- **语言**: TypeScript
- **包管理**: Bun (bun add / bun install)

## 常用命令

```bash
bun install          # 安装依赖
bun run dev          # 运行项目
bun test             # 运行测试
```

## 项目结构

```
src/
├── model/           # AI SDK 封装
├── tool/            # 工具定义
├── agent/           # Agent 循环
└── index.ts         # 入口
```

## 环境变量

在 `.env` 文件中配置：
```bash
OPENAI_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_API_KEY=sk-xxx
```
