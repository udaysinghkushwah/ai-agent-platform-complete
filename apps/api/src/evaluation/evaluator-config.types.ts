/**
 * These types describe the evaluators a run can use. Kept as a single
 * source of truth in this file; apps/worker/src/evaluators/types.ts
 * mirrors it (see the note there for why it's a copy, not an import).
 */
export type EvaluatorConfig =
  | { type: 'SCHEMA_VALID'; schema: Record<string, unknown>; threshold?: number }
  | { type: 'EXACT_MATCH'; field?: string; threshold?: number }
  | { type: 'SEMANTIC_MATCH'; threshold?: number }
  | { type: 'TOOL_SUCCESS'; expectedTools: string[]; threshold?: number }
  | { type: 'LLM_JUDGE'; rubric: string; model?: string; threshold?: number }
  // RAG evaluators expect submittedOutput shaped like
  // { answer: string, retrievedContexts: [{ id, text, score? }] } and the
  // dataset case's expectedOutput/context to carry ground truth — see
  // apps/worker/src/evaluators/rag.ts for the exact contract.
  | { type: 'CONTEXT_RELEVANCE'; threshold?: number }
  | { type: 'GROUNDEDNESS'; threshold?: number }
  | { type: 'RECALL_AT_K'; k: number; threshold?: number }
  | { type: 'RANKING_QUALITY'; threshold?: number };

export const EVALUATOR_TYPES = [
  'SCHEMA_VALID',
  'EXACT_MATCH',
  'SEMANTIC_MATCH',
  'TOOL_SUCCESS',
  'LLM_JUDGE',
  'CONTEXT_RELEVANCE',
  'GROUNDEDNESS',
  'RECALL_AT_K',
  'RANKING_QUALITY',
] as const;
