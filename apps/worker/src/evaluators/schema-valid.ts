import Ajv from 'ajv';
import { EvaluatorConfig, EvaluatorInput, EvaluatorResult } from './types';

const ajv = new Ajv({ allErrors: true, strict: false });

export function runSchemaValid(
  config: Extract<EvaluatorConfig, { type: 'SCHEMA_VALID' }>,
  { submittedOutput }: EvaluatorInput,
): EvaluatorResult {
  try {
    const validate = ajv.compile(config.schema);
    const valid = validate(submittedOutput);
    const passed = !!valid;
    return {
      score: passed ? 1 : 0,
      passed,
      degraded: false,
      reasoning: passed
        ? undefined
        : `Schema validation failed: ${ajv.errorsText(validate.errors, { separator: '; ' })}`,
    };
  } catch (err) {
    // A malformed schema in the evaluator config is a config error, not a
    // provider outage — still not "degraded" (that's reserved for external
    // service failures), but we shouldn't let a bad schema crash the run.
    return {
      score: 0,
      passed: false,
      degraded: false,
      reasoning: `Invalid JSON schema in evaluator config: ${(err as Error).message}`,
    };
  }
}
