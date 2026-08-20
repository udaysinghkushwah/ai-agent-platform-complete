import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HitlApprovalNotificationPayload {
  approvalId: string;
  projectId: string;
  toolName: string;
  environment: string;
  parameters: Record<string, unknown>;
  reason: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async dispatchHitlApprovalNotification(payload: HitlApprovalNotificationPayload): Promise<void> {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: payload.projectId },
        select: { name: true, webhookUrl: true, slackWebhookUrl: true },
      });

      if (!project) return;

      const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3001/alerts';

      // 1. Dispatch to Slack Webhook if configured
      if (project.slackWebhookUrl) {
        this.logger.log(`Dispatching Slack HITL notification for approval ${payload.approvalId} to ${project.slackWebhookUrl}`);
        const slackPayload = {
          text: `⚠️ *Human Approval Required*: Tool \`${payload.toolName}\` execution paused in project *${project.name}*`,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '⚠️ Human-in-the-Loop (HITL) Approval Required',
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `An AI Agent requested execution of high-risk tool \`${payload.toolName}\` in project *${project.name}*. Execution is **paused** pending human review.`,
              },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Tool Name:*\n\`${payload.toolName}\`` },
                { type: 'mrkdwn', text: `*Environment:*\n\`${payload.environment}\`` },
                { type: 'mrkdwn', text: `*Approval ID:*\n\`${payload.approvalId}\`` },
                { type: 'mrkdwn', text: `*Reason:*\n${payload.reason}` },
              ],
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'Review & Approve in Dashboard' },
                  url: dashboardUrl,
                  style: 'primary',
                },
              ],
            },
          ],
        };

        fetch(project.slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload),
        }).catch((err) => this.logger.error(`Slack webhook error: ${err.message}`));
      }

      // 2. Dispatch to Generic Webhook if configured
      if (project.webhookUrl) {
        this.logger.log(`Dispatching Webhook HITL notification for approval ${payload.approvalId} to ${project.webhookUrl}`);
        const webhookBody = {
          event: 'APPROVAL_REQUIRED',
          timestamp: new Date().toISOString(),
          data: {
            approvalId: payload.approvalId,
            projectId: payload.projectId,
            projectName: project.name,
            toolName: payload.toolName,
            environment: payload.environment,
            parameters: payload.parameters,
            reason: payload.reason,
            dashboardUrl,
          },
        };

        fetch(project.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookBody),
        }).catch((err) => this.logger.error(`Generic webhook error: ${err.message}`));
      }
    } catch (error) {
      this.logger.error(`Error in dispatchHitlApprovalNotification: ${error}`);
    }
  }
}
