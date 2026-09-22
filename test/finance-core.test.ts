import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateChargeStatus, calculateOutstanding, calculateExcess } from "../src/lib/finance";
import { validateCreatePaymentInput, validateCreateStudentChargeInput, validateVoidStudentChargeInput } from "../src/lib/validation/finance";
import { sanitizeClientInput } from "../src/lib/tenant/guard";
import { hasPermission } from "../src/lib/auth/permissions";
import type { TenantContext } from "../src/lib/tenant/context";

describe("Phase 3 — Finance Core", () => {
  it("calculates charge lifecycle including overpayment", () => {
    assert.equal(calculateChargeStatus(500000, 0), "UNPAID");
    assert.equal(calculateChargeStatus(500000, 200000), "PARTIAL");
    assert.equal(calculateChargeStatus(500000, 500000), "PAID");
    assert.equal(calculateChargeStatus(500000, 600000), "OVERPAID");
    assert.equal(calculateOutstanding(500000, 200000), 300000);
    assert.equal(calculateExcess(500000, 600000), 100000);
  });

  it("rejects non-positive payment amounts", () => {
    assert.throws(() => validateCreatePaymentInput({
      studentChargeId: "charge_1",
      amount: 0,
      method: "CASH",
      idempotencyKey: "idem_12345678",
    }));
  });

  it("rejects discounts above the charge amount", () => {
    assert.throws(() => validateCreateStudentChargeInput({
      studentId: "student_1",
      feeCategoryId: "fee_1",
      academicYearId: "ay_1",
      amount: 100000,
      discountAmount: 100001,
    }));
  });

  it("rejects invalid payment method and short idempotency keys", () => {
    assert.throws(() => validateCreatePaymentInput({
      studentChargeId: "charge_1",
      amount: 100000,
      method: "INVALID",
      idempotencyKey: "short",
    }));
  });

  it("validates charge void reason", () => {
    assert.throws(() => validateVoidStudentChargeInput({
      studentChargeId: "charge_1",
      reason: "x",
    }));
  });

  it("strips client security fields and binds the server tenant", () => {
    const cleaned = sanitizeClientInput({
      institutionId: "attacker_tenant",
      userId: "attacker_user",
      role: "SUPER_ADMIN",
      roles: ["SUPER_ADMIN"],
      permissions: ["*"],
      isSuperAdmin: true,
      amount: 100000,
    }, {
      userId: "real_user",
      institutionId: "real_tenant",
      roles: ["FINANCE_STAFF"],
      permissions: ["finance:view", "finance:manage"],
      isSuperAdmin: false,
    });
    assert.deepEqual(cleaned, { amount: 100000, institutionId: "real_tenant" });
  });

  it("enforces finance RBAC by role context", () => {
    const teacher: TenantContext = {
      userId: "teacher_1",
      institutionId: "inst_a",
      roles: ["TEACHER"],
      permissions: ["student:view", "attendance:view", "attendance:manage"],
      isSuperAdmin: false,
    };
    const finance: TenantContext = {
      userId: "finance_1",
      institutionId: "inst_a",
      roles: ["FINANCE_STAFF"],
      permissions: ["student:view", "finance:view", "finance:manage", "report:view"],
      isSuperAdmin: false,
    };
    const principal: TenantContext = {
      userId: "principal_1",
      institutionId: "inst_a",
      roles: ["PRINCIPAL"],
      permissions: ["finance:view"],
      isSuperAdmin: false,
    };
    assert.equal(hasPermission(teacher, "finance:view"), false);
    assert.equal(hasPermission(principal, "finance:view"), true);
    assert.equal(hasPermission(principal, "finance:manage"), false);
    assert.equal(hasPermission(finance, "finance:manage"), true);
  });
});
