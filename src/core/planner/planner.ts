/**
 * 规划器模块 - 使用函数式编程范式
 * 负责将任务分解为可执行的步骤
 */

import type { Task, Plan, Step, PlanningResult, Result, LLMClient } from '../types.js';
import { ok, err } from '../types.js';

/**
 * 规划器接口 - 纯函数
 */
export interface Planner {
  /**
   * 为任务创建执行计划
   * @param task 要规划的任务
   * @returns Result 包含规划结果或错误
   */
  readonly plan: (task: Task) => Promise<Result<PlanningResult>>;
}

/**
 * LLM 规划器实现
 * 使用 LLM 进行任务分析和规划
 */
export const createLLMPlanner = (llmClient: LLMClient): Planner => {
  const systemPrompt = `You are an expert software engineering task planner. 
Your job is to analyze tasks and break them down into concrete, executable steps.
Each step should be:
- Atomic and specific
- Have clear dependencies
- Be executable by a software agent
- Include necessary parameters

Return your plan as a structured JSON format.`;

  return {
    plan: async (task: Task): Promise<Result<PlanningResult>> => {
      const planningPrompt = createPlanningPrompt(task);
      
      // 定义 JSON Schema 用于结构化输出
      const planSchema = {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                description: { type: 'string' },
                action: { type: 'string' },
                parameters: { type: 'object' },
                dependencies: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['id', 'description', 'action', 'parameters', 'dependencies'],
            },
          },
          reasoning: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          estimatedDuration: { type: 'number' },
        },
        required: ['steps', 'reasoning', 'confidence'],
      };

      const result = await llmClient.completeStructured<{
        steps: Array<{
          id: string;
          description: string;
          action: string;
          parameters: Record<string, unknown>;
          dependencies: string[];
        }>;
        reasoning: string;
        confidence: number;
        estimatedDuration?: number;
      }>(planningPrompt, planSchema, systemPrompt);

      if (!result.ok) {
        return err({
          type: 'PLANNING_ERROR',
          message: result.error.message,
          taskId: task.id,
        });
      }

      const { value } = result;
      
      // 验证步骤依赖关系
      const validationResult = validatePlanSteps(value.steps);
      if (!validationResult.ok) {
        return validationResult;
      }

      // 构建 Plan 对象
      const steps: ReadonlyArray<Step> = value.steps.map(step => ({
        id: step.id,
        description: step.description,
        action: step.action,
        parameters: Object.freeze(step.parameters),
        dependencies: Object.freeze(step.dependencies),
      }));

      const plan: Plan = {
        id: generatePlanId(task.id),
        taskId: task.id,
        steps: Object.freeze(steps),
        estimatedDuration: value.estimatedDuration,
        createdAt: new Date(),
      };

      return ok({
        plan,
        reasoning: value.reasoning,
        confidence: value.confidence,
      });
    },
  };
};

/**
 * 创建规划提示词 - 纯函数
 */
const createPlanningPrompt = (task: Task): string => {
  return `Task: ${task.title}

Description: ${task.description}

Priority: ${task.priority}
Status: ${task.status}

Please analyze this task and create a detailed execution plan. Break it down into concrete steps that can be executed by a software agent. Each step should be:
1. Specific and actionable
2. Have a clear action type (e.g., "read_file", "write_file", "run_command", "git_commit")
3. Include all necessary parameters
4. Specify dependencies on other steps

Consider the task priority and complexity when planning.`;
};

/**
 * 验证计划步骤 - 纯函数
 * 检查依赖关系是否有效（无循环依赖，依赖的步骤存在）
 */
const validatePlanSteps = (
  steps: Array<{ id: string; dependencies: string[] }>
): Result<void> => {
  const stepIds = new Set(steps.map(s => s.id));

  // 检查所有依赖的步骤是否存在
  for (const step of steps) {
    for (const depId of step.dependencies) {
      if (!stepIds.has(depId)) {
        return err({
          type: 'VALIDATION_ERROR',
          message: `Step ${step.id} depends on non-existent step ${depId}`,
          field: 'dependencies',
        });
      }
    }
  }

  // 检查循环依赖（使用拓扑排序）
  if (hasCycle(steps)) {
    return err({
      type: 'VALIDATION_ERROR',
      message: 'Circular dependency detected in plan steps',
      field: 'dependencies',
    });
  }

  return ok(undefined);
};

/**
 * 检查是否有循环依赖 - 纯函数
 * 使用 DFS 检测环
 */
const hasCycle = (
  steps: Array<{ id: string; dependencies: string[] }>
): boolean => {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const dfs = (stepId: string): boolean => {
    if (recursionStack.has(stepId)) {
      return true; // 发现环
    }
    if (visited.has(stepId)) {
      return false;
    }

    visited.add(stepId);
    recursionStack.add(stepId);

    const step = steps.find(s => s.id === stepId);
    if (step) {
      for (const depId of step.dependencies) {
        if (dfs(depId)) {
          return true;
        }
      }
    }

    recursionStack.delete(stepId);
    return false;
  };

  for (const step of steps) {
    if (!visited.has(step.id) && dfs(step.id)) {
      return true;
    }
  }

  return false;
};

/**
 * 生成计划ID - 纯函数
 */
const generatePlanId = (taskId: string): string => {
  return `plan_${taskId}_${Date.now()}`;
};

