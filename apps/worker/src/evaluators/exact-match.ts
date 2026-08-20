import { EvaluatorConfig, EvaluatorInput, EvaluatorResult } from './types';

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj).sort();
    const bKeys = Object.keys(bObj).sort();
    if (aKeys.length !== bKeys.length || aKeys.some((k, i) => k !== bKeys[i])) return false;
    return aKeys.every((k) => deepEqual(aObj[k], bObj[k]));
  }

  return false;
}

function getField(value: unknown, field?: string): unknown {
  if (!field) return value;
  return field.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, value);
}

export function runExactMatch(
  config: Extract<EvaluatorConfig, { type: 'EXACT_MATCH' }>,
  { submittedOutput, expectedOutput }: EvaluatorInput,
): EvaluatorResult {
  const actual = getField(submittedOutput, config.field);
  const expected = getField(expectedOutput, config.field);
  const passed = deepEqual(actual, expected);

  return {
    score: passed ? 1 : 0,
    passed,
    degraded: false,
    reasoning: passed
      ? undefined
      : `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  };
}
