import {
  type TIfElseNode,
  type TWorkflowCondition,
  type TWorkflowConditionGroup,
  type TWorkflowDefinition,
  type TWorkflowEdge,
  type TWorkflowNode,
  type TWorkflowStepResult,
  ZWorkflowDefinition,
} from "@formbricks/types/workflows";

type TWorkflowExecutionContext = {
  triggerPayload: unknown;
};

export type TWorkflowExecutionResult = {
  status: "completed" | "failed";
  steps: TWorkflowStepResult[];
  finalOutput?: unknown;
  error?: string;
};

const getTimestamp = (): string => new Date().toISOString();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const resolveWorkflowDataPath = (input: unknown, path: string): unknown => {
  const normalizedPath = path.startsWith("trigger.") ? path.slice("trigger.".length) : path;
  return normalizedPath.split(".").reduce<unknown>((current, segment) => {
    if (!isRecord(current)) {
      return undefined;
    }

    return current[segment];
  }, input);
};

const compareValues = (left: unknown, operator: TWorkflowCondition["operator"], right?: unknown): boolean => {
  const rightValue = isRecord(right) && right.type === "ref" ? undefined : right;

  switch (operator) {
    case "equals":
      return left === rightValue;
    case "notEquals":
      return left !== rightValue;
    case "lessThan":
      return Number(left) < Number(rightValue);
    case "lessEqual":
      return Number(left) <= Number(rightValue);
    case "greaterThan":
      return Number(left) > Number(rightValue);
    case "greaterEqual":
      return Number(left) >= Number(rightValue);
    case "contains":
      return typeof left === "string" && typeof rightValue === "string"
        ? left.includes(rightValue)
        : Array.isArray(left) && left.includes(rightValue);
    case "doesNotContain":
      return !compareValues(left, "contains", rightValue);
    case "isEmpty":
      return left === undefined || left === null || left === "" || (Array.isArray(left) && left.length === 0);
    case "isNotEmpty":
      return !compareValues(left, "isEmpty");
  }
};

const evaluateCondition = (condition: TWorkflowCondition, context: TWorkflowExecutionContext): boolean => {
  const left = resolveWorkflowDataPath(context.triggerPayload, condition.left.path);
  const right =
    isRecord(condition.right) && condition.right.type === "ref"
      ? resolveWorkflowDataPath(context.triggerPayload, condition.right.path as string)
      : condition.right;

  return compareValues(left, condition.operator, right);
};

export const evaluateConditionGroup = (
  group: TWorkflowConditionGroup,
  context: TWorkflowExecutionContext
): boolean => {
  const results = group.conditions.map((conditionOrGroup) => {
    if ("connector" in conditionOrGroup) {
      return evaluateConditionGroup(conditionOrGroup, context);
    }

    return evaluateCondition(conditionOrGroup, context);
  });

  return group.connector === "and" ? results.every(Boolean) : results.some(Boolean);
};

const getNode = (definition: TWorkflowDefinition, nodeId: string): TWorkflowNode | "trigger" | undefined => {
  if (nodeId === definition.trigger.id) {
    return "trigger";
  }

  return definition.nodes.find((node) => node.id === nodeId);
};

const getOutgoingEdge = (
  definition: TWorkflowDefinition,
  nodeId: string,
  branch: TWorkflowEdge["branch"]
): TWorkflowEdge | undefined =>
  definition.edges.find((edge) => edge.source === nodeId && edge.branch === branch);

const executeIfElseNode = (
  node: TIfElseNode,
  context: TWorkflowExecutionContext
): { output: { matched: boolean; branch: "then" | "else" }; branch: "then" | "else" } => {
  const matched = evaluateConditionGroup(node.config.condition, context);
  const branch = matched ? "then" : "else";

  return {
    branch,
    output: {
      matched,
      branch,
    },
  };
};

const executeActionNode = (
  node: TWorkflowNode,
  previousOutput: unknown,
  triggerPayload: unknown
): unknown => {
  if (node.type !== "action") {
    return undefined;
  }

  if (node.actionType === "sendEmailPreview") {
    return {
      preview: true,
      sent: false,
      actionType: node.actionType,
      to: node.config.to,
      replyTo: node.config.replyTo,
      subject: node.config.subject,
      body: node.config.body,
      response: node.config.includeResponseData ? (previousOutput ?? triggerPayload) : undefined,
    };
  }

  return {
    preview: true,
    sent: false,
    actionType: node.actionType,
    url: node.config.url,
    method: node.config.method,
    headers: node.config.headers,
    body: {
      response: previousOutput ?? triggerPayload,
    },
  };
};

export const executeWorkflowDefinition = (
  rawDefinition: unknown,
  triggerPayload: unknown
): TWorkflowExecutionResult => {
  const parsedDefinition = ZWorkflowDefinition.safeParse(rawDefinition);
  if (!parsedDefinition.success) {
    return {
      status: "failed",
      steps: [],
      error: parsedDefinition.error.issues.map((issue) => issue.message).join("; "),
    };
  }

  const definition = parsedDefinition.data;
  const context = { triggerPayload };
  const steps: TWorkflowStepResult[] = [];
  const visitedNodeIds = new Set<string>();
  let currentNodeId: string | undefined = definition.entryNodeId;
  let previousOutput: unknown = triggerPayload;

  while (currentNodeId) {
    if (visitedNodeIds.has(currentNodeId)) {
      return {
        status: "failed",
        steps,
        finalOutput: previousOutput,
        error: `Workflow graph cycle detected at node ${currentNodeId}`,
      };
    }
    visitedNodeIds.add(currentNodeId);

    const node = getNode(definition, currentNodeId);
    if (!node) {
      return {
        status: "failed",
        steps,
        finalOutput: previousOutput,
        error: `Workflow node ${currentNodeId} was not found`,
      };
    }

    const startedAt = getTimestamp();
    try {
      if (node === "trigger") {
        const finishedAt = getTimestamp();
        steps.push({
          nodeId: definition.trigger.id,
          status: "completed",
          input: triggerPayload,
          output: triggerPayload,
          startedAt,
          finishedAt,
        });
        previousOutput = triggerPayload;
        currentNodeId = getOutgoingEdge(definition, definition.trigger.id, "next")?.target;
        continue;
      }

      if (node.type === "ifElse") {
        const result = executeIfElseNode(node, context);
        const finishedAt = getTimestamp();
        steps.push({
          nodeId: node.id,
          status: "completed",
          input: triggerPayload,
          output: result.output,
          startedAt,
          finishedAt,
        });
        previousOutput = result.output;
        currentNodeId = getOutgoingEdge(definition, node.id, result.branch)?.target;
        continue;
      }

      const output = executeActionNode(node, previousOutput, triggerPayload);
      const finishedAt = getTimestamp();
      steps.push({
        nodeId: node.id,
        status: "completed",
        input: previousOutput,
        output,
        startedAt,
        finishedAt,
      });
      previousOutput = output;
      currentNodeId = getOutgoingEdge(definition, node.id, "next")?.target;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Workflow step failed";
      const finishedAt = getTimestamp();
      steps.push({
        nodeId: currentNodeId ?? "unknown",
        status: "failed",
        input: previousOutput,
        error: message,
        startedAt,
        finishedAt,
      });

      return {
        status: "failed",
        steps,
        finalOutput: previousOutput,
        error: message,
      };
    }
  }

  return {
    status: "completed",
    steps,
    finalOutput: previousOutput,
  };
};
