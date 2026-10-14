"use server";

import { z } from "zod";
import { requirePermission } from "@showbuzz/core/auth/admin/current-staff";
import { type ActionResult, runAction } from "@showbuzz/core/http/action-result";
import { logActivity } from "@showbuzz/core/services/activity-log.service";
import { generateInvoices, markInvoicePaid, voidInvoice } from "@showbuzz/core/services/admin/invoice.service";
import { createPlan, updatePlan } from "@showbuzz/core/services/admin/plan.service";
import { createSettlement, markSettlementPaid, voidSettlement } from "@showbuzz/core/services/admin/settlement.service";
import type { GenerateInvoicesResult } from "@showbuzz/schemas/types/admin-marketplace";
import { objectIdSchema } from "@showbuzz/schemas/common";
import { formatINR } from "@showbuzz/utils/money";
import { actorOf } from "@/lib/actor";

/**
 * Plans, subscription invoices and vendor payouts. Money is recorded, not moved: invoices are paid to ShowBuzz and
 * payouts sent to the vendor's bank outside the system (no gateway yet); staff record the reference here.
 */

// Plans

export async function createPlanAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const current = await requirePermission("plans:write");
    const plan = await createPlan(input);
    await logActivity(actorOf(current), {
      action: "plan_create",
      resource: "plan",
      resourceId: plan.id,
      summary: `Created plan ${plan.name}`,
      changedFields: ["name", "monthlyFeePaise", "active"],
    });
    return { id: plan.id };
  });
}

export async function updatePlanAction(planId: unknown, input: unknown): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const current = await requirePermission("plans:write");
    const id = objectIdSchema.parse(planId);
    const { name, changedFields } = await updatePlan(id, input);
    await logActivity(actorOf(current), {
      action: "plan_update",
      resource: "plan",
      resourceId: id,
      summary: `Updated plan ${name}`,
      changedFields,
    });
    return { saved: true as const };
  });
}

// Subscription invoices

export async function generateInvoicesAction(month: unknown): Promise<ActionResult<GenerateInvoicesResult>> {
  return runAction(async () => {
    const current = await requirePermission("invoices:write");
    const result = await generateInvoices(month, current.staff.id, new Date());
    await logActivity(actorOf(current), {
      action: "invoices_generate",
      resource: "subscription_invoice",
      summary: `Generated ${result.created} invoice(s) for ${result.month}`,
      changedFields: [],
    });
    return result;
  });
}

export async function markInvoicePaidAction(
  invoiceId: unknown,
  input: unknown,
): Promise<ActionResult<{ code: string }>> {
  return runAction(async () => {
    const current = await requirePermission("invoices:write");
    const id = objectIdSchema.parse(invoiceId);
    const { code, vendorId } = await markInvoicePaid(id, input, current.staff.id, new Date());
    await logActivity(actorOf(current, vendorId), {
      action: "invoice_paid",
      resource: "subscription_invoice",
      resourceId: id,
      summary: `Recorded payment of ${code}`,
      changedFields: ["status", "reference", "paidAt"],
    });
    return { code };
  });
}

export async function voidInvoiceAction(invoiceId: unknown, input: unknown): Promise<ActionResult<{ code: string }>> {
  return runAction(async () => {
    const current = await requirePermission("invoices:write");
    const id = objectIdSchema.parse(invoiceId);
    const { code, vendorId } = await voidInvoice(id, input);
    await logActivity(actorOf(current, vendorId), {
      action: "invoice_void",
      resource: "subscription_invoice",
      resourceId: id,
      summary: `Voided ${code}`,
      changedFields: ["status", "voidReason"],
    });
    return { code };
  });
}

// Vendor payouts

const expectedSchema = z.object({
  bookings: z.int().min(0),
  clawbacks: z.int().min(0),
  netPayoutPaise: z.int(),
});

export async function createSettlementAction(
  range: unknown,
  expected: unknown,
): Promise<ActionResult<{ id: string; code: string }>> {
  return runAction(async () => {
    const current = await requirePermission("settlements:write");
    const created = await createSettlement(range, expectedSchema.parse(expected), current.staff.id, new Date());
    await logActivity(actorOf(current, created.vendorId), {
      action: "settlement_create",
      resource: "settlement",
      resourceId: created.id,
      summary: `Created payout ${created.code} (${formatINR(created.netPayoutPaise)})`,
      changedFields: ["bookingIds", "clawbackBookingIds", "netPayoutPaise"],
    });
    return { id: created.id, code: created.code };
  });
}

export async function markSettlementPaidAction(
  settlementId: unknown,
  input: unknown,
): Promise<ActionResult<{ code: string }>> {
  return runAction(async () => {
    const current = await requirePermission("settlements:write");
    const id = objectIdSchema.parse(settlementId);
    const { code, vendorId } = await markSettlementPaid(id, input, current.staff.id, new Date());
    await logActivity(actorOf(current, vendorId), {
      action: "settlement_paid",
      resource: "settlement",
      resourceId: id,
      summary: `Recorded payout ${code} as paid`,
      changedFields: ["status", "reference", "paidAt"],
    });
    return { code };
  });
}

export async function voidSettlementAction(
  settlementId: unknown,
  input: unknown,
): Promise<ActionResult<{ code: string }>> {
  return runAction(async () => {
    const current = await requirePermission("settlements:write");
    const id = objectIdSchema.parse(settlementId);
    const { code, vendorId } = await voidSettlement(id, input, new Date());
    await logActivity(actorOf(current, vendorId), {
      action: "settlement_void",
      resource: "settlement",
      resourceId: id,
      summary: `Voided payout ${code}; its bookings can be paid out again`,
      changedFields: ["status", "voidReason", "bookingIds"],
    });
    return { code };
  });
}
