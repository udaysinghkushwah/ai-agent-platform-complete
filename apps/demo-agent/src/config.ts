import { createClient, AapClient } from '@aap/sdk-node';
import dotenv from 'dotenv';

dotenv.config();

export interface IntegrationConfig {
  apiUrl: string;
  apiKey: string;
  client: AapClient;
}

let cachedConfig: IntegrationConfig | null = null;

export async function getIntegrationConfig(): Promise<IntegrationConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const apiUrl = process.env.AAP_API_URL || 'http://localhost:3000';
  let apiKey = process.env.AAP_API_KEY || '';

  if (!apiKey) {
    console.log('[IntegrationApp] No AAP_API_KEY set. Authenticating with platform API to obtain an API key...');
    try {
      // 1. Login to get JWT
      const email = process.env.AAP_EMAIL || 'dev@example.com';
      const password = process.env.AAP_PASSWORD || 'devpassword123';

      const loginRes = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!loginRes.ok) {
        throw new Error(`Login failed with status ${loginRes.status}: ${await loginRes.text()}`);
      }

      const loginData = (await loginRes.json()) as { accessToken: string };
      const jwtToken = loginData.accessToken;

      // 2. Get Orgs and Projects
      const orgsRes = await fetch(`${apiUrl}/organizations`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const orgs = (await orgsRes.json()) as Array<{ id: string; name: string }>;

      if (!orgs || orgs.length === 0) {
        throw new Error('No organization found for demo user.');
      }

      const orgId = orgs[0].id;

      const projectsRes = await fetch(`${apiUrl}/organizations/${orgId}/projects`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const projects = (await projectsRes.json()) as Array<{ id: string; name: string }>;

      if (!projects || projects.length === 0) {
        throw new Error('No project found for demo organization.');
      }

      const projectId = projects[0].id;

      // 3. Issue API Key
      const keyRes = await fetch(`${apiUrl}/projects/${projectId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({ name: `integration-agent-${Date.now()}` }),
      });

      if (!keyRes.ok) {
        throw new Error(`Failed to issue API key: ${await keyRes.text()}`);
      }

      const keyData = (await keyRes.json()) as { key: string };
      apiKey = keyData.key;
      console.log('[IntegrationApp] Successfully generated temporary API key from platform for integration demo.');

      // 4. Ensure a Governance Policy exists to block dangerous tools for testing
      try {
        await fetch(`${apiUrl}/projects/${projectId}/governance-policies`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwtToken}`,
          },
          body: JSON.stringify({
            name: `Demo HITL Security Governance Policy ${Date.now()}`,
            blockedTools: ['database_drop', 'truncate_table', 'delete_all_users'],
            requireApprovalTools: ['send_wire_transfer', 'transfer_funds'],
          }),
        });
        console.log('[IntegrationApp] Configured Governance Policy: Blocking database_drop and requiring approval for send_wire_transfer, transfer_funds');
      } catch (err) {
        console.warn('[IntegrationApp] Policy setup warning:', err);
      }
    } catch (error) {
      console.error('[IntegrationApp] Error setting up API key from platform:', error);
      throw error;
    }
  }

  const client = createClient({
    apiKey,
    baseUrl: apiUrl,
    flushIntervalMs: 2000,
    batchSize: 5,
  });

  cachedConfig = {
    apiUrl,
    apiKey,
    client,
  };

  return cachedConfig;
}
