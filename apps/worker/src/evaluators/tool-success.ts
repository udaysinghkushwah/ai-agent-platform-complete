import { EvaluatorConfig, EvaluatorInput, EvaluatorResult } from './types';

interface ToolCallShape {
  name: string;
  status?: string;
}

function extractToolCalls(output: unknown): ToolCallShape[] | null {
  if (!output || typeof output !== 'object') return null;
  const toolCalls = (output as Record<string, unknown>).toolCalls;
  if (!Array.isArray(toolCalls)) return null;
  return toolCalls.filter(
    (t): t is ToolCallShape => !!t && typeof t === 'object' && typeof (t as any).name === 'string',
  );
}

const SUCCESS_STATUSES = new Set(['success', 'ok', 'completed']);

export function runToolSuccess(
  config: Extract<EvaluatorConfig, { type: 'TOOL_SUCCESS' }>,
  { submittedOutput }: EvaluatorInput,
): EvaluatorResult {
  const toolCalls = extractToolCalls(submittedOutput);

  if (toolCalls === null) {
    return {
      score: 0,
      passed: false,
      degraded: false,
      reasoning:
        'Submitted output has no `toolCalls` array — expected shape is { toolCalls: [{ name, status }] }.',
    };
  }

  const missing: string[] = [];
  const failed: string[] = [];
  for (const expectedName of config.expectedTools) {
    const call = toolCalls.find((t) => t.name === expectedName);
    if (!call) {
      missing.push(expectedName);
    } else if (call.status && !SUCCESS_STATUSES.has(call.status.toLowerCase())) {
      failed.push(expectedName);
    }
  }

  const passed = missing.length === 0 && failed.length === 0;
  const total = config.expectedTools.length;
  const succeeded = total - missing.length - failed.length;

  return {
    score: total === 0 ? 1 : succeeded / total,
    passed,
    degraded: false,
    reasoning: passed
      ? undefined
      : [
          missing.length ? `Missing tool calls: ${missing.join(', ')}` : null,
          failed.length ? `Tool calls that didn't succeed: ${failed.join(', ')}` : null,
        ]
          .filter(Boolean)
          .join('. '),
  };
}
