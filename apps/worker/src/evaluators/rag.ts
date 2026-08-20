import { EvaluatorConfig, EvaluatorInput, EvaluatorResult } from './types';

/**
 * Contract these four evaluators share:
 *
 *   submittedOutput: { answer?: string; retrievedContexts?: RetrievedContext[] }
 *   datasetCase.expectedOutput: string | { answer?: string; relevantContextIds?: string[] }
 *   datasetCase.context:        { relevantContextIds?: string[] } (fallback location)
 *
 * retrievedContexts order is treated as rank order (index 0 = top result)
 * unless a `score` is present, in which case results are re-sorted by score
 * descending first — a customer submitting unordered contexts with scores
 * shouldn't need to pre-sort them.
 *
 * Like SEMANTIC_MATCH, relevance/groundedness here are lexical
 * token-overlap heuristics, not embedding similarity — same reasoning as
 * documented in semantic-match.ts. Swap in an embeddings provider later
 * without changing the EvaluatorConfig/EvaluatorResult contract.
 */

interface RetrievedContext {
  id?: string;
  text?: string;
  score?: number;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean),
  );
}

function overlapFraction(a: Set<string>, b: Set<string>): number {
  if (a.size === 0) return 0;
  let hits = 0;
  for (const token of a) if (b.has(token)) hits++;
  return hits / a.size;
}

function getRetrievedContexts(output: unknown): RetrievedContext[] {
  if (!output || typeof output !== 'object') return [];
  const raw = (output as Record<string, unknown>).retrievedContexts;
  if (!Array.isArray(raw)) return [];
  const contexts = raw.filter((c): c is RetrievedContext => !!c && typeof c === 'object');
  const anyScored = contexts.some((c) => typeof c.score === 'number');
  return anyScored ? [...contexts].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : contexts;
}

function getAnswer(output: unknown): string {
  if (typeof output === 'string') return output;
  if (output && typeof output === 'object') {
    const answer = (output as Record<string, unknown>).answer;
    if (typeof answer === 'string') return answer;
  }
  return '';
}

function getRelevantContextIds(expectedOutput: unknown, context: unknown): string[] | null {
  const fromExpected =
    expectedOutput && typeof expectedOutput === 'object'
      ? (expectedOutput as Record<string, unknown>).relevantContextIds
      : undefined;
  const fromContext =
    context && typeof context === 'object' ? (context as Record<string, unknown>).relevantContextIds : undefined;
  const ids = fromExpected ?? fromContext;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : null;
}

export function runContextRelevance(
  config: Extract<EvaluatorConfig, { type: 'CONTEXT_RELEVANCE' }>,
  { submittedOutput, input }: EvaluatorInput,
): EvaluatorResult {
  const query = typeof input === 'string' ? input : JSON.stringify(input ?? '');
  const queryTokens = tokenize(query);
  const contexts = getRetrievedContexts(submittedOutput);

  if (contexts.length === 0) {
    return { score: 0, passed: false, degraded: false, reasoning: 'No retrievedContexts in submitted output.' };
  }

  const perContextScores = contexts.map((c) => overlapFraction(queryTokens, tokenize(c.text ?? '')));
  const score = perContextScores.reduce((a, b) => a + b, 0) / perContextScores.length;
  const threshold = config.threshold ?? 0.3;

  return {
    score,
    passed: score >= threshold,
    degraded: false,
    reasoning: `Average query/context token overlap ${score.toFixed(2)} across ${contexts.length} contexts (threshold ${threshold}).`,
  };
}

export function runGroundedness(
  config: Extract<EvaluatorConfig, { type: 'GROUNDEDNESS' }>,
  { submittedOutput }: EvaluatorInput,
): EvaluatorResult {
  const answer = getAnswer(submittedOutput);
  const contexts = getRetrievedContexts(submittedOutput);

  if (!answer) {
    return { score: 0, passed: false, degraded: false, reasoning: 'Submitted output has no `answer` string.' };
  }
  if (contexts.length === 0) {
    return { score: 0, passed: false, degraded: false, reasoning: 'No retrievedContexts to ground the answer in.' };
  }

  const answerTokens = tokenize(answer);
  const contextTokens = tokenize(contexts.map((c) => c.text ?? '').join(' '));
  // Containment, not symmetric similarity: groundedness asks "how much of
  // the answer is supported by the retrieved context", not "how similar
  // are they overall".
  const score = overlapFraction(answerTokens, contextTokens);
  const threshold = config.threshold ?? 0.5;

  return {
    score,
    passed: score >= threshold,
    degraded: false,
    reasoning: `${(score * 100).toFixed(0)}% of the answer's tokens appear in retrieved context (threshold ${(threshold * 100).toFixed(0)}%).`,
  };
}

export function runRecallAtK(
  config: Extract<EvaluatorConfig, { type: 'RECALL_AT_K' }>,
  { submittedOutput, expectedOutput, context }: EvaluatorInput,
): EvaluatorResult {
  const relevantIds = getRelevantContextIds(expectedOutput, context);
  if (!relevantIds || relevantIds.length === 0) {
    return {
      score: 0,
      passed: false,
      degraded: false,
      reasoning: 'No ground-truth `relevantContextIds` on this case — cannot compute recall.',
    };
  }

  const retrieved = getRetrievedContexts(submittedOutput)
    .slice(0, config.k)
    .map((c) => c.id)
    .filter((id): id is string => typeof id === 'string');

  const relevantSet = new Set(relevantIds);
  const hits = retrieved.filter((id) => relevantSet.has(id)).length;
  const score = hits / relevantIds.length;
  const threshold = config.threshold ?? 0.5;

  return {
    score,
    passed: score >= threshold,
    degraded: false,
    reasoning: `Recall@${config.k}: found ${hits}/${relevantIds.length} relevant contexts in the top ${config.k} retrieved.`,
  };
}

export function runRankingQuality(
  config: Extract<EvaluatorConfig, { type: 'RANKING_QUALITY' }>,
  { submittedOutput, expectedOutput, context }: EvaluatorInput,
): EvaluatorResult {
  const relevantIds = getRelevantContextIds(expectedOutput, context);
  if (!relevantIds || relevantIds.length === 0) {
    return {
      score: 0,
      passed: false,
      degraded: false,
      reasoning: 'No ground-truth `relevantContextIds` on this case — cannot compute ranking quality.',
    };
  }

  const relevantSet = new Set(relevantIds);
  const retrieved = getRetrievedContexts(submittedOutput);
  const rank = retrieved.findIndex((c) => c.id && relevantSet.has(c.id)) + 1; // 0 if not found
  const score = rank > 0 ? 1 / rank : 0;
  const threshold = config.threshold ?? 0.5;

  return {
    score,
    passed: score >= threshold,
    degraded: false,
    reasoning:
      rank > 0
        ? `First relevant context appeared at rank ${rank} (reciprocal rank ${score.toFixed(2)}).`
        : 'No relevant context appeared anywhere in the retrieved results.',
  };
}

export function runAnswerRelevance(
  config: { type: 'CONTEXT_RELEVANCE' | 'GROUNDEDNESS' | string; threshold?: number },
  { submittedOutput, input }: EvaluatorInput,
): EvaluatorResult {
  const answer = getAnswer(submittedOutput);
  const query = typeof input === 'string' ? input : JSON.stringify(input ?? '');

  if (!answer) {
    return { score: 0, passed: false, degraded: false, reasoning: 'Submitted output has no `answer` string.' };
  }
  if (!query) {
    return { score: 0, passed: false, degraded: false, reasoning: 'Input query is empty.' };
  }

  const queryTokens = tokenize(query);
  const answerTokens = tokenize(answer);

  const score = overlapFraction(queryTokens, answerTokens);
  const threshold = config.threshold ?? 0.3;

  return {
    score,
    passed: score >= threshold,
    degraded: false,
    reasoning: `Answer relevance query token coverage: ${(score * 100).toFixed(0)}% (threshold ${(threshold * 100).toFixed(0)}%).`,
  };
}
