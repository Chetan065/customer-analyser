import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { feedbackItems } from "@/lib/db/schema";

export interface SegmentDerivationInput {
  customerId?: string | null;
  orderCount?: number | null;
  customerSegment?: string | null;
  knownCustomerFrequency?: Map<string, number>;
}

export interface SegmentDerivationResult {
  isRepeatCustomer: boolean;
  customerSegment: string | null;
}

/**
 * Idempotently derives isRepeatCustomer and customerSegment for a feedback item.
 * Rules:
 * 1. orderCount > 1 -> isRepeatCustomer = true
 * 2. customerId appears more than once in project -> isRepeatCustomer = true
 * 3. customerSegment contains 'repeat' or 'vip' or 'loyal' -> isRepeatCustomer = true
 * 4. customerSegment contains 'new' or 'first' or 'trial' -> isRepeatCustomer = false
 * 5. If segment is empty, automatically assign 'repeat' or 'new' if orderCount or frequency indicates it.
 */
export function deriveCustomerSegment(input: SegmentDerivationInput): SegmentDerivationResult {
  const { customerId, orderCount, customerSegment, knownCustomerFrequency } = input;

  let isRepeat = false;

  if (typeof orderCount === "number" && orderCount > 1) {
    isRepeat = true;
  } else if (customerId && knownCustomerFrequency && (knownCustomerFrequency.get(customerId) || 0) > 1) {
    isRepeat = true;
  } else if (customerSegment) {
    const lower = customerSegment.toLowerCase().trim();
    if (lower.includes("repeat") || lower.includes("vip") || lower.includes("loyal") || lower.includes("enterprise")) {
      isRepeat = true;
    }
  }

  let finalSegment = customerSegment ? customerSegment.trim() : null;

  if (!finalSegment) {
    if (isRepeat) {
      finalSegment = "repeat";
    } else if (typeof orderCount === "number" && orderCount === 1) {
      finalSegment = "new";
    }
  }

  return {
    isRepeatCustomer: isRepeat,
    customerSegment: finalSegment,
  };
}

/**
 * Recomputes and backfills customer identity & segment fields across all items in a project.
 * Completely idempotent and safe to run multiple times.
 */
export async function recomputeProjectSegments(projectId: string): Promise<{
  totalProcessed: number;
  updatedCount: number;
  repeatCount: number;
  newCount: number;
}> {
  const allItems = await db
    .select({
      id: feedbackItems.id,
      customerId: feedbackItems.customerId,
      orderCount: feedbackItems.orderCount,
      isRepeatCustomer: feedbackItems.isRepeatCustomer,
      customerSegment: feedbackItems.customerSegment,
    })
    .from(feedbackItems)
    .where(eq(feedbackItems.projectId, projectId));

  // 1. Compute customer frequency
  const customerFrequency = new Map<string, number>();
  for (const item of allItems) {
    if (item.customerId) {
      const cleanId = item.customerId.trim();
      customerFrequency.set(cleanId, (customerFrequency.get(cleanId) || 0) + 1);
    }
  }

  let updatedCount = 0;
  let repeatCount = 0;
  let newCount = 0;

  // 2. Evaluate and update items
  for (const item of allItems) {
    const derived = deriveCustomerSegment({
      customerId: item.customerId,
      orderCount: item.orderCount,
      customerSegment: item.customerSegment,
      knownCustomerFrequency: customerFrequency,
    });

    if (derived.isRepeatCustomer) {
      repeatCount++;
    } else if (derived.customerSegment?.toLowerCase() === "new" || item.orderCount === 1) {
      newCount++;
    }

    // Check if update is needed
    if (
      derived.isRepeatCustomer !== item.isRepeatCustomer ||
      derived.customerSegment !== item.customerSegment
    ) {
      await db
        .update(feedbackItems)
        .set({
          isRepeatCustomer: derived.isRepeatCustomer,
          customerSegment: derived.customerSegment,
        })
        .where(eq(feedbackItems.id, item.id));
      updatedCount++;
    }
  }

  return {
    totalProcessed: allItems.length,
    updatedCount,
    repeatCount,
    newCount,
  };
}
