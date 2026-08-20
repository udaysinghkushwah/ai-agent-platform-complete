import { prisma } from './processor';

/**
 * Runs once a day. Only touches projects that have explicitly set a
 * retentionDays value — null means "keep forever" and this function skips
 * those projects entirely, never guessing a default.
 */
export async function cleanupExpiredTraces(): Promise<void> {
  const projects = await prisma.project.findMany({
    where: { retentionDays: { not: null } },
    select: { id: true, retentionDays: true },
  });

  for (const project of projects) {
    const cutoff = new Date(Date.now() - project.retentionDays! * 24 * 60 * 60 * 1000);
    try {
      // Spans cascade-delete via the schema's onDelete: Cascade on
      // Trace -> Span, so deleting the trace is enough.
      const { count } = await prisma.trace.deleteMany({
        where: { projectId: project.id, startedAt: { lt: cutoff } },
      });
      if (count > 0) {
        console.log(`[retention] purged ${count} trace(s) older than ${project.retentionDays}d for project ${project.id}`);
      }
    } catch (err) {
      console.error(`[retention] failed cleaning up project ${project.id}:`, err);
    }
  }
}
