/**
 * Mirrors apps/api/src/evaluation/evaluator-config.types.ts. Duplicated
 * rather than imported across the api/worker package boundary — same
 * tradeoff already made for the ingestion event envelope (see
 * apps/worker/src/types.ts). If this drifts out of sync with the API's
 * copy, add a packages/shared workspace package and import both from
 * there; not worth the build-tooling overhead at this scale yet.
 */
export type EvaluatorConfig =
  | { type: 'SCHEMA_VALID'; schema: Record<string, unknown>; threshold?: number }
  | { type: 'EXACT_MATCH'; field?: string; threshold?: number }
  | { type: 'SEMANTIC_MATCH'; threshold?: number }
  | { type: 'TOOL_SUCCESS'; expectedTools: string[]; threshold?: number }
  | { type: 'LLM_JUDGE'; rubric: string; model?: string; threshold?: number }
  | { type: 'CONTEXT_RELEVANCE'; threshold?: number }
  | { type: 'GROUNDEDNESS'; threshold?: number }
  | { type: 'RECALL_AT_K'; k: number; threshold?: number }
  | { type: 'RANKING_QUALITY'; threshold?: number };

export interface EvaluatorResult {
  score: number | null; // null only when degraded
  passed: boolean;
  degraded: boolean;
  reasoning?: string;
  judgeModel?: string;
}

export interface EvaluatorInput {
  submittedOutput: unknown;
  expectedOutput: unknown;
  input: unknown;
  context: unknown;
}
