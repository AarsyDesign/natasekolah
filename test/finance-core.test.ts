import { test, describe } from "node:test";
import assert from "node:assert";
import { runWithTenantContext, TenantContext } from "../src/lib/tenant/context";
import {
  createFeeCategory,
  updateFeeCategory,
  getFeeCategory,
  createStudentCharge,
  getStudentCharge,
  voidStudentCharge,
  createPaymentTransaction,
  getCashbookSummary,
  generateUniqueReceiptNumber,
  generateUniqueTransactionNumber,
  generateUniqueCashbookNumber,
  PaymentError,
  ChargeError,
  FeeCategoryError,
} from "../src/lib/finance";

function createMockPrismaFinance() {
  const feeCategoriesStore: Map<string, any> = new Map();
  const studentChargesStore: Map<string, any> = new Map();
  const paymentTransactionsStore: Map<string, any> = new Map();
  const paymentAllocationsStore: Map<string, any> = new Map();
  const cashbookEntriesStore: Map<string, any> = new Map();
  const receiptsStore: Map<string, any> = new Map();
  const studentsStore: Map<string, any> = new Map();

  let autoId = 1;

  // Pre-seed mock students
  studentsStore.set("std_001", {
    id: "std_001",
    institutionId: "inst_finance_demo",
    nis: "1001",
    fullName: "Ahmad Dahlan",
    status: "ACTIVE",
  });
  studentsStore.set("std_other_tenant", {
    id: "std_other_tenant",
    institutionId: "inst_other_tenant",
    nis: "9999",
    fullName: "Siswa Tenant Lain",
    status: "ACTIVE",
  });

  const mock = {
    feeCategory: {
      create: async ({ data }: any) => {
        const id = `fc_${autoId++}`;
        const record = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
        feeCategoriesStore.set(id, record);
        return record;
      },
      findFirst: async ({ where }: any) => {
        const list = Array.from(feeCategoriesStore.values());
        return (
          list.find((i) => {
            if (where.id && i.id !== where.id) return false;
            if (where.institutionId && i.institutionId !== where.institutionId) return false;
            if (where.code && i.code !== where.code) return false;
            return true;
          }) || null
        );
      },
      findMany: async ({ where }: any) => {
        let list = Array.from(feeCategoriesStore.values());
        if (where?.institutionId) list = list.filter((i) => i.institutionId === where.institutionId);
        return list;
      },
      count: async ({ where }: any) => {
        let list = Array.from(feeCategoriesStore.values());
        if (where?.institutionId) list = list.filter((i) => i.institutionId === where.institutionId);
        return list.length;
      },
      update: async ({ where, data }: any) => {
        const record = feeCategoriesStore.get(where.id);
        if (!record) throw new Error("Not found");
        Object.assign(record, data, { updatedAt: new Date() });
        return record;
      },
    },

    student: {
      findFirst: async ({ where }: any) => {
        const list = Array.from(studentsStore.values());
        return (
          list.find((s) => {
            if (where.id && s.id !== where.id) return false;
            if (where.institutionId && s.institutionId !== where.institutionId) return false;
            return true;
          }) || null
        );
      },
      findMany: async ({ where }: any) => {
        let list = Array.from(studentsStore.values());
        if (where?.id?.in) list = list.filter((s) => where.id.in.includes(s.id));
        if (where?.institutionId) list = list.filter((s) => s.institutionId === where.institutionId);
        return list;
      },
    },

    studentCharge: {
      create: async ({ data }: any) => {
        const id = `sc_${autoId++}`;
        const record = {
          id,
          ...data,
          status: data.status || "UNPAID",
          allocations: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          student: studentsStore.get(data.studentId),
          feeCategory: feeCategoriesStore.get(data.feeCategoryId),
        };
        studentChargesStore.set(id, record);
        return record;
      },
      findFirst: async ({ where }: any) => {
        const list = Array.from(studentChargesStore.values());
        return (
          list.find((c) => {
            if (where.id && c.id !== where.id) return false;
            if (where.institutionId && c.institutionId !== where.institutionId) return false;
            return true;
          }) || null
        );
      },
      findMany: async ({ where }: any) => {
        let list = Array.from(studentChargesStore.values());
        if (where?.institutionId) list = list.filter((c) => c.institutionId === where.institutionId);
        if (where?.id?.in) list = list.filter((c) => where.id.in.includes(c.id));
        if (where?.studentId) list = list.filter((c) => c.studentId === where.studentId);
        if (where?.status?.not) list = list.filter((c) => c.status !== where.status.not);
        return list;
      },
      count: async ({ where }: any) => {
        let list = Array.from(studentChargesStore.values());
        if (where?.institutionId) list = list.filter((c) => c.institutionId === where.institutionId);
        return list.length;
      },
      update: async ({ where, data }: any) => {
        const record = studentChargesStore.get(where.id);
        if (!record) throw new Error("Not found");
        Object.assign(record, data, { updatedAt: new Date() });
        return record;
      },
    },

    paymentTransaction: {
      create: async ({ data }: any) => {
        const id = `pt_${autoId++}`;
        const record = {
          id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          allocations: [],
          student: studentsStore.get(data.studentId),
        };
        paymentTransactionsStore.set(id, record);
        return record;
      },
      findFirst: async ({ where }: any) => {
        const list = Array.from(paymentTransactionsStore.values());
        return (
          list.find((p) => {
            if (where.id && p.id !== where.id) return false;
            if (where.institutionId && p.institutionId !== where.institutionId) return false;
            if (where.transactionNumber && p.transactionNumber !== where.transactionNumber) return false;
            return true;
          }) || null
        );
      },
      findMany: async ({ where }: any) => {
        let list = Array.from(paymentTransactionsStore.values());
        if (where?.institutionId) list = list.filter((p) => p.institutionId === where.institutionId);
        return list;
      },
      count: async ({ where }: any) => {
        let list = Array.from(paymentTransactionsStore.values());
        if (where?.institutionId) list = list.filter((p) => p.institutionId === where.institutionId);
        if (where?.transactionNumber?.startsWith) {
          list = list.filter((p) => p.transactionNumber.startsWith(where.transactionNumber.startsWith));
        }
        return list.length;
      },
    },

    paymentAllocation: {
      create: async ({ data }: any) => {
        const id = `pa_${autoId++}`;
        const record = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
        paymentAllocationsStore.set(id, record);

        const charge = studentChargesStore.get(data.studentChargeId);
        if (charge) {
          charge.allocations = charge.allocations || [];
          charge.allocations.push(record);
        }
        return record;
      },
    },

    cashbookEntry: {
      create: async ({ data }: any) => {
        const id = `cb_${autoId++}`;
        const record = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
        cashbookEntriesStore.set(id, record);
        return record;
      },
      findMany: async ({ where }: any) => {
        let list = Array.from(cashbookEntriesStore.values());
        if (where?.institutionId) list = list.filter((c) => c.institutionId === where.institutionId);
        if (where?.type) list = list.filter((c) => c.type === where.type);
        return list;
      },
      count: async ({ where }: any) => {
        let list = Array.from(cashbookEntriesStore.values());
        if (where?.institutionId) list = list.filter((c) => c.institutionId === where.institutionId);
        if (where?.entryNumber?.startsWith) {
          list = list.filter((c) => c.entryNumber.startsWith(where.entryNumber.startsWith));
        }
        return list.length;
      },
      aggregate: async ({ where }: any) => {
        let list = Array.from(cashbookEntriesStore.values());
        if (where?.institutionId) list = list.filter((c) => c.institutionId === where.institutionId);
        if (where?.type) list = list.filter((c) => c.type === where.type);
        const total = list.reduce((sum, c) => sum + c.amount, 0);
        return { _sum: { amount: total } };
      },
    },

    receipt: {
      create: async ({ data }: any) => {
        const id = `rc_${autoId++}`;
        const record = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
        receiptsStore.set(id, record);
        return record;
      },
      findFirst: async ({ where }: any) => {
        const list = Array.from(receiptsStore.values());
        return (
          list.find((r) => {
            if (where.id && r.id !== where.id) return false;
            if (where.institutionId && r.institutionId !== where.institutionId) return false;
            if (where.paymentTransactionId && r.paymentTransactionId !== where.paymentTransactionId) return false;
            if (where.receiptNumber && r.receiptNumber !== where.receiptNumber) return false;
            return true;
          }) || null
        );
      },
      findMany: async ({ where }: any) => {
        let list = Array.from(receiptsStore.values());
        if (where?.institutionId) list = list.filter((r) => r.institutionId === where.institutionId);
        return list;
      },
      count: async ({ where }: any) => {
        let list = Array.from(receiptsStore.values());
        if (where?.institutionId) list = list.filter((r) => r.institutionId === where.institutionId);
        if (where?.receiptNumber?.startsWith) {
          list = list.filter((r) => r.receiptNumber.startsWith(where.receiptNumber.startsWith));
        }
        return list.length;
      },
    },

    $transaction: async (fn: any) => {
      return await fn(mock);
    },

    $stores: {
      feeCategoriesStore,
      studentChargesStore,
      paymentTransactionsStore,
      paymentAllocationsStore,
      cashbookEntriesStore,
      receiptsStore,
    },
  };

  return mock;
}

describe("Phase 4 — Finance Core Domain Tests", () => {
  const mockTenantContext: TenantContext = {
    institutionId: "inst_finance_demo",
    userId: "user_finance_admin",
    roles: ["ADMIN", "FINANCE_STAFF"],
    permissions: ["finance:view", "finance:manage"],
    isSuperAdmin: false,
  };

  const otherTenantContext: TenantContext = {
    institutionId: "inst_other_tenant",
    userId: "user_other",
    roles: ["ADMIN"],
    permissions: ["finance:view", "finance:manage"],
    isSuperAdmin: false,
  };

  test("1. Unique Atomic Number Generators (Receipt KW, Transaction TRX, Cashbook CSH)", async () => {
    const mockPrisma = createMockPrismaFinance();

    await runWithTenantContext(mockTenantContext, async () => {
      const kw = await generateUniqueReceiptNumber(mockTenantContext.institutionId, mockPrisma as any);
      const trx = await generateUniqueTransactionNumber(mockTenantContext.institutionId, mockPrisma as any);
      const csh = await generateUniqueCashbookNumber(mockTenantContext.institutionId, mockPrisma as any);

      assert.ok(kw.startsWith("KW-"));
      assert.ok(trx.startsWith("TRX-"));
      assert.ok(csh.startsWith("CSH-"));
    });
  });

  test("2. FeeCategory Management (Create, Unique Code per Tenant, Update)", async () => {
    const mockPrisma = createMockPrismaFinance();

    await runWithTenantContext(mockTenantContext, async () => {
      const cat = await createFeeCategory(
        {
          code: "SPP",
          name: "SPP Syahriah Bulanan",
          amount: 150000,
          frequency: "MONTHLY",
        },
        mockPrisma as any
      );

      assert.ok(cat.id);
      assert.strictEqual(cat.code, "SPP");
      assert.strictEqual(cat.amount, 150000);

      // Duplicate code in same tenant should throw
      await assert.rejects(
        async () =>
          createFeeCategory(
            {
              code: "SPP",
              name: "Duplicate SPP",
              amount: 150000,
            },
            mockPrisma as any
          ),
        FeeCategoryError
      );
    });

    // Same code in DIFFERENT tenant should succeed
    await runWithTenantContext(otherTenantContext, async () => {
      const otherCat = await createFeeCategory(
        {
          code: "SPP",
          name: "SPP Tenant Lain",
          amount: 200000,
        },
        mockPrisma as any
      );
      assert.strictEqual(otherCat.code, "SPP");
    });
  });

  test("3. StudentCharge Creation & Snapshot Amount", async () => {
    const mockPrisma = createMockPrismaFinance();

    await runWithTenantContext(mockTenantContext, async () => {
      const cat = await createFeeCategory(
        {
          code: "SPP",
          name: "SPP Bulanan",
          amount: 150000,
        },
        mockPrisma as any
      );

      const charge = await createStudentCharge(
        {
          studentId: "std_001",
          feeCategoryId: cat.id,
          period: "2026-09",
          amount: 150000,
        },
        mockPrisma as any
      );

      assert.strictEqual(charge.status, "UNPAID");
      assert.strictEqual(charge.amount, 150000); // Snapshot amount

      // Changing master fee category amount does NOT alter historical charge snapshot
      await updateFeeCategory(cat.id, { amount: 175000 }, mockPrisma as any);
      const freshCharge = await getStudentCharge(charge.id, mockPrisma as any);
      assert.strictEqual(freshCharge.amount, 150000); // Historical snapshot preserved!
    });
  });

  test("4. Atomic Payment Transaction & Status Transitions (UNPAID -> PARTIAL -> PAID)", async () => {
    const mockPrisma = createMockPrismaFinance();

    await runWithTenantContext(mockTenantContext, async () => {
      const cat = await createFeeCategory(
        {
          code: "SPP",
          name: "SPP Syahriah",
          amount: 300000,
        },
        mockPrisma as any
      );

      const charge = await createStudentCharge(
        {
          studentId: "std_001",
          feeCategoryId: cat.id,
          period: "2026-09",
          amount: 300000,
        },
        mockPrisma as any
      );

      // 1. Partial Payment Rp 100.000
      const pay1 = await createPaymentTransaction(
        {
          studentId: "std_001",
          amount: 100000,
          paymentMethod: "CASH",
          allocations: [{ studentChargeId: charge.id, amount: 100000 }],
        },
        mockPrisma as any
      );

      assert.ok(pay1.payment.transactionNumber.startsWith("TRX-"));
      assert.ok(pay1.receipt.receiptNumber.startsWith("KW-"));

      const chargeAfterPay1 = await getStudentCharge(charge.id, mockPrisma as any);
      assert.strictEqual(chargeAfterPay1.status, "PARTIAL");
      assert.strictEqual(chargeAfterPay1.allocatedAmount, 100000);
      assert.strictEqual(chargeAfterPay1.remainingAmount, 200000);

      // 2. Remaining Payment Rp 200.000 -> Status becomes PAID
      await createPaymentTransaction(
        {
          studentId: "std_001",
          amount: 200000,
          paymentMethod: "TRANSFER",
          allocations: [{ studentChargeId: charge.id, amount: 200000 }],
        },
        mockPrisma as any
      );

      const chargeAfterPay2 = await getStudentCharge(charge.id, mockPrisma as any);
      assert.strictEqual(chargeAfterPay2.status, "PAID");
      assert.strictEqual(chargeAfterPay2.remainingAmount, 0);

      // 3. Check Cashbook Summary (INCOME = 300.000)
      const cbSummary = await getCashbookSummary(mockPrisma as any);
      assert.strictEqual(cbSummary.totalIncome, 300000);
      assert.strictEqual(cbSummary.netBalance, 300000);
    });
  });

  test("5. Rejection of Over-Allocation & Invalid Allocation", async () => {
    const mockPrisma = createMockPrismaFinance();

    await runWithTenantContext(mockTenantContext, async () => {
      const cat = await createFeeCategory(
        {
          code: "SERAGAM",
          name: "Seragam Batik",
          amount: 200000,
        },
        mockPrisma as any
      );

      const charge = await createStudentCharge(
        {
          studentId: "std_001",
          feeCategoryId: cat.id,
          amount: 200000,
        },
        mockPrisma as any
      );

      // Total allocation (250.000) > payment amount (200.000) -> Rejected
      await assert.rejects(
        async () =>
          createPaymentTransaction(
            {
              studentId: "std_001",
              amount: 200000,
              paymentMethod: "CASH",
              allocations: [{ studentChargeId: charge.id, amount: 250000 }],
            },
            mockPrisma as any
          ),
        PaymentError
      );

      // Allocation (250.000) > charge remaining unpaid (200.000) -> Rejected
      await assert.rejects(
        async () =>
          createPaymentTransaction(
            {
              studentId: "std_001",
              amount: 250000,
              paymentMethod: "CASH",
              allocations: [{ studentChargeId: charge.id, amount: 250000 }],
            },
            mockPrisma as any
          ),
        PaymentError
      );
    });
  });

  test("6. Rejection of Payment Allocation to VOID Charge", async () => {
    const mockPrisma = createMockPrismaFinance();

    await runWithTenantContext(mockTenantContext, async () => {
      const cat = await createFeeCategory(
        {
          code: "LAIN",
          name: "Biaya Kegiatan",
          amount: 50000,
        },
        mockPrisma as any
      );

      const charge = await createStudentCharge(
        {
          studentId: "std_001",
          feeCategoryId: cat.id,
          amount: 50000,
        },
        mockPrisma as any
      );

      // Void charge
      await voidStudentCharge(charge.id, mockPrisma as any);

      // Paying for VOID charge must fail
      await assert.rejects(
        async () =>
          createPaymentTransaction(
            {
              studentId: "std_001",
              amount: 50000,
              paymentMethod: "CASH",
              allocations: [{ studentChargeId: charge.id, amount: 50000 }],
            },
            mockPrisma as any
          ),
        PaymentError
      );
    });
  });

  test("7. Tenant Isolation Enforcement (Cross-Tenant Rejection)", async () => {
    const mockPrisma = createMockPrismaFinance();

    let tenantAChargeId = "";
    await runWithTenantContext(mockTenantContext, async () => {
      const cat = await createFeeCategory(
        { code: "SPP", name: "SPP A", amount: 100000 },
        mockPrisma as any
      );
      const charge = await createStudentCharge(
        {
          studentId: "std_001",
          feeCategoryId: cat.id,
          amount: 100000,
        },
        mockPrisma as any
      );
      tenantAChargeId = charge.id;
    });

    // Tenant B trying to fetch Tenant A charge -> Throws 404
    await runWithTenantContext(otherTenantContext, async () => {
      await assert.rejects(
        async () => getStudentCharge(tenantAChargeId, mockPrisma as any),
        ChargeError
      );
    });
  });
});
