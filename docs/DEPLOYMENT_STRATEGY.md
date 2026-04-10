# 部署架构方案：Cloudflare + 本地 Docker Compose

## 设计目标

支持两种部署模式：
1. **Cloudflare 部署**：一键部署到 Cloudflare，使用所有原生基础设施
2. **本地开发**：通过 `docker-compose up` 一键拉起，使用纯开源技术栈

## 核心设计原则

### 1. 抽象层架构

所有基础设施服务都通过抽象接口访问，支持多实现：

```
应用层（Agent 核心逻辑）
    ↓
抽象接口层（Storage, Executor, Email, LLM Gateway）
    ↓
实现层（Cloudflare 实现 / 本地实现）
    ↓
基础设施（Cloudflare 服务 / Docker 容器）
```

### 2. 环境自动检测

通过环境变量或配置文件自动检测运行环境：
- `CLOUDFLARE_ENV=true` → 使用 Cloudflare 实现
- 默认或 `LOCAL_ENV=true` → 使用本地 Docker 实现

### 3. 配置统一管理

使用统一的配置系统，通过环境变量或配置文件指定：
- 基础设施提供者（Cloudflare / Local）
- 服务端点地址
- 认证信息

## 架构设计

### 抽象接口层

定义以下核心接口：

1. **Storage Interface**：任务和状态存储
   - Cloudflare 实现：D1（SQL 数据库）
   - 本地实现：PostgreSQL（Docker 容器）

2. **Executor Interface**：代码执行环境
   - Cloudflare 实现：Sandbox SDK
   - 本地实现：Docker 容器（隔离执行）

3. **Email Interface**：邮件处理
   - Cloudflare 实现：Email Workers / Resend API
   - 本地实现：本地 SMTP 服务器（如 MailHog）或 IMAP/SMTP

4. **LLM Gateway Interface**：LLM 调用管理
   - Cloudflare 实现：AI Gateway
   - 本地实现：本地代理服务（缓存、限流）

5. **Vector Store Interface**：向量数据库
   - Cloudflare 实现：Vectorize
   - 本地实现：Qdrant（Docker 容器）

6. **Cache Interface**：缓存服务
   - Cloudflare 实现：KV
   - 本地实现：Redis（Docker 容器）

### 本地 Docker Compose 服务栈

本地环境通过 Docker Compose 提供以下服务：

1. **PostgreSQL**：替代 D1，存储任务和状态
2. **Redis**：替代 KV，提供缓存
3. **Qdrant**：替代 Vectorize，向量数据库
4. **MailHog**：本地邮件服务器，用于测试邮件功能
5. **Executor Service**：基于 Docker 的代码执行服务
   - 每个任务在独立的 Docker 容器中执行
   - 支持 Python、Node.js、Shell 等
   - 资源限制和隔离
6. **LLM Gateway Proxy**：本地 LLM 调用代理
   - 提供缓存、限流、重试功能
   - 可以路由到 OpenAI/Anthropic API
7. **Agent Worker**：Agent 核心逻辑服务
   - 运行 Agent 主程序
   - 定时任务调度

### Cloudflare 部署架构

使用 Cloudflare 原生服务：

1. **Workers**：Agent 核心逻辑
2. **D1**：任务存储
3. **Sandbox SDK**：代码执行（通过 Durable Objects）
4. **Vectorize**：向量数据库
5. **KV**：缓存
6. **AI Gateway**：LLM 调用管理
7. **Email Workers**：邮件处理
8. **Cron Triggers**：定时任务

## 实现策略

### 1. 工厂模式创建服务

根据环境变量自动选择实现：

```
if (isCloudflareEnv) {
  storage = new CloudflareD1Storage(config);
  executor = new CloudflareSandboxExecutor(config);
  email = new CloudflareEmailService(config);
} else {
  storage = new LocalPostgresStorage(config);
  executor = new DockerExecutor(config);
  email = new LocalEmailService(config);
}
```

### 2. 配置管理

使用统一的配置系统：
- 环境变量优先
- 配置文件作为默认值
- 支持 `.env.local` 和 `.env.cloudflare`

### 3. 数据迁移

提供数据迁移工具：
- 本地开发数据可以导出
- 支持从本地迁移到 Cloudflare
- 保持数据格式兼容

## 部署流程

### 本地开发

```bash
# 1. 配置环境变量
cp .env.example .env.local

# 2. 一键启动所有服务
docker-compose up -d

# 3. 运行 Agent
npm run dev
```

### Cloudflare 部署

```bash
# 1. 配置 Cloudflare 环境变量
cp .env.example .env.cloudflare

# 2. 一键部署
npm run deploy:cloudflare
# 或
wrangler deploy
```

## 关键差异处理

### 1. 执行器差异

- **Cloudflare**：Sandbox SDK 提供完整的隔离环境
- **本地**：Docker 容器提供类似功能，需要管理容器生命周期

### 2. 存储差异

- **Cloudflare D1**：SQLite 兼容，但有限制
- **本地 PostgreSQL**：功能更强大，需要适配 SQL 差异

### 3. 邮件差异

- **Cloudflare**：Email Workers 或第三方 API
- **本地**：MailHog（开发）或真实 SMTP（生产）

### 4. 向量数据库差异

- **Cloudflare Vectorize**：专有 API
- **本地 Qdrant**：开源向量数据库，API 兼容

## 优势

1. **开发体验**：本地完整环境，快速迭代
2. **生产就绪**：Cloudflare 原生服务，高性能
3. **成本优化**：本地开发免费，生产按需付费
4. **灵活性**：可以混合使用（如本地开发 + Cloudflare AI Gateway）

## 实施步骤

1. **Phase 1**：实现抽象接口层
2. **Phase 2**：实现本地 Docker Compose 服务
3. **Phase 3**：实现 Cloudflare 服务适配
4. **Phase 4**：统一配置和部署脚本
5. **Phase 5**：测试和优化

