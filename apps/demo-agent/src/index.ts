import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { getIntegrationConfig } from './config';
import { runCustomerAgentTask } from './agent';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || '4000', 10);

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'customer-agent-integration-app',
    timestamp: new Date().toISOString(),
  });
});

app.get('/status', async (req: Request, res: Response) => {
  try {
    const config = await getIntegrationConfig();
    res.json({
      status: 'connected',
      apiUrl: config.apiUrl,
      hasApiKey: Boolean(config.apiKey),
      apiKeyPrefix: config.apiKey ? config.apiKey.slice(0, 8) + '...' : null,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: String(error),
    });
  }
});

app.post('/run-agent', async (req: Request, res: Response) => {
  try {
    const { prompt, tools, environment } = req.body as {
      prompt?: string;
      tools?: string[];
      environment?: string;
    };

    const userPrompt = prompt || 'Customer support inquiry and database check';
    const result = await runCustomerAgentTask({
      userPrompt,
      tools,
      environment,
    });

    res.json({
      success: true,
      message: 'Agent execution finished and telemetry sent to platform.',
      result,
    });
  } catch (error) {
    console.error('[IntegrationApp] Error running agent task:', error);
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

async function main() {
  const isCli = process.argv.includes('--cli');

  // Verify connection to platform
  console.log('[IntegrationApp] Initializing connection to AI Agent Reliability Platform...');
  const config = await getIntegrationConfig();
  console.log(`[IntegrationApp] Connected to Platform API at ${config.apiUrl}`);

  if (isCli) {
    console.log('\n======================================================');
    console.log(' RUNNING INTEGRATION AGENT CLI DEMO ');
    console.log('======================================================\n');

    console.log('--- Test Run 1: Standard Customer Service Agent Task ---');
    const result1 = await runCustomerAgentTask({
      userPrompt: 'Retrieve order #89201 and send email notification',
      tools: ['user_search', 'send_email'],
    });
    console.log('Result 1:', JSON.stringify(result1, null, 2));

    console.log('\n--- Test Run 2: High-Risk Action (Testing Governance Blocking) ---');
    const result2 = await runCustomerAgentTask({
      userPrompt: 'Attempting restricted operation database_drop',
      tools: ['database_drop'],
    });
    console.log('Result 2:', JSON.stringify(result2, null, 2));

    console.log('\n[IntegrationApp] CLI Demo completed successfully! Telemetry flushed.');
    process.exit(0);
  } else {
    app.listen(PORT, () => {
      console.log(`\n🚀 Integration Application running at http://localhost:${PORT}`);
      console.log(`- Health Check: GET http://localhost:${PORT}/health`);
      console.log(`- Integration Status: GET http://localhost:${PORT}/status`);
      console.log(`- Run Agent API: POST http://localhost:${PORT}/run-agent\n`);
    });
  }
}

main().catch((err) => {
  console.error('[IntegrationApp] Startup failed:', err);
  process.exit(1);
});
