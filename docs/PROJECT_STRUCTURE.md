# 项目目录结构规划

## 整体结构

```
engineer-agent/
├── packages/                    # 多包架构（Monorepo）
│   ├── core/                   # 核心 Agent 模块
│   ├── api/                     # 后端 API（Worker/Node.js）
│   ├── web/                     # 前端 Web 应用
│   ├── cli/                     # CLI 工具
│   └── shared/                  # 共享代码和类型
├── infrastructure/              # 基础设施代码
│   ├── cloudflare/              # Cloudflare 实现
│   ├── local/                   # 本地实现
│   └── adapters/                # 适配器层
├── deployments/                 # 部署配置
│   ├── cloudflare/              # Cloudflare 部署配置
│   └── docker/                  # Docker Compose 配置
├── docs/                        # 文档
├── scripts/                     # 工具脚本
├── tests/                       # 集成测试
├── .github/                     # GitHub Actions
├── package.json                 # 根 package.json（workspace）
├── pnpm-workspace.yaml          # pnpm workspace 配置
├── turbo.json                   # Turborepo 配置（可选）
└── README.md
```

## 详细目录说明

### packages/core/ - 核心 Agent 模块

```
packages/core/
├── src/
│   ├── agent.ts                 # Agent 核心类
│   ├── types.ts                 # 核心类型定义
│   ├── llm/                     # LLM 抽象层
│   │   └── llm-client.ts
│   └── planner/                 # 规划器
│       └── planner.ts
├── package.json
├── tsconfig.json
└── README.md
```

**职责**：
- Agent 核心逻辑（函数式编程）
- 任务管理、规划
- LLM 抽象接口
- 纯业务逻辑，无基础设施依赖

---

### packages/shared/ - 共享代码

```
packages/shared/
├── src/
│   ├── types/                   # 共享类型定义
│   │   ├── task.ts
│   │   ├── agent.ts
│   │   └── api.ts
│   ├── utils/                   # 工具函数
│   │   ├── validation.ts
│   │   └── formatting.ts
│   └── constants/               # 常量
│       └── index.ts
├── package.json
└── tsconfig.json
```

**职责**：
- 前后端共享的类型定义
- 共享工具函数
- 常量定义

---

### packages/api/ - 后端 API

```
packages/api/
├── src/
│   ├── worker.ts                # Cloudflare Worker 入口
│   ├── server.ts                 # Node.js 服务器（本地开发）
│   ├── routes/                   # API 路由
│   │   ├── tasks.ts
│   │   ├── agent.ts
│   │   └── health.ts
│   ├── handlers/                 # 请求处理器
│   │   ├── task-handler.ts
│   │   └── agent-handler.ts
│   ├── middleware/               # 中间件
│   │   ├── auth.ts
│   │   └── error-handler.ts
│   └── config/                  # 配置
│       └── index.ts
├── wrangler.toml                 # Cloudflare Worker 配置
├── package.json
└── tsconfig.json
```

**职责**：
- REST API 服务
- Cloudflare Worker 和 Node.js 双模式
- 路由、中间件、错误处理

---

### packages/web/ - 前端应用

```
packages/web/
├── src/
│   ├── main.tsx                  # 应用入口
│   ├── App.tsx                   # 根组件
│   ├── routes/                   # 路由配置
│   │   ├── index.tsx
│   │   └── routes.tsx
│   ├── pages/                    # 页面组件
│   │   ├── Home.tsx
│   │   ├── Tasks.tsx
│   │   ├── Agent.tsx
│   │   └── Settings.tsx
│   ├── components/               # React 组件
│   │   ├── ui/                  # 基础 UI 组件
│   │   ├── task/                # 任务相关组件
│   │   ├── agent/               # Agent 相关组件
│   │   └── layout/              # 布局组件
│   ├── lib/                     # 工具库
│   │   ├── api-client.ts        # API 客户端
│   │   └── hooks/               # React Hooks
│   ├── styles/                  # 样式文件
│   │   └── index.css
│   └── assets/                  # 静态资源
├── public/                       # 公共静态资源
│   ├── index.html
│   └── favicon.ico
├── vite.config.ts               # Vite 配置
├── index.html                    # HTML 入口
├── package.json
└── tsconfig.json
```

**职责**：
- Web 用户界面
- 任务管理 UI
- Agent 状态监控
- 配置管理界面

**技术栈**：
- **React**：UI 框架
- **Vite**：构建工具和开发服务器
- **React Router**：路由管理
- **Tailwind CSS**：样式框架
- **shadcn/ui**：组件库（可选）

---

### packages/cli/ - CLI 工具

```
packages/cli/
├── src/
│   ├── index.ts                 # CLI 入口
│   ├── commands/                # 命令定义
│   │   ├── task.ts
│   │   ├── agent.ts
│   │   └── deploy.ts
│   └── utils/                   # CLI 工具函数
├── package.json
└── tsconfig.json
```

**职责**：
- 命令行工具
- 本地开发辅助
- 部署脚本

---

### infrastructure/ - 基础设施层

```
infrastructure/
├── adapters/                     # 适配器接口定义
│   ├── storage.ts               # 存储接口
│   ├── executor.ts               # 执行器接口
│   ├── email.ts                 # 邮件接口
│   ├── vector-store.ts          # 向量数据库接口
│   └── cache.ts                 # 缓存接口
├── cloudflare/                   # Cloudflare 实现
│   ├── storage/
│   │   └── d1-storage.ts
│   ├── executor/
│   │   └── sandbox-executor.ts
│   ├── email/
│   │   └── email-workers.ts
│   ├── vector-store/
│   │   └── vectorize-store.ts
│   └── cache/
│       └── kv-cache.ts
├── local/                        # 本地实现
│   ├── storage/
│   │   └── postgres-storage.ts
│   ├── executor/
│   │   └── docker-executor.ts
│   ├── email/
│   │   └── smtp-email.ts
│   ├── vector-store/
│   │   └── qdrant-store.ts
│   └── cache/
│       └── redis-cache.ts
└── factory.ts                    # 工厂函数（根据环境创建实现）
```

**职责**：
- 定义基础设施抽象接口
- 提供 Cloudflare 和本地两种实现
- 工厂模式创建服务实例

---

### deployments/ - 部署配置

```
deployments/
├── cloudflare/
│   ├── wrangler.toml            # Worker 配置
│   ├── d1-schema.sql            # D1 数据库 Schema
│   ├── routes.json              # 路由配置
│   └── deploy.sh                # 部署脚本
├── docker/
│   ├── docker-compose.yml       # Docker Compose 配置
│   ├── Dockerfile.api           # API 服务 Dockerfile
│   ├── Dockerfile.executor      # 执行器服务 Dockerfile
│   ├── nginx.conf               # Nginx 配置（如果需要）
│   └── init-db.sql              # 数据库初始化脚本
└── scripts/
    ├── setup-local.sh           # 本地环境设置
    └── migrate-data.ts          # 数据迁移工具
```

**职责**：
- Cloudflare 部署配置
- Docker Compose 配置
- 部署脚本和工具

---

### docs/ - 文档

```
docs/
├── ARCHITECTURE.md               # 架构设计
├── DEPLOYMENT_STRATEGY.md        # 部署策略
├── CLOUDFLARE_AGENT_SERVICES.md # Cloudflare 服务调研
├── CORE_MODULE_DESIGN.md        # 核心模块设计
├── PROJECT_STRUCTURE.md         # 项目结构（本文件）
├── API.md                        # API 文档
├── DEVELOPMENT.md                # 开发指南
└── DEPLOYMENT.md                 # 部署指南
```

---

### scripts/ - 工具脚本

```
scripts/
├── build.sh                     # 构建脚本
├── test.sh                      # 测试脚本
├── lint.sh                      # 代码检查
├── format.sh                    # 代码格式化
└── generate-types.ts            # 类型生成工具
```

---

### tests/ - 测试

```
tests/
├── unit/                        # 单元测试
├── integration/                 # 集成测试
├── e2e/                         # 端到端测试
└── fixtures/                    # 测试数据
```

---

### .github/ - CI/CD

```
.github/
├── workflows/
│   ├── ci.yml                   # 持续集成
│   ├── deploy-cloudflare.yml    # Cloudflare 部署
│   └── test.yml                 # 测试流程
└── ISSUE_TEMPLATE/              # Issue 模板
```

---

## 配置文件

### 根目录配置文件

```
engineer-agent/
├── package.json                 # Workspace 根配置
├── pnpm-workspace.yaml          # pnpm workspace
├── turbo.json                   # Turborepo（可选）
├── .gitignore
├── .eslintrc.js                 # ESLint 配置
├── .prettierrc                  # Prettier 配置
├── tsconfig.base.json           # 基础 TypeScript 配置
├── .env.example                 # 环境变量示例
└── README.md
```

---

## 包依赖关系

```
packages/core
  └── (无依赖，纯业务逻辑)

packages/shared
  └── (无依赖，纯类型和工具)

packages/api
  ├── packages/core
  ├── packages/shared
  └── infrastructure/

packages/web
  ├── packages/shared
  └── packages/api (仅类型，通过 API 调用)

packages/cli
  ├── packages/core
  └── packages/shared

infrastructure/
  ├── packages/shared
  └── (适配器接口)
```

---

## 开发工作流

### 本地开发

```bash
# 1. 安装依赖
pnpm install

# 2. 启动本地服务（Docker Compose）
docker-compose -f deployments/docker/docker-compose.yml up -d

# 3. 启动开发服务器
pnpm dev                    # 启动所有服务（API + Web）
# 或分别启动
pnpm --filter @engineer-agent/api dev    # 仅启动 API
pnpm --filter @engineer-agent/web dev    # 仅启动前端（Vite）

# 4. 运行测试
pnpm test
```

### 构建

```bash
# 构建所有包
pnpm build

# 构建特定包
pnpm --filter @engineer-agent/core build
```

### 部署

```bash
# 部署到 Cloudflare
pnpm deploy:cloudflare

# 或本地 Docker
docker-compose -f deployments/docker/docker-compose.yml up -d
```

---

## 技术栈建议

### 包管理
- **pnpm**：快速、节省空间
- **Turborepo**（可选）：Monorepo 构建加速

### 构建工具
- **TypeScript**：类型安全
- **tsup**：快速构建（后端包）
- **Vite**：前端构建工具（React 应用）

### 代码质量
- **ESLint**：代码检查
- **Prettier**：代码格式化
- **Vitest**：测试框架

### 前端
- **React**：UI 框架
- **Vite**：构建工具和开发服务器
- **React Router**：路由管理
- **Tailwind CSS**：样式框架
- **shadcn/ui**：组件库（可选）

### 后端
- **Hono**：轻量级 Web 框架（Worker 友好）
- **Zod**：运行时类型验证

---

## 优势

1. **清晰的职责分离**：每个包职责明确
2. **代码复用**：共享代码通过 `packages/shared`
3. **独立部署**：各包可以独立构建和部署
4. **易于扩展**：新功能可以添加新包
5. **统一管理**：Monorepo 便于版本管理和依赖管理

