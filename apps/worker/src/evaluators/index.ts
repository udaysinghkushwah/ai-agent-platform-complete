import { EvaluatorConfig, EvaluatorInput, EvaluatorResult } from './types';
import { runSchemaValid } from './schema-valid';
import { runExactMatch } from './exact-match';
import { runSemanticMatch } from './semantic-match';
import { runToolSuccess } from './tool-success';
import { runLlmJudge } from './llm-judge';
import { runContextRelevance, runGroundedness, runRecallAtK, runRankingQuality } from './rag';

export async function runEvaluator(
  config: EvaluatorConfig,
  input: EvaluatorInput,
): Promise<EvaluatorResult> {
  switch (config.type) {
    case 'SCHEMA_VALID':
      return runSchemaValid(config, input);
    case 'EXACT_MATCH':
      return runExactMatch(config, input);
    case 'SEMANTIC_MATCH':
      return runSemanticMatch(config, input);
    case 'TOOL_SUCCESS':
      return runToolSuccess(config, input);
    case 'LLM_JUDGE':
      return runLlmJudge(config, input);
    case 'CONTEXT_RELEVANCE':
      return runContextRelevance(config, input);
    case 'GROUNDEDNESS':
      return runGroundedness(config, input);
    case 'RECALL_AT_K':
      return runRecallAtK(config, input);
    case 'RANKING_QUALITY':
      return runRankingQuality(config, input);
    default: {
      // Exhaustiveness check — if a new EvaluatorType is added to the enum
      // without a case here, this is a compile error, not a silent runtime
      // no-op.
      const _exhaustive: never = config;
      throw new Error(`Unknown evaluator type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
