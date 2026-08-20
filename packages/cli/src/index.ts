import { Command } from 'commander';

const program = new Command();

program
  .name('aap')
  .description('AI Agent Platform CLI — CI/CD Prompt Regression & Evaluation Gating')
  .version('0.1.0');

program
  .command('eval')
  .description('Run CI/CD prompt regression gate check comparing candidate run to baseline')
  .option('-u, --api-url <url>', 'Platform API Base URL', process.env.AAP_API_URL || 'http://localhost:3000')
  .option('-k, --api-key <key>', 'Platform API Key or JWT token', process.env.AAP_API_KEY)
  .option('-p, --project <projectId>', 'Target Project ID', process.env.AAP_PROJECT_ID)
  .option('-b, --baseline <runId>', 'Baseline Evaluation Run ID')
  .option('-c, --candidate <runId>', 'Candidate Evaluation Run ID')
  .option('-t, --threshold <maxDrop>', 'Maximum allowed pass-rate drop percentage (e.g. 0.05)', '0.05')
  .action(async (options) => {
    const apiUrl = options.apiUrl.replace(/\/$/, '');
    const apiKey = options.apiKey;
    const projectId = options.project;
    const baselineRunId = options.baseline;
    const candidateRunId = options.candidate;

    if (!projectId || !baselineRunId || !candidateRunId) {
      console.error('\x1b[31m[ERROR] Missing required flags: --project, --baseline, --candidate\x1b[0m');
      process.exit(1);
    }

    console.log('\x1b[36m=========================================================\x1b[0m');
    console.log('\x1b[1m🚀 AI Agent Platform — CI/CD Prompt Regression Gate\x1b[0m');
    console.log('\x1b[36m=========================================================\x1b[0m');
    console.log(`Project ID:   ${projectId}`);
    console.log(`Baseline Run: ${baselineRunId}`);
    console.log(`Candidate Run:${candidateRunId}`);
    console.log(`Max Drop:     ${Number(options.threshold) * 100}%\n`);

    try {
      // 1. Authenticate if no API key supplied (dev auto-login)
      let authHeader = apiKey ? `Bearer ${apiKey}` : '';
      if (!authHeader) {
        const loginRes = await fetch(`${apiUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'dev@example.com', password: 'devpassword123' }),
        });
        if (loginRes.ok) {
          const loginData = (await loginRes.json()) as { accessToken: string };
          authHeader = `Bearer ${loginData.accessToken}`;
        }
      }

      // 2. Perform regression check via Platform API
      const res = await fetch(`${apiUrl}/projects/${projectId}/regression-checks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          baselineRunId,
          candidateRunId,
        }),
      });

      if (!res.ok) {
        console.error(`\x1b[31m[ERROR] Regression check failed with status ${res.status}: ${await res.text()}\x1b[0m`);
        process.exit(1);
      }

      const data = (await res.json()) as {
        verdict: 'PASS' | 'WARN' | 'FAIL';
        baselinePassRate?: number;
        candidatePassRate?: number;
        passRateDelta?: number;
        reasoning: string;
      };

      const baselineScore = data.baselinePassRate !== undefined ? `${(data.baselinePassRate * 100).toFixed(1)}%` : 'N/A';
      const candidateScore = data.candidatePassRate !== undefined ? `${(data.candidatePassRate * 100).toFixed(1)}%` : 'N/A';
      const deltaText = data.passRateDelta !== undefined ? `${(data.passRateDelta * 100).toFixed(1)}%` : 'N/A';

      console.log(`Baseline Pass Rate:  ${baselineScore}`);
      console.log(`Candidate Pass Rate: ${candidateScore}`);
      console.log(`Pass Rate Delta:     ${deltaText}\n`);
      console.log(`Verdict Reasoning:   ${data.reasoning}\n`);

      if (data.verdict === 'PASS') {
        console.log('\x1b[32m[PASS] SUCCESS: Prompt regression gate passed! Deployment approved.\x1b[0m');
        process.exit(0);
      } else if (data.verdict === 'WARN') {
        console.log('\x1b[33m[WARN] WARNING: Minor score drop detected, within tolerance.\x1b[0m');
        process.exit(0);
      } else {
        console.error('\x1b[31m[FAIL] FAILED: Prompt regression detected! Blocking CI/CD pipeline deployment.\x1b[0m');
        process.exit(1);
      }
    } catch (err: any) {
      console.error(`\x1b[31m[ERROR] CLI execution failed: ${err?.message || err}\x1b[0m`);
      process.exit(1);
    }
  });

program.parse(process.argv);
