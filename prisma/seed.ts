import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed with realistic demo platform data...');

  const passwordHash = await bcrypt.hash('devpassword123', 12);

  // 1. User
  const user = await prisma.user.upsert({
    where: { email: 'dev@example.com' },
    update: { name: 'Alex Rivera (Dev Lead)' },
    create: {
      email: 'dev@example.com',
      passwordHash,
      name: 'Alex Rivera (Dev Lead)',
    },
  });

  // 2. Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    update: { name: 'Acme AI Enterprise' },
    create: {
      name: 'Acme AI Enterprise',
      slug: 'demo-org',
      plan: 'enterprise',
      members: {
        create: { userId: user.id, role: 'OWNER' },
      },
    },
  });

  // 3. Projects
  const projectProd = await prisma.project.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'demo-project' } },
    update: { name: 'Customer Support AI Agent', environment: 'production' },
    create: {
      organizationId: org.id,
      name: 'Customer Support AI Agent',
      slug: 'demo-project',
      environment: 'production',
      sensitiveFieldMasks: ['ssn', 'credit_card', 'auth_token'],
    },
  });

  const projectStaging = await prisma.project.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'finance-agent' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Financial Auditor Agent',
      slug: 'finance-agent',
      environment: 'staging',
    },
  });

  // 4. ApiKey
  const apiKeyHash = await bcrypt.hash('aap_pk_demo_secret_12345', 10);
  await prisma.apiKey.create({
    data: {
      projectId: projectProd.id,
      name: 'Production Server Key',
      keyPrefix: 'aap_pk_live',
      keyHash: apiKeyHash,
      scopes: ['traces:write', 'policy:check', 'evals:read'],
    },
  }).catch(() => {});

  // 5. Governance Policy
  const govPolicy = await prisma.governancePolicy.upsert({
    where: { projectId_name: { projectId: projectProd.id, name: 'Production Tool Guardrails' } },
    update: {},
    create: {
      organizationId: org.id,
      projectId: projectProd.id,
      name: 'Production Tool Guardrails',
      blockedTools: ['database_drop', 'raw_sql_execution', 'wipe_user_accounts'],
      requireApprovalTools: ['send_wire_transfer', 'delete_user_data', 'export_pii_csv'],
      restrictedEnvironments: ['production', 'staging'],
      status: 'ACTIVE',
    },
  });

  // 6. Pending HITL Approval
  await prisma.pendingApproval.create({
    data: {
      organizationId: org.id,
      projectId: projectProd.id,
      traceId: 'tr_demo_wire_transfer_9942',
      toolName: 'send_wire_transfer',
      environment: 'production',
      parameters: {
        recipient_account: 'ACC-982410-US',
        amount_usd: 12500,
        currency: 'USD',
        memo: 'Supplier Invoice #8841',
      },
      status: 'PENDING',
      reason: 'Requires human sign-off for financial transactions exceeding $5,000 threshold.',
    },
  }).catch(() => {});

  // 7. Prompts & Prompt Versions
  const supportPrompt = await prisma.prompt.upsert({
    where: { projectId_name: { projectId: projectProd.id, name: 'Customer Support Persona' } },
    update: {},
    create: {
      organizationId: org.id,
      projectId: projectProd.id,
      name: 'Customer Support Persona',
    },
  });

  await prisma.promptVersion.upsert({
    where: { promptId_version: { promptId: supportPrompt.id, version: 1 } },
    update: {},
    create: {
      promptId: supportPrompt.id,
      version: 1,
      content: 'You are an empathetic customer service AI. Answer user queries regarding order tracking accurately.',
      status: 'APPROVED',
    },
  });

  // 8. Traces & Spans (Generate 20 realistic telemetry traces)
  const models = ['gpt-4o', 'claude-3-5-sonnet', 'llama-3-70b'];
  const userPrompts = [
    'Where is my shipment order #88412?',
    'I want to process a return for damaged goods.',
    'Can you help me cancel my subscription auto-renewal?',
    'Transfer $12,500 to vendor account ACC-982410-US',
    'Summarize patient health record PAT-491',
    'Drop database table pii_customers',
  ];

  for (let i = 0; i < 20; i++) {
    const traceId = `tr_live_demo_${Date.now()}_${i}`;
    const selectedModel = models[i % models.length];
    const promptText = userPrompts[i % userPrompts.length];
    const isError = promptText.includes('Drop database');
    const inputTokens = Math.floor(120 + Math.random() * 200);
    const outputTokens = Math.floor(50 + Math.random() * 150);
    const cost = (inputTokens * 0.00001 + outputTokens * 0.00003);

    const trace = await prisma.trace.create({
      data: {
        organizationId: org.id,
        projectId: projectProd.id,
        traceId,
        agentId: 'customer-support-agent',
        agentVersion: 'v2.1.0',
        environment: 'production',
        status: isError ? 'error' : 'ok',
        startedAt: new Date(Date.now() - (20 - i) * 60000 * 15),
        endedAt: new Date(Date.now() - (20 - i) * 60000 * 15 + 240),
        durationMs: Math.floor(120 + Math.random() * 280),
        totalInputTokens: inputTokens,
        totalOutputTokens: outputTokens,
        totalCost: cost,
      },
    });

    // LLM Span
    await prisma.span.create({
      data: {
        traceDbId: trace.id,
        organizationId: org.id,
        projectId: projectProd.id,
        spanId: `span_llm_${i}`,
        eventId: `ev_llm_${uuidv4()}`,
        eventType: 'llm',
        name: 'llm_inference',
        provider: selectedModel.startsWith('gpt') ? 'openai' : selectedModel.startsWith('claude') ? 'anthropic' : 'meta',
        model: selectedModel,
        status: 'ok',
        startedAt: trace.startedAt,
        durationMs: Math.floor(100 + Math.random() * 150),
        inputTokens,
        outputTokens,
        cost,
        metadata: { prompt: promptText },
      },
    });

    // Tool Span
    if (i % 3 === 0) {
      await prisma.span.create({
        data: {
          traceDbId: trace.id,
          organizationId: org.id,
          projectId: projectProd.id,
          spanId: `span_tool_${i}`,
          eventId: `ev_tool_${uuidv4()}`,
          eventType: 'tool',
          name: isError ? 'database_drop' : 'fetch_order_status',
          status: isError ? 'error' : 'ok',
          errorMessage: isError ? 'Execution blocked by Governance Policy Rule "Production Tool Guardrails"' : undefined,
          startedAt: new Date(trace.startedAt.getTime() + 100),
          durationMs: Math.floor(40 + Math.random() * 80),
          metadata: { toolName: isError ? 'database_drop' : 'fetch_order_status' },
        },
      });
    }
  }

  // 9. Dataset & Evaluation Benchmark Run
  const dataset = await prisma.dataset.upsert({
    where: { projectId_name: { projectId: projectProd.id, name: 'Support RAG Quality Benchmark' } },
    update: {},
    create: {
      organizationId: org.id,
      projectId: projectProd.id,
      name: 'Support RAG Quality Benchmark',
      description: 'Golden set for evaluating agent groundedness & accuracy on customer order issues.',
    },
  });

  const datasetCase = await prisma.datasetCase.create({
    data: {
      datasetId: dataset.id,
      caseKey: 'case-order-tracking-01',
      input: { prompt: 'Where is order #88412?' },
      expectedOutput: { response: 'Order #88412 was dispatched via FedEx (Tracking #FX-99214).' },
      tags: ['tracking', 'order'],
    },
  }).catch(() => {});

  if (datasetCase) {
    const evalRun = await prisma.evaluationRun.create({
      data: {
        organizationId: org.id,
        projectId: projectProd.id,
        datasetId: dataset.id,
        name: 'GPT-4o vs Claude 3.5 Sonnet Benchmark',
        agentId: 'customer-support-agent',
        agentVersion: 'v2.1.0',
        evaluatorConfig: [
          { type: 'GROUNDEDNESS', threshold: 0.8 },
          { type: 'EXACT_MATCH', threshold: 1.0 },
        ],
        status: 'COMPLETED',
        verdict: 'PASS',
        overallScore: 0.96,
        passRate: 0.95,
        totalCases: 20,
        completedCases: 20,
        degradedCases: 0,
        startedAt: new Date(Date.now() - 3600000),
        completedAt: new Date(Date.now() - 3500000),
      },
    });

    await prisma.evaluationResult.create({
      data: {
        evaluationRunId: evalRun.id,
        datasetCaseId: datasetCase.id,
        evaluatorType: 'GROUNDEDNESS',
        score: 0.98,
        passed: true,
        reasoning: 'Response strictly answers based on context without hallucination.',
        judgeModel: 'gpt-4o',
      },
    });
  }

  // 10. Alert Rule & Alert Event
  const alertRule = await prisma.alertRule.upsert({
    where: { projectId_name: { projectId: projectProd.id, name: 'High Error Rate Breach' } },
    update: {},
    create: {
      organizationId: org.id,
      projectId: projectProd.id,
      name: 'High Error Rate Breach',
      metric: 'ERROR_RATE',
      comparator: 'GT',
      threshold: 0.05,
      windowMinutes: 15,
      cooldownMinutes: 30,
      notifyEmails: ['dev@example.com'],
      status: 'ACTIVE',
    },
  });

  await prisma.alertEvent.create({
    data: {
      alertRuleId: alertRule.id,
      organizationId: org.id,
      projectId: projectProd.id,
      metricValue: 0.082,
      threshold: 0.05,
      message: 'Error rate spiked to 8.2% in last 15 minutes due to governance policy blocked queries.',
      status: 'OPEN',
      triggeredAt: new Date(Date.now() - 900000),
    },
  }).catch(() => {});

  // 11. Audit Events
  await prisma.auditEvent.createMany({
    data: [
      {
        organizationId: org.id,
        projectId: projectProd.id,
        actorType: 'user',
        actorId: user.id,
        action: 'governance_policy.updated',
        resourceType: 'GovernancePolicy',
        resourceId: govPolicy.id,
        metadata: { updatedRules: ['requireApprovalTools'] },
      },
      {
        organizationId: org.id,
        projectId: projectProd.id,
        actorType: 'api_key',
        actorId: 'aap_pk_live',
        action: 'policy_check.intercepted',
        resourceType: 'PendingApproval',
        resourceId: 'tr_demo_wire_transfer_9942',
        metadata: { toolName: 'send_wire_transfer', amountUSD: 12500 },
      },
    ],
  }).catch(() => {});

  console.log('✅ Demo platform data seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
