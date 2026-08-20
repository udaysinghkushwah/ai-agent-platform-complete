import { EvaluatorConfig, EvaluatorInput, EvaluatorResult } from './types';

/**
 * IMPORTANT — this is a deliberate MVP-3 simplification, not a finished
 * semantic evaluator. Real semantic similarity needs an embedding model,
 * and this platform shouldn't make an unannounced network call to a
 * third-party embedding API as part of a "deterministic" evaluator without
 * the customer explicitly configuring a provider (same reasoning that keeps
 * LLM_JUDGE as an explicit, separate evaluator type).
 *
 * This computes Jaccard similarity over lowercased word sets — a real, fully
 * local, deterministic signal, just a weaker one than embeddings. When you
 * want real semantic matching, add an embeddings provider (e.g. OpenAI
 * text-embedding-3-small or a local model) and swap this function's body;
 * the EvaluatorConfig/EvaluatorResult contract doesn't need to change.
 */
function tokenize(value: unknown): Set<string> {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function runSemanticMatch(
  config: Extract<EvaluatorConfig, { type: 'SEMANTIC_MATCH' }>,
  { submittedOutput, expectedOutput }: EvaluatorInput,
): EvaluatorResult {
  const threshold = config.threshold ?? 0.5;
  const score = jaccardSimilarity(tokenize(submittedOutput), tokenize(expectedOutput));
  const passed = score >= threshold;

  return {
    score,
    passed,
    degraded: false,
    reasoning: `Token-overlap similarity ${score.toFixed(2)} (threshold ${threshold}). This is a lexical heuristic, not embedding-based semantic similarity — treat borderline scores with caution.`,
  };
}
