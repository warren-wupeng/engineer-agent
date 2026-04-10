# engineer-agent

一个主动式的 AI Agent，能够像软件工程师一样处理任务：从邮件获取任务、自主规划、执行并报告结果。

## 长期愿景

### 核心能力
- 📧 **邮件交互**：从邮箱获取任务，通过邮件报告结果
- 📋 **任务管理**：维护待办列表，跟踪任务状态
- 🧠 **智能规划**：使用 LLM 自主分析和规划任务
- ⚙️ **任务执行**：执行代码、文件操作、Git 操作等工程任务
- 📊 **结果报告**：生成执行报告并发送给用户

### 部署演进路径
1. **Phase 1**: 本地 CLI 应用（当前阶段）
2. **Phase 2**: 功能完善与增强
3. **Phase 3**: 迁移到 Cloudflare Worker，云端定时运行

### 技术架构
- **语言**: TypeScript
- **AI**: OpenAI / Anthropic API
- **本地存储**: SQLite / JSON 文件
- **云端存储**: Cloudflare KV + D1
- **Email**: IMAP/SMTP (本地) → Email API (云端)

### Cloudflare 基础设施服务（2025）

我们计划利用 Cloudflare 最新推出的 Agent 相关基础设施服务：

#### 核心服务（高优先级）
- ⭐⭐⭐⭐⭐ **Cloudflare Sandbox SDK**：安全代码执行环境（执行器核心）⭐ **关键发现**
- ⭐⭐⭐⭐⭐ **Cloudflare Agents Framework**：Agent 运行时和状态管理
- ⭐⭐⭐⭐⭐ **AI Gateway**：LLM 调用管理、缓存、监控
- ⭐⭐⭐⭐ **Workers AI**：边缘 AI 模型，降低成本
- ⭐⭐⭐⭐ **Vectorize**：向量数据库，任务相似度搜索和 RAG
- ⭐⭐⭐⭐ **D1**：SQL 数据库，任务持久化
- ⭐⭐⭐⭐ **Email Workers**：云端邮件处理

#### 辅助服务
- ⭐⭐⭐ **Cron Triggers**：定时任务调度
- ⭐⭐⭐ **Queues**：任务队列管理
- ⭐⭐⭐ **KV**：缓存和配置存储

详细调研请参考 [docs/CLOUDFLARE_AGENT_SERVICES.md](./docs/CLOUDFLARE_AGENT_SERVICES.md)

## 当前阶段：核心 Agent 模块

专注于构建核心 Agent 模块，使用函数式编程范式，轻量级 LLM 抽象库。

### 核心模块设计
- 函数式编程范式（纯函数、不可变数据、函数组合）
- 轻量级 LLM 抽象层（OpenAI、Anthropic SDK）
- 类型安全的 Agent 状态管理
- 可组合的任务处理流程
- Result 类型错误处理（Either 模式）

### 项目结构

本项目采用 **Monorepo** 架构，包含前后端所有代码：

```
engineer-agent/
├── packages/              # 核心包
│   ├── core/             # Agent 核心模块（函数式编程）
│   ├── api/              # 后端 API（Worker/Node.js）
│   ├── web/              # 前端 Web 应用
│   ├── cli/              # CLI 工具
│   └── shared/           # 共享代码和类型
├── infrastructure/       # 基础设施层
│   ├── cloudflare/       # Cloudflare 实现
│   └── local/            # 本地实现（Docker）
├── deployments/          # 部署配置
│   ├── cloudflare/       # Cloudflare 部署
│   └── docker/           # Docker Compose
└── docs/                 # 文档
```

详细结构请参考 [docs/PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md)

### 快速开始

1. **安装依赖**
```bash
npm install
```

2. **配置环境变量**

创建 `.env.local` 文件（本地开发配置，不会被提交到 Git）：
```bash
cp .env.local.example .env.local
```

编辑 `.env.local`，填入你的配置：
```bash
# OpenAI API Key
OPENAI_API_KEY=your_api_key_here

# 本地代理配置（仅本地环境需要，如果不需要代理可以删除）
https_proxy=http://127.0.0.1:7897
http_proxy=http://127.0.0.1:7897
all_proxy=socks5://127.0.0.1:7897
```

**注意**：
- `.env.local` 文件不会被提交到 Git（已在 `.gitignore` 中）
- 代理配置仅用于本地开发环境
- 生产环境（Cloudflare）不需要代理配置

3. **运行测试**
```bash
npm test
```

4. **使用示例**
```typescript
import { Agent, createAgent } from './index.js';

const agent = createAgent({
  llm: {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: process.env.OPENAI_API_KEY!,
  },
});

let state = Agent.createInitialState();
state = agent.addTask(state, {
  title: 'Create API endpoint',
  description: '...',
  source: 'email_123',
  priority: 'medium',
});
```

## 文档

- [架构设计](./docs/ARCHITECTURE.md) - 核心架构设计
- [核心模块设计](./docs/CORE_MODULE_DESIGN.md) - Agent 核心模块详细设计
- [Cloudflare 服务调研](./docs/CLOUDFLARE_AGENT_SERVICES.md) - Cloudflare 基础设施服务
- [部署策略](./docs/DEPLOYMENT_STRATEGY.md) - Cloudflare + 本地 Docker 部署方案
- [项目结构](./docs/PROJECT_STRUCTURE.md) - 完整目录结构规划
