import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processOutboxQueue } from "@/lib/notification/outbox-service";

/**
 * Scheduled Outbox Processing Route Handler
 * Compatible with Vercel Cron, GitHub Actions, or any standard HTTP scheduler.
 * Enforces CRON_SECRET authorization when configured.
 */
export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

async function handleCron(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized cron execution" },
        { status: 401 }
      );
    }
  }

  const now = new Date();

  try {
    // Find distinct institutions that have pending or retry-ready notifications
    const pendingItems = await prisma.notificationOutbox.findMany({
      where: {
        status: { in: ["PENDING", "FAILED"] },
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: now } },
        ],
      },
      select: {
        institutionId: true,
      },
      distinct: ["institutionId"],
      take: 20,
    });

    const institutionIds = pendingItems.map((p) => p.institutionId);

    let totalProcessed = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;

    for (const institutionId of institutionIds) {
      const result = await processOutboxQueue(25, undefined, institutionId);
      totalProcessed += result.processed;
      totalSucceeded += result.succeeded;
      totalFailed += result.failed;
    }

    return NextResponse.json({
      success: true,
      data: {
        institutionsServiced: institutionIds.length,
        processed: totalProcessed,
        succeeded: totalSucceeded,
        failed: totalFailed,
        executedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[CronNotificationWorker] Error:", errorMsg);
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
