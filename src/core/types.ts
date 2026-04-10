/**
 * 核心类型定义 - 使用函数式编程范式
 * 所有类型都是不可变的，使用 readonly 和类型别名
 */

/**
 * 任务状态 - 使用联合类型表示状态机
 */
export type TaskStatus = 
  | 'pending'      // 待处理
  | 'analyzing'    // 分析中
  | 'planned'      // 已规划
  | 'executing'    // 执行中
  | 'completed'    // 已完成
  | 'failed'       // 失败
  | 'cancelled';   // 已取消

/**
 * 任务优先级
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * 执行步骤 - 原子操作单元
 */
export interface Step {
  readonly id: string;
  readonly description: string;
  readonly action: string;        // 要执行的动作类型
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly dependencies: ReadonlyArray<string>; // 依赖的其他步骤ID
}

/**
 * 执行计划 - 由多个步骤组成
 */
export interface Plan {
  readonly id: string;
  readonly taskId: string;
  readonly steps: ReadonlyArray<Step>;
  readonly estimatedDuration?: number; // 预估时长（秒）
  readonly createdAt: Date;
}

/**
 * 任务 - 核心实体
 */
export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly source: string;        // 任务来源（如 email id）
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly plan?: Plan;
  readonly result?: TaskResult;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * 任务执行结果
 */
export interface TaskResult {
  readonly success: boolean;
  readonly output?: string;
  readonly error?: string;
  readonly stepsCompleted: ReadonlyArray<string>; // 完成的步骤ID
  readonly stepsFailed: ReadonlyArray<string>;    // 失败的步骤ID
  readonly completedAt: Date;
}

/**
 * Agent 状态 - 不可变状态容器
 */
export interface AgentState {
  readonly tasks: ReadonlyArray<Task>;
  readonly currentTaskId?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Agent 配置
 */
export interface AgentConfig {
  readonly llm: LLMConfig;
  readonly maxConcurrentTasks?: number;
  readonly retryAttempts?: number;
}

/**
 * LLM 配置
 */
export interface LLMConfig {
  readonly provider: 'openai' | 'anthropic' | 'ai-gateway' | 'custom';
  readonly model: string;
  readonly apiKey: string;
  readonly baseURL?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

/**
 * LLM 响应抽象
 */
export interface LLMResponse {
  readonly content: string;
  readonly usage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
}

/**
 * 规划结果
 */
export interface PlanningResult {
  readonly plan: Plan;
  readonly reasoning: string;     // 规划理由
  readonly confidence: number;    // 置信度 0-1
}

/**
 * 错误类型 - 使用联合类型表示可能的错误
 */
export type AgentError = 
  | { readonly type: 'LLM_ERROR'; readonly message: string; readonly cause?: unknown }
  | { readonly type: 'PLANNING_ERROR'; readonly message: string; readonly taskId: string }
  | { readonly type: 'EXECUTION_ERROR'; readonly message: string; readonly stepId: string }
  | { readonly type: 'VALIDATION_ERROR'; readonly message: string; readonly field: string }
  | { readonly type: 'UNKNOWN_ERROR'; readonly message: string; readonly cause?: unknown };

/**
 * Result 类型 - 函数式编程中的 Either 模式
 * 用于表示可能失败的操作
 */
export type Result<T, E = AgentError> = 
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/**
 * 工具函数：创建成功结果
 */
export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

/**
 * 工具函数：创建失败结果
 */
export const err = <E = AgentError>(error: E): Result<never, E> => ({ ok: false, error });

