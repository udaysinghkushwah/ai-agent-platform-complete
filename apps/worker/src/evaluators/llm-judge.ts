import { EvaluatorConfig, EvaluatorInput, EvaluatorResult } from './types';

const DEFAULT_BASE_URL = process.env.LLM_JUDGE_BASE_URL ?? 'https://api.openai.com/v1';
const DEFAULT_MODEL = process.env.LLM_JUDGE_MODEL ?? 'gpt-4o-mini';
const API_KEY = process.env.LLM_JUDGE_API_KEY;
const TIMEOUT_MS = Number(process.env.LLM_JUDGE_TIMEOUT_MS ?? 20_000);

const JUDGE_SYSTEM_PROMPT = `You are an evaluator scoring an AI agent's output against a rubric.
Respond with ONLY a JSON object, no markdown fences, no other text:
{"score": <number 0.0-1.0>, "passed": <boolean>, "reasoning": "<one or two sentences>"}`;

function buildUserPrompt(rubric: string, input: unknown, expectedOutput: unknown, submittedOutput: unknown) {
  return [
    `Rubric:\n${rubric}`,
    `Input:\n${JSON.stringify(input, null, 2)}`,
    expectedOutput !== undefined ? `Reference/expected output:\n${JSON.stringify(expectedOutput, null, 2)}` : null,
    `Output to evaluate:\n${JSON.stringify(submittedOutput, null, 2)}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function parseJudgeResponse(raw: string): { score: number; passed: boolean; reasoning: string } | null {
  // Judges sometimes wrap JSON in markdown fences despite instructions —
  // strip those before parsing rather than failing the whole evaluation.
  const cleaned = raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.score !== 'number' || typeof parsed.passed !== 'boolean') return null;
    return {
      score: Math.max(0, Math.min(1, parsed.score)),
      passed: parsed.passed,
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
  } catch {
    return null;
  }
}

export async function runLlmJudge(
  config: Extract<EvaluatorConfig, { type: 'LLM_JUDGE' }>,
  { submittedOutput, expectedOutput, input }: EvaluatorInput,
): Promise<EvaluatorResult> {
  if (!API_KEY) {
    return {
      score: null,
      passed: false,
      degraded: true,
      reasoning: 'LLM_JUDGE_API_KEY is not configured — this evaluator was skipped, not failed.',
    };
  }

  const model = config.model ?? DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${DEFAULT_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: 'system', content: JUDGE_SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(config.rubric, input, expectedOutput, submittedOutput) },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        score: null,
        passed: false,
        degraded: true,
        reasoning: `Judge model call failed (${res.status}): ${body.slice(0, 300)}`,
        judgeModel: model,
      };
    }

    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    const parsed = content ? parseJudgeResponse(content) : null;

    if (!parsed) {
      return {
        score: null,
        passed: false,
        degraded: true,
        reasoning: 'Judge model response could not be parsed as the expected JSON shape.',
        judgeModel: model,
      };
    }

    const threshold = config.threshold ?? 0.7;
    return {
      score: parsed.score,
      passed: parsed.passed && parsed.score >= threshold,
      degraded: false,
      reasoning: parsed.reasoning,
      judgeModel: model,
    };
  } catch (err) {
    const aborted = (err as Error).name === 'AbortError';
    return {
      score: null,
      passed: false,
      degraded: true,
      reasoning: aborted
        ? `Judge model call timed out after ${TIMEOUT_MS}ms.`
        : `Judge model call errored: ${(err as Error).message}`,
      judgeModel: model,
    };
  } finally {
    clearTimeout(timeout);
  }
}
