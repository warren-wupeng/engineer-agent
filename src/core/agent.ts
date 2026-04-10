/**
 * 核心 Agent 模块
 * 使用函数式编程范式：纯函数、不可变数据、函数组合
 */

import type {
  AgentState,
  Task,
  TaskStatus,
  TaskPriority,
  Result,
  PlanningResult,
  AgentConfig,
} from './types.js';
import { ok, err } from './types.js';
import type { LLMClient } from './llm/llm-client.js';
import { createLLMClient } from './llm/llm-client.js';
import type { Planner } from './planner/planner.js';
import { createLLMPlanner } from './planner/planner.js';

/**
 * Agent 核心类 - 使用函数式风格
 * 所有方法都是纯函数或返回新的不可变状态
 */
export class Agent {
  private readonly llmClient: LLMClient;
  private readonly planner: Planner;
  private readonly config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = Object.freeze(config);
    this.llmClient = createLLMClient(config.llm);
    this.planner = createLLMPlanner(this.llmClient);
  }

  /**
   * 创建初始 Agent 状态 - 纯函数
   */
  static createInitialState(): AgentState {
    return Object.freeze({
      tasks: Object.freeze([]),
      metadata: Object.freeze({}),
    });
  }

  /**
   * 添加新任务 - 返回新状态（不可变）
   */
  addTask(
    state: AgentState,
    task: Omit<Task, 'id' | 'status' | 'createdAt' | 'updatedAt'>
  ): AgentState {
    const newTask: Task = Object.freeze({
      ...task,
      id: generateTaskId(),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return Object.freeze({
      ...state,
      tasks: Object.freeze([...state.tasks, newTask]),
    });
  }

  /**
   * 更新任务 - 返回新状态（不可变）
   */
  updateTask(
    state: AgentState,
    taskId: string,
    updates: Partial<Omit<Task, 'id' | 'createdAt'>> & { updatedAt: Date }
  ): Result<AgentState> {
    const taskIndex = state.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      return err({
        type: 'VALIDATION_ERROR',
        message: `Task ${taskId} not found`,
        field: 'taskId',
      });
    }

    const existingTask = state.tasks[taskIndex];
    const updatedTask: Task = Object.freeze({
      ...existingTask,
      ...updates,
      updatedAt: new Date(),
    });

    const newTasks = [...state.tasks];
    newTasks[taskIndex] = updatedTask;

    return ok(Object.freeze({
      ...state,
      tasks: Object.freeze(newTasks),
    }));
  }

  /**
   * 分析任务 - 使用 LLM 分析任务内容
   * 返回更新后的状态
   */
  async analyzeTask(
    state: AgentState,
    taskId: string
  ): Promise<Result<AgentState>> {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) {
      return err({
        type: 'VALIDATION_ERROR',
        message: `Task ${taskId} not found`,
        field: 'taskId',
      });
    }

    if (task.status !== 'pending') {
      return err({
        type: 'VALIDATION_ERROR',
        message: `Task ${taskId} is not in pending status`,
        field: 'status',
      });
    }

    // 使用 LLM 分析任务，提取优先级等信息
    const analysisPrompt = `Analyze this task and determine its priority and complexity:

Title: ${task.title}
Description: ${task.description}

Return a JSON object with:
- priority: "low" | "medium" | "high" | "urgent"
- complexity: "simple" | "moderate" | "complex"
- estimatedTime: number (in minutes)
- reasoning: string`;

    const analysisSchema = {
      type: 'object',
      properties: {
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        complexity: { type: 'string', enum: ['simple', 'moderate', 'complex'] },
        estimatedTime: { type: 'number' },
        reasoning: { type: 'string' },
      },
      required: ['priority', 'complexity', 'estimatedTime', 'reasoning'],
    };

    const analysisResult = await this.llmClient.completeStructured<{
      priority: TaskPriority;
      complexity: string;
      estimatedTime: number;
      reasoning: string;
    }>(analysisPrompt, analysisSchema);

    if (!analysisResult.ok) {
      return analysisResult;
    }

    // 更新任务状态为 analyzing，然后更新优先级
    const updateResult1 = this.updateTask(state, taskId, {
      status: 'analyzing',
      updatedAt: new Date(),
    });

    if (!updateResult1.ok) {
      return updateResult1;
    }

    const updateResult2 = this.updateTask(updateResult1.value, taskId, {
      priority: analysisResult.value.priority,
      status: 'analyzing',
      updatedAt: new Date(),
    });

    return updateResult2;
  }

  /**
   * 规划任务 - 为任务创建执行计划
   * 返回更新后的状态和规划结果
   */
  async planTask(
    state: AgentState,
    taskId: string
  ): Promise<Result<{ state: AgentState; planningResult: PlanningResult }>> {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) {
      return err({
        type: 'VALIDATION_ERROR',
        message: `Task ${taskId} not found`,
        field: 'taskId',
      });
    }

    if (task.status !== 'analyzing' && task.status !== 'pending') {
      return err({
        type: 'VALIDATION_ERROR',
        message: `Task ${taskId} cannot be planned in status ${task.status}`,
        field: 'status',
      });
    }

    // 使用规划器创建计划
    const planningResult = await this.planner.plan(task);
    if (!planningResult.ok) {
      return planningResult;
    }

    // 更新任务状态，添加计划
    const updateResult = this.updateTask(state, taskId, {
      status: 'planned',
      plan: planningResult.value.plan,
      updatedAt: new Date(),
    });

    if (!updateResult.ok) {
      return updateResult;
    }

    return ok({
      state: updateResult.value,
      planningResult: planningResult.value,
    });
  }

  /**
   * 获取待处理任务列表 - 纯函数
   */
  getPendingTasks(state: AgentState): ReadonlyArray<Task> {
    return state.tasks.filter(t => 
      t.status === 'pending' || t.status === 'analyzing' || t.status === 'planned'
    );
  }

  /**
   * 获取任务 - 纯函数
   */
  getTask(state: AgentState, taskId: string): Task | undefined {
    return state.tasks.find(t => t.id === taskId);
  }

  /**
   * 获取所有任务 - 纯函数
   */
  getAllTasks(state: AgentState): ReadonlyArray<Task> {
    return state.tasks;
  }

  /**
   * 按状态过滤任务 - 纯函数
   */
  getTasksByStatus(
    state: AgentState,
    status: TaskStatus
  ): ReadonlyArray<Task> {
    return state.tasks.filter(t => t.status === status);
  }

  /**
   * 按优先级过滤任务 - 纯函数
   */
  getTasksByPriority(
    state: AgentState,
    priority: TaskPriority
  ): ReadonlyArray<Task> {
    return state.tasks.filter(t => t.priority === priority);
  }
}

/**
 * 生成任务ID - 纯函数
 */
const generateTaskId = (): string => {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

