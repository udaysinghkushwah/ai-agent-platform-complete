import { getIntegrationConfig } from './config';
import { checkToolPolicy } from './policy';

export interface AgentRunOptions {
  userPrompt: string;
  tools?: string[];
  environment?: string;
}

export interface AgentRunResult {
  traceId: string;
  userPrompt: string;
  response: string;
  executedTools: Array<{
    name: string;
    policyDecision: string;
    executed: boolean;
    result?: unknown;
    blockedReason?: string;
  }>;
  totalTokens: number;
  estimatedCostUSD: number;
  durationMs: number;
}

export async function runCustomerAgentTask(options: AgentRunOptions): Promise<AgentRunResult> {
  const startTime = Date.now();
  const config = await getIntegrationConfig();
  const env = options.environment || 'production';

  // 1. Start Telemetry Trace
  const trace = config.client.startTrace({
    agentId: 'enterprise-customer-agent',
    agentVersion: 'v2.1.0',
    environment: env,
  });

  console.log(`[Agent] Started trace: ${trace.traceId} for prompt: "${options.userPrompt}"`);

  // 2. LLM Step: Prompt Analysis & Plan Generation
  const planSpan = trace.startSpan({
    eventType: 'llm',
    name: 'generate-execution-plan',
    provider: 'openai',
    model: 'gpt-4o',
  });

  // Simulate LLM inference delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  const requestedTools = options.tools && options.tools.length > 0
    ? options.tools
    : options.userPrompt.toLowerCase().includes('delete') || options.userPrompt.toLowerCase().includes('drop')
    ? ['database_drop', 'user_search']
    : ['user_search', 'send_email'];

  planSpan.end({
    status: 'ok',
    metadata: {
      inputPrompt: options.userPrompt,
      plan: `Plan generated to execute tools: ${requestedTools.join(', ')}`,
    },
    inputTokens: 145,
    outputTokens: 68,
    cost: 0.0032,
  });

  const executedToolsSummary: AgentRunResult['executedTools'] = [];
  let totalInputTokens = 145;
  let totalOutputTokens = 68;
  let totalCost = 0.0032;

  // 3. Tool Execution & Policy Check Loop
  for (const toolName of requestedTools) {
    // Governance Policy Check before tool execution
    const policyCheck = await checkToolPolicy(config.apiUrl, config.apiKey, toolName, env, {
      prompt: options.userPrompt,
    });

    const toolSpan = trace.startSpan({
      eventType: 'tool',
      name: `execute-tool-${toolName}`,
    });

    if (policyCheck.decision === 'REQUIRES_APPROVAL') {
      console.warn(`[Agent] Tool "${toolName}" REQUIRES HUMAN APPROVAL (Approval ID: ${policyCheck.approvalId || 'pending'}). PENDING sign-off in Dashboard...`);

      toolSpan.end({
        status: 'error',
        errorMessage: `Tool execution paused: Requires Human Approval (${policyCheck.approvalId || 'pending'})`,
        metadata: { toolName, environment: env, policyDecision: policyCheck.decision, approvalId: policyCheck.approvalId },
      });

      executedToolsSummary.push({
        name: toolName,
        policyDecision: policyCheck.decision,
        executed: false,
        blockedReason: `Paused for Human-in-the-loop (HITL) Approval (ID: ${policyCheck.approvalId || 'pending'})`,
      });
    } else if (!policyCheck.allowed || policyCheck.decision === 'BLOCKED') {
      console.warn(`[Agent] Tool "${toolName}" was BLOCKED by governance policy: ${policyCheck.reason || 'Blocked policy rule'}`);

      toolSpan.end({
        status: 'error',
        errorMessage: `Tool execution blocked by Governance Policy (${policyCheck.policyId || 'SecurityPolicy'})`,
        metadata: { toolName, environment: env, policyDecision: policyCheck.decision, policyCheck },
      });

      executedToolsSummary.push({
        name: toolName,
        policyDecision: policyCheck.decision,
        executed: false,
        blockedReason: policyCheck.reason || `Blocked by governance policy (${policyCheck.policyId || 'SecurityPolicy'})`,
      });
    } else {
      console.log(`[Agent] Tool "${toolName}" PASSED governance policy check. Executing...`);

      // Simulate successful tool execution
      await new Promise((resolve) => setTimeout(resolve, 200));

      const mockToolOutput = {
        success: true,
        data: `Mock result for ${toolName}`,
        timestamp: new Date().toISOString(),
      };

      toolSpan.end({
        status: 'ok',
        metadata: { toolName, environment: env, policyDecision: policyCheck.decision, output: mockToolOutput },
      });

      executedToolsSummary.push({
        name: toolName,
        policyDecision: policyCheck.decision,
        executed: true,
        result: mockToolOutput,
      });
    }
  }

  // 4. Final Synthesize Response Step
  const synthSpan = trace.startSpan({
    eventType: 'llm',
    name: 'synthesize-final-answer',
    provider: 'openai',
    model: 'gpt-4o',
  });

  await new Promise((resolve) => setTimeout(resolve, 250));

  totalInputTokens += 210;
  totalOutputTokens += 120;
  totalCost += 0.0048;

  const finalResponseText = `Completed task for prompt "${options.userPrompt}". Executed ${
    executedToolsSummary.filter((t) => t.executed).length
  } of ${requestedTools.length} tools.`;

  synthSpan.end({
    status: 'ok',
    metadata: { text: finalResponseText },
    inputTokens: 210,
    outputTokens: 120,
    cost: 0.0048,
  });

  const durationMs = Date.now() - startTime;

  // Flush SDK telemetry queue to platform
  await config.client.flush();

  return {
    traceId: trace.traceId,
    userPrompt: options.userPrompt,
    response: finalResponseText,
    executedTools: executedToolsSummary,
    totalTokens: totalInputTokens + totalOutputTokens,
    estimatedCostUSD: totalCost,
    durationMs,
  };
}
