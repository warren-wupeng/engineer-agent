# 核心 Agent 模块详细设计

## 一、设计目标

构建一个函数式编程风格的核心 Agent 模块，具备以下特性：

1. **纯函数设计**：所有核心逻辑都是纯函数，易于测试和推理
2. **不可变状态**：所有状态更新都返回新状态，避免副作用
3. **类型安全**：充分利用 TypeScript 的类型系统
4. **可组合性**：通过函数组合构建复杂流程
5. **错误处理**：使用 Result 类型显式处理错误

## 二、核心类型系统

### 2.1 Task（任务）

任务是不可变的核心实体，包含完整的生命周期信息：

```typescript
interface Task {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly source: string;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly plan?: Plan;
  readonly result?: TaskResult;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

**状态机流程**：
```
pending → analyzing → planned → executing → completed/failed
```

### 2.2 Plan（计划）

计划由多个步骤组成，每个步骤可以有依赖关系：

```typescript
interface Plan {
  readonly id: string;
  readonly taskId: string;
  readonly steps: ReadonlyArray<Step>;
  readonly estimatedDuration?: number;
  readonly createdAt: Date;
}
```

**依赖验证**：
- 所有依赖的步骤必须存在
- 不能有循环依赖（使用拓扑排序检测）

### 2.3 Result<T, E>（结果类型）

函数式编程中的 Either 模式，用于显式处理错误：

```typescript
type Result<T, E = AgentError> = 
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
```

**优势**：
- 强制调用者处理错误
- 类型安全
- 无异常抛出，更可预测

## 三、Agent 核心类设计

### 3.1 设计原则

Agent 类遵循以下原则：

1. **不可变状态**：所有方法返回新状态，不修改原状态
2. **纯函数方法**：查询方法（get*）是纯函数
3. **异步操作**：所有涉及 LLM 的操作都是异步的
4. **错误处理**：使用 Result 类型返回错误

### 3.2 核心方法

#### 状态管理
- `createInitialState()`: 创建初始状态（静态方法）
- `addTask()`: 添加新任务，返回新状态
- `updateTask()`: 更新任务，返回新状态和 Result

#### 任务处理
- `analyzeTask()`: 使用 LLM 分析任务，更新优先级
- `planTask()`: 使用规划器创建执行计划
- `getTask()`: 获取单个任务（纯函数）
- `getPendingTasks()`: 获取待处理任务（纯函数）

#### 查询方法（纯函数）
- `getAllTasks()`: 获取所有任务
- `getTasksByStatus()`: 按状态过滤
- `getTasksByPriority()`: 按优先级过滤

## 四、LLM 抽象层设计

### 4.1 接口设计

```typescript
interface LLMClient {
  complete(prompt: string, systemPrompt?: string): Promise<Result<LLMResponse>>;
  completeStructured<T>(prompt: string, schema: object, systemPrompt?: string): Promise<Result<T>>;
}
```

### 4.2 实现策略

- **OpenAI**: 使用官方 SDK，支持 JSON mode
- **Anthropic**: 使用官方 SDK，通过 prompt 工程实现结构化输出
- **扩展性**: 通过工厂函数 `createLLMClient()` 创建，易于添加新提供商

### 4.3 错误处理

所有 LLM 调用都返回 `Result<LLMResponse>`，错误信息包含：
- 错误类型
- 错误消息
- 原始错误（可选）

## 五、规划器设计

### 5.1 规划流程

1. **构建提示词**：根据任务信息构建规划提示词
2. **调用 LLM**：使用结构化输出获取计划
3. **验证依赖**：检查步骤依赖关系的有效性
4. **构建 Plan**：创建不可变的 Plan 对象

### 5.2 依赖验证

使用深度优先搜索（DFS）检测循环依赖：

```typescript
const hasCycle = (steps: Step[]): boolean => {
  // DFS 实现
  // 返回 true 如果发现循环依赖
};
```

### 5.3 规划结果

```typescript
interface PlanningResult {
  readonly plan: Plan;
  readonly reasoning: string;    // 规划理由
  readonly confidence: number;   // 置信度 0-1
}
```

## 六、函数式编程实践

### 6.1 不可变性

所有状态更新都创建新对象：

```typescript
// ❌ 错误：直接修改
state.tasks.push(newTask);

// ✅ 正确：创建新对象
const newState = {
  ...state,
  tasks: [...state.tasks, newTask]
};
```

### 6.2 纯函数

查询方法都是纯函数：

```typescript
// ✅ 纯函数：相同输入总是产生相同输出，无副作用
const getPendingTasks = (state: AgentState): ReadonlyArray<Task> => {
  return state.tasks.filter(t => 
    t.status === 'pending' || 
    t.status === 'analyzing' || 
    t.status === 'planned'
  );
};
```

### 6.3 函数组合

通过函数组合构建复杂流程：

```typescript
const processTask = async (state: AgentState, taskId: string) => {
  // 1. 分析任务
  const analyzeResult = await agent.analyzeTask(state, taskId);
  if (!analyzeResult.ok) return analyzeResult;
  
  // 2. 规划任务
  const planResult = await agent.planTask(analyzeResult.value, taskId);
  if (!planResult.ok) return planResult;
  
  // 3. 返回最终状态
  return ok(planResult.value.state);
};
```

### 6.4 错误处理

使用 Result 类型显式处理错误：

```typescript
const result = await agent.planTask(state, taskId);
if (result.ok) {
  // 处理成功情况
  const { state: newState, planningResult } = result.value;
} else {
  // 处理错误情况
  switch (result.error.type) {
    case 'PLANNING_ERROR':
      // 处理规划错误
      break;
    case 'VALIDATION_ERROR':
      // 处理验证错误
      break;
  }
}
```

## 七、扩展性设计

### 7.1 添加新的 LLM 提供商

1. 在 `LLMConfig` 中添加新的 provider 类型
2. 在 `createLLMClient` 中添加新的 case
3. 实现对应的客户端函数

### 7.2 添加新的规划策略

1. 实现新的 `Planner` 接口
2. 在 Agent 构造函数中可选择使用不同的规划器

### 7.3 添加新的任务操作

1. 扩展 `Task` 类型（保持向后兼容）
2. 在 Agent 中添加新的纯函数方法

## 八、测试策略

### 8.1 单元测试

- **纯函数测试**：测试输入输出关系
- **状态转换测试**：验证状态更新的正确性
- **错误处理测试**：验证各种错误情况

### 8.2 集成测试

- **完整流程测试**：测试从任务创建到规划完成的完整流程
- **LLM Mock**：使用 mock 测试 LLM 交互

### 8.3 类型测试

- 利用 TypeScript 的类型系统进行编译时检查
- 确保不可变性约束（readonly）

## 九、性能考虑

### 9.1 状态更新

虽然使用不可变数据，但通过浅拷贝和数组操作，性能影响最小。

### 9.2 LLM 调用

- 异步处理，不阻塞主线程
- 支持并发任务处理（通过配置限制）

### 9.3 内存管理

- 不可变数据结构可以被安全地共享
- 旧状态可以被垃圾回收

## 十、未来扩展

### 10.1 执行器模块

下一步可以添加执行器模块，负责执行计划中的步骤。

### 10.2 持久化存储

添加存储抽象层，支持本地文件系统和云端存储。

### 10.3 任务调度

添加任务调度器，支持优先级队列和并发控制。

