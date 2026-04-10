# 核心 Agent 模块架构设计

## 设计原则

### 函数式编程范式

核心 Agent 模块采用函数式编程范式，具有以下特点：

1. **纯函数**：所有核心函数都是纯函数，无副作用
2. **不可变数据**：所有数据结构使用 `readonly` 和 `Object.freeze` 确保不可变性
3. **函数组合**：通过函数组合构建复杂逻辑
4. **类型安全**：使用 TypeScript 的严格类型系统
5. **Result 类型**：使用 `Result<T, E>` 类型处理可能失败的操作（类似 Either 模式）

## 模块结构

```
src/
├── core/
│   ├── types.ts           # 核心类型定义（不可变数据结构）
│   ├── agent.ts           # Agent 核心类（函数式风格）
│   ├── llm/
│   │   └── llm-client.ts  # LLM 客户端抽象层
│   └── planner/
│       └── planner.ts     # 任务规划器
├── index.ts               # 主入口
└── examples/
    └── basic-usage.ts     # 使用示例
```

## 核心类型系统

### Task（任务）
- 不可变的任务实体
- 包含状态机：`pending` → `analyzing` → `planned` → `executing` → `completed`/`failed`
- 支持优先级和计划关联

### Plan（计划）
- 由多个 Step 组成
- 每个 Step 有依赖关系
- 支持依赖验证（防止循环依赖）

### AgentState（Agent 状态）
- 不可变的状态容器
- 包含所有任务列表
- 所有状态更新都返回新状态

### Result<T, E>（结果类型）
- 函数式编程中的 Either 模式
- `ok: true` 表示成功，包含 `value: T`
- `ok: false` 表示失败，包含 `error: E`

## 核心流程

### 1. 任务添加
```typescript
const newState = agent.addTask(state, taskData);
// 返回新的不可变状态
```

### 2. 任务分析
```typescript
const result = await agent.analyzeTask(state, taskId);
if (result.ok) {
  state = result.value; // 更新状态
}
```

### 3. 任务规划
```typescript
const result = await agent.planTask(state, taskId);
if (result.ok) {
  state = result.value.state;
  const plan = result.value.planningResult.plan;
}
```

## LLM 抽象层

### 设计目标
- 支持多个 LLM 提供商（OpenAI、Anthropic）
- 统一的接口，易于扩展
- 支持结构化输出

### 接口设计
```typescript
interface LLMClient {
  complete(prompt: string, systemPrompt?: string): Promise<Result<LLMResponse>>;
  completeStructured<T>(prompt: string, schema: object, systemPrompt?: string): Promise<Result<T>>;
}
```

## 规划器设计

### 功能
- 使用 LLM 分析任务
- 将任务分解为可执行的步骤
- 验证步骤依赖关系
- 生成执行计划

### 规划流程
1. 构建规划提示词
2. 调用 LLM 生成结构化计划
3. 验证步骤依赖（检查循环依赖）
4. 构建 Plan 对象

## 函数式编程实践

### 1. 不可变性
```typescript
// 所有状态更新返回新对象
const newState = {
  ...state,
  tasks: [...state.tasks, newTask]
};
```

### 2. 纯函数
```typescript
// 纯函数：输入相同，输出相同，无副作用
const getPendingTasks = (state: AgentState): ReadonlyArray<Task> => {
  return state.tasks.filter(t => t.status === 'pending');
};
```

### 3. 错误处理
```typescript
// 使用 Result 类型显式处理错误
const result = await agent.planTask(state, taskId);
if (!result.ok) {
  // 处理错误
  console.error(result.error);
}
```

### 4. 函数组合
```typescript
// 通过函数组合构建复杂流程
const processTask = async (state: AgentState, taskId: string) => {
  const analyzeResult = await agent.analyzeTask(state, taskId);
  if (!analyzeResult.ok) return analyzeResult;
  
  const planResult = await agent.planTask(analyzeResult.value, taskId);
  return planResult;
};
```

## 扩展性设计

### 添加新的 LLM 提供商
1. 在 `LLMConfig` 中添加新的 provider 类型
2. 在 `createLLMClient` 中添加新的 case
3. 实现对应的客户端函数

### 添加新的规划策略
1. 实现新的 `Planner` 接口
2. 在 Agent 中可选择使用不同的规划器

### 添加新的任务操作
1. 扩展 `Task` 类型
2. 在 Agent 中添加新的纯函数方法

## 测试策略

### 单元测试
- 测试纯函数的输入输出
- 测试状态转换的正确性
- 测试错误处理

### 集成测试
- 测试完整的任务处理流程
- 测试 LLM 交互（使用 mock）

### 类型测试
- 利用 TypeScript 的类型系统进行编译时检查
- 确保不可变性约束

