import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "../../../../lib/prisma";
import { runWithTenantContext, TenantContext } from "../../../../lib/tenant/context";
import { processOutboxQueue } from "../../../../lib/notification/outbox-service";

/**
 * Validates the Authorization: Bearer <CRON_SECRET> header using constant-time comparison.
 * Never leaks the secret or detailed mismatch reasons.
 */
function verifyCronSecret(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const token = authHeader.slice(7).trim();
  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(cronSecret);

  if (tokenBuf.length !== secretBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuf, secretBuf);
}

async function handleCron(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const now = new Date();

    // 1. Identify institutions with pending or retry-ready notifications
    const distinctInstitutions = await prisma.notificationOutbox.findMany({
      where: {
        status: { in: ["PENDING", "FAILED"] },
        attempts: { lt: 5 },
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: now } },
        ],
      },
      select: {
        institutionId: true,
      },
      distinct: ["institutionId"],
      take: 10,
    });

    let totalProcessed = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;
    const institutionSummaries: Array<{
      institutionId: string;
      processed: number;
      succeeded: number;
      failed: number;
    }> = [];

    // 2. Process each institution in its own isolated TenantContext boundary
    for (const { institutionId } of distinctInstitutions) {
      const syntheticContext: TenantContext = {
        userId: "system_cron_worker",
        institutionId,
        roles: ["SUPER_ADMIN"],
        permissions: ["notification:manage", "notification:view"],
        isSuperAdmin: true,
      };

      const result = await runWithTenantContext(syntheticContext, async () => {
        return await processOutboxQueue(10);
      });

      totalProcessed += result.processed;
      totalSucceeded += result.succeeded;
      totalFailed += result.failed;

      institutionSummaries.push({
        institutionId,
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        institutionsCount: distinctInstitutions.length,
        totalProcessed,
        totalSucceeded,
        totalFailed,
      },
      details: institutionSummaries,
    });
  } catch (error) {
    console.error("[Cron process-outbox] Internal error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
