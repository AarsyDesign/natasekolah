import { test, describe } from "node:test";
import assert from "node:assert";
import { runWithTenantContext, TenantContext } from "../src/lib/tenant/context";
import {
  createFeeCategory,
  updateFeeCategory,
  createStudentCharge,
  bulkCreateStudentCharges,
  listStudentCharges,
  getStudentCharge,
  voidStudentCharge,
  getTargetStudentsForBilling,
  getBillingSummary,
  createPaymentTransaction,
  listPaymentTransactions,
  createCashbookEntry,
  listCashbookEntries,
  getCashbookSummary,
  generateUniqueReceiptNumber,
  getReceiptDetails,
  getPaymentSummaryReport,
  getOutstandingSummaryReport,
  getCashflowReport,
  PaymentError,
  ChargeError,
  FeeCategoryError,
} from "../src/lib/finance";

function createMockPrismaFinanceOperations() {
  const feeCategoriesStore: Map<string, any> = new Map();
  const studentChargesStore: Map<string, any> = new Map();
  const paymentTransactionsStore: Map<string, any> = new Map();
  const paymentAllocationsStore: Map<string, any> = new Map();
  const cashbookEntriesStore: Map<string, any> = new Map();
  const receiptsStore: Map<string, any> = new Map();
  const studentsStore: Map<string, any> = new Map();
  const enrollmentsStore: Map<string, any> = new Map();
  const institutionsStore: Map<string, any> = new Map();
  const auditLogsStore: Map<string, any> = new Map();

  let autoId = 1;

  // Pre-seed institutions
  institutionsStore.set("inst_ops_demo", {
    id: "inst_ops_demo",
    name: "Pesantren Bina Insan Mandiri",
    slug: "pesantren-bim",
    type: "PESANTREN",
    address: "Jl. Pendidikan No. 45, Bandung",
    phone: "081234567890",
    settingsJson: JSON.stringify({
      operational: {
        finance: {
          receiptNumberPrefix: "KWT",
          invoiceDueDays: 10,
          receiptFooterNote: "Jazakumullahu khairan atas pembayaran syahriah santri.",
        },
      },
    }),
  });

  institutionsStore.set("inst_other_tenant", {
    id: "inst_other_tenant",
    name: "Sekolah Luar",
    slug: "sekolah-luar",
    type: "SEKOLAH",
    settingsJson: null,
  });

  // Pre-seed students
  studentsStore.set("std_001", {
    id: "std_001",
    institutionId: "inst_ops_demo",
    nis: "1001",
    fullName: "Ahmad Dahlan",
    status: "ACTIVE",
    phone: "0811111111",
  });

  studentsStore.set("std_002", {
    id: "std_002",
    institutionId: "inst_ops_demo",
    nis: "1002",
    fullName: "Fatimah Zahra",
    status: "ACTIVE",
    phone: "0822222222",
  });

  studentsStore.set("std_003", {
    id: "std_003",
    institutionId: "inst_ops_demo",
    nis: "1003",
    fullName: "Umar Al-Faruq",
    status: "ACTIVE",
    phone: "0833333333",
  });

  studentsStore.set("std_other_tenant", {
    id: "std_other_tenant",
    institutionId: "inst_other_tenant",
    nis: "9999",
    fullName: "Siswa Asing",
    status: "ACTIVE",
    phone: "0899999999",
  });

  // Pre-seed enrollments for classroom testing
  enrollmentsStore.set("enr_001", {
    id: "enr_001",
    institutionId: "inst_ops_demo",
    studentId: "std_001",
    classroomId: "cls_7a",
    academicYearId: "ay_2026",
    status: "ENROLLED",
    student: studentsStore.get("std_001"),
  });

  enrollmentsStore.set("enr_002", {
    id: "enr_002",
    institutionId: "inst_ops_demo",
    studentId: "std_002",
    classroomId: "cls_7a",
    academicYearId: "ay_2026",
    status: "ENROLLED",
    student: studentsStore.get("std_002"),
  });

  const mock = {
    institution: {
      findUnique: async ({ where }: any) => {
        return institutionsStore.get(where.id) || null;
      },
    },

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
        if (where?.status) list = list.filter((s) => s.status === where.status);
        return list;
      },
    },

    enrollment: {
      findMany: async ({ where }: any) => {
        let list = Array.from(enrollmentsStore.values());
        if (where?.institutionId) list = list.filter((e) => e.institutionId === where.institutionId);
        if (where?.classroomId) list = list.filter((e) => e.classroomId === where.classroomId);
        if (where?.status) list = list.filter((e) => e.status === where.status);
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
      createMany: async ({ data }: any) => {
        let count = 0;
        for (const item of data) {
          const id = `sc_${autoId++}`;
          const record = {
            id,
            ...item,
            status: item.status || "UNPAID",
            allocations: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            student: studentsStore.get(item.studentId),
            feeCategory: feeCategoriesStore.get(item.feeCategoryId),
          };
          studentChargesStore.set(id, record);
          count++;
        }
        return { count };
      },
      findFirst: async ({ where }: any) => {
        const list = Array.from(studentChargesStore.values());
        return (
          list.find((c) => {
            if (where.id && c.id !== where.id) return false;
            if (where.institutionId && c.institutionId !== where.institutionId) return false;
            if (where.feeCategoryId && c.feeCategoryId !== where.feeCategoryId) return false;
            if (where.studentId && c.studentId !== where.studentId) return false;
            if (where.status?.not && c.status === where.status.not) return false;
            if (where.period && c.period !== where.period) return false;
            return true;
          }) || null
        );
      },
      findMany: async ({ where }: any) => {
        let list = Array.from(studentChargesStore.values());
        if (where?.institutionId) list = list.filter((c) => c.institutionId === where.institutionId);
        if (where?.id?.in) list = list.filter((c) => where.id.in.includes(c.id));
        if (where?.studentId?.in) list = list.filter((c) => where.studentId.in.includes(c.studentId));
        if (where?.studentId && typeof where.studentId === "string") {
          list = list.filter((c) => c.studentId === where.studentId);
        }
        if (where?.feeCategoryId) list = list.filter((c) => c.feeCategoryId === where.feeCategoryId);
        if (where?.period) list = list.filter((c) => c.period === where.period);
        if (where?.status?.not) list = list.filter((c) => c.status !== where.status.not);
        if (where?.status?.in) list = list.filter((c) => where.status.in.includes(c.status));
        else if (where?.status && typeof where.status === "string") {
          list = list.filter((c) => c.status === where.status);
        }
        if (where?.dueDate?.lt) {
          list = list.filter((c) => c.dueDate && new Date(c.dueDate) < where.dueDate.lt);
        }
        return list;
      },
      count: async ({ where }: any) => {
        const list = await mock.studentCharge.findMany({ where });
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
          receivedBy: { id: data.receivedById, name: "Ustadz Bendahara" },
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
          charge.allocations.push({
            ...record,
            studentCharge: charge,
          });
        }

        const payment = paymentTransactionsStore.get(data.paymentTransactionId);
        if (payment) {
          payment.allocations = payment.allocations || [];
          payment.allocations.push({
            ...record,
            studentCharge: charge,
          });
        }
        return record;
      },
      findMany: async ({ where }: any) => {
        let list = Array.from(paymentAllocationsStore.values());
        if (where?.institutionId) list = list.filter((a) => a.institutionId === where.institutionId);
        return list;
      },
    },

    cashbookEntry: {
      create: async ({ data }: any) => {
        const id = `csh_${autoId++}`;
        const record = {
          id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: { id: data.createdById, name: "Ustadz Bendahara" },
        };
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
      aggregate: async ({ where, _sum }: any) => {
        let list = Array.from(cashbookEntriesStore.values());
        if (where?.institutionId) list = list.filter((c) => c.institutionId === where.institutionId);
        if (where?.type) list = list.filter((c) => c.type === where.type);
        const sum = list.reduce((acc, curr) => acc + (curr.amount || 0), 0);
        return { _sum: { amount: sum } };
      },
    },

    receipt: {
      create: async ({ data }: any) => {
        const id = `rc_${autoId++}`;
        const payment = paymentTransactionsStore.get(data.paymentTransactionId);
        const record = {
          id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          paymentTransaction: payment,
          institution: institutionsStore.get(data.institutionId),
          issuedBy: { id: data.issuedById, name: "Ustadz Bendahara" },
        };
        receiptsStore.set(id, record);
        if (payment) payment.receipt = record;
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
      count: async ({ where }: any) => {
        let list = Array.from(receiptsStore.values());
        if (where?.institutionId) list = list.filter((r) => r.institutionId === where.institutionId);
        if (where?.receiptNumber?.startsWith) {
          list = list.filter((r) => r.receiptNumber.startsWith(where.receiptNumber.startsWith));
        }
        return list.length;
      },
    },

    auditLog: {
      create: async ({ data }: any) => {
        const id = `al_${autoId++}`;
        const record = { id, ...data, createdAt: new Date() };
        auditLogsStore.set(id, record);
        return record;
      },
      findMany: async ({ where }: any) => {
        let list = Array.from(auditLogsStore.values());
        if (where?.institutionId) list = list.filter((a) => a.institutionId === where.institutionId);
        return list;
      },
    },

    $transaction: async (fn: any) => {
      return await fn(mock);
    },
  };

  return mock;
}

const mockTenantContext: TenantContext = {
  institutionId: "inst_ops_demo",
  userId: "user_treasurer_01",
  roles: ["FINANCE_STAFF"],
  permissions: ["finance:view", "finance:manage"],
  isSuperAdmin: false,
};

const mockTeacherContext: TenantContext = {
  institutionId: "inst_ops_demo",
  userId: "user_teacher_01",
  roles: ["TEACHER"],
  permissions: ["academic:view"],
  isSuperAdmin: false,
};

describe("Milestone — Finance & Billing Operations Tests", () => {
  describe("1. Billing Operations & Bulk Generation with Duplicate Prevention", () => {
    test("harus menerbitkan tagihan massal untuk siswa target", async () => {
      const mockPrisma = createMockPrismaFinanceOperations();

      await runWithTenantContext(mockTenantContext, async () => {
        const cat = await createFeeCategory(
          { code: "SPP", name: "SPP Bulanan", amount: 250000 },
          mockPrisma as any
        );

        const result = await bulkCreateStudentCharges(
          {
            studentIds: ["std_001", "std_002"],
            feeCategoryId: cat.id,
            period: "2026-09",
            amount: 250000,
          },
          mockPrisma as any
        );

        assert.strictEqual(result.count, 2);
        assert.strictEqual(result.skippedCount, 0);
        assert.strictEqual(result.createdForStudentIds.length, 2);
      });
    });

    test("harus mencegah duplikasi: melewati siswa yang sudah memiliki tagihan aktif pada periode yang sama", async () => {
      const mockPrisma = createMockPrismaFinanceOperations();

      await runWithTenantContext(mockTenantContext, async () => {
        const cat = await createFeeCategory(
          { code: "SPP", name: "SPP Bulanan", amount: 250000 },
          mockPrisma as any
        );

        // Batch 1: Buat tagihan untuk std_001 dan std_002
        await bulkCreateStudentCharges(
          {
            studentIds: ["std_001", "std_002"],
            feeCategoryId: cat.id,
            period: "2026-09",
            amount: 250000,
          },
          mockPrisma as any
        );

        // Batch 2: Coba buat lagi untuk std_001, std_002, dan std_003
        const result2 = await bulkCreateStudentCharges(
          {
            studentIds: ["std_001", "std_002", "std_003"],
            feeCategoryId: cat.id,
            period: "2026-09",
            amount: 250000,
          },
          mockPrisma as any
        );

        // std_001 dan std_002 harus dilewati (skippedCount: 2), hanya std_003 yang dibuat (count: 1)
        assert.strictEqual(result2.count, 1);
        assert.strictEqual(result2.skippedCount, 2);
        assert.deepStrictEqual(result2.createdForStudentIds, ["std_003"]);
      });
    });

    test("harus menolak pembuatan tagihan jika siswa berasal dari tenant lain (Cross-Tenant Isolation)", async () => {
      const mockPrisma = createMockPrismaFinanceOperations();

      await runWithTenantContext(mockTenantContext, async () => {
        const cat = await createFeeCategory(
          { code: "DAFTAR", name: "Uang Pendaftaran", amount: 500000 },
          mockPrisma as any
        );

        await assert.rejects(
          async () => {
            await bulkCreateStudentCharges(
              {
                studentIds: ["std_other_tenant"],
                feeCategoryId: cat.id,
                amount: 500000,
              },
              mockPrisma as any
            );
          },
          { name: "ChargeError", message: "Tidak ada siswa valid yang ditemukan" }
        );
      });
    });

    test("harus memberikan preview target penagihan dan mendeteksi tagihan eksisting", async () => {
      const mockPrisma = createMockPrismaFinanceOperations();

      await runWithTenantContext(mockTenantContext, async () => {
        const cat = await createFeeCategory(
          { code: "SPP", name: "SPP Bulanan", amount: 200000 },
          mockPrisma as any
        );

        // Tagihkan std_001 terlebih dahulu
        await createStudentCharge(
          {
            studentId: "std_001",
            feeCategoryId: cat.id,
            period: "2026-09",
            amount: 200000,
          },
          mockPrisma as any
        );

        // Jalankan preview untuk rombel cls_7a (std_001 & std_002)
        const preview = await getTargetStudentsForBilling(
          {
            classroomId: "cls_7a",
            feeCategoryId: cat.id,
            period: "2026-09",
          },
          mockPrisma as any
        );

        assert.strictEqual(preview.totalStudents, 2);
        assert.strictEqual(preview.alreadyChargedCount, 1);
        assert.strictEqual(preview.eligibleCount, 1);
        const s1 = preview.students.find((s) => s.id === "std_001");
        const s2 = preview.students.find((s) => s.id === "std_002");
        assert.strictEqual(s1?.isAlreadyCharged, true);
        assert.strictEqual(s2?.isAlreadyCharged, false);
      });
    });

    test("harus menghitung metrik ringkasan penagihan (getBillingSummary)", async () => {
      const mockPrisma = createMockPrismaFinanceOperations();

      await runWithTenantContext(mockTenantContext, async () => {
        const cat = await createFeeCategory(
          { code: "SPP", name: "SPP Bulanan", amount: 300000 },
          mockPrisma as any
        );

        // Tagihan 1: std_001 (Belum jatuh tempo)
        await createStudentCharge(
          {
            studentId: "std_001",
            feeCategoryId: cat.id,
            amount: 300000,
            dueDate: new Date(Date.now() + 86400000 * 5),
          },
          mockPrisma as any
        );

        // Tagihan 2: std_002 (Sudah jatuh tempo / Overdue)
        await createStudentCharge(
          {
            studentId: "std_002",
            feeCategoryId: cat.id,
            amount: 300000,
            dueDate: new Date(Date.now() - 86400000 * 5),
          },
          mockPrisma as any
        );

        const summary = await getBillingSummary(mockPrisma as any);
        assert.strictEqual(summary.totalChargesCount, 2);
        assert.strictEqual(summary.totalChargesAmount, 600000);
        assert.strictEqual(summary.totalOutstandingAmount, 600000);
        assert.strictEqual(summary.overdueCount, 1);
        assert.strictEqual(summary.overdueAmount, 300000);
      });
    });
  });

  describe("2. Cashier Payment Counter & Multi-Charge Allocation", () => {
    test("harus memproses pembayaran kasir multi-tagihan secara atomik", async () => {
      const mockPrisma = createMockPrismaFinanceOperations();

      await runWithTenantContext(mockTenantContext, async () => {
        const cat1 = await createFeeCategory(
          { code: "SPP", name: "SPP", amount: 200000 },
          mockPrisma as any
        );
        const cat2 = await createFeeCategory(
          { code: "SERAGAM", name: "Seragam", amount: 300000 },
          mockPrisma as any
        );

        const ch1 = await createStudentCharge(
          { studentId: "std_001", feeCategoryId: cat1.id, amount: 200000 },
          mockPrisma as any
        );
        const ch2 = await createStudentCharge(
          { studentId: "std_001", feeCategoryId: cat2.id, amount: 300000 },
          mockPrisma as any
        );

        // Bayar sekaligus Rp 500.000 untuk 2 tagihan
        const res = await createPaymentTransaction(
          {
            studentId: "std_001",
            amount: 500000,
            paymentMethod: "CASH",
            allocations: [
              { studentChargeId: ch1.id, amount: 200000 },
              { studentChargeId: ch2.id, amount: 300000 },
            ],
          },
          mockPrisma as any
        );

        assert.ok(res.payment);
        assert.ok(res.receipt);
        assert.strictEqual(res.payment.amount, 500000);

        // Status kedua tagihan harus menjadi PAID
        const freshCh1 = await getStudentCharge(ch1.id, mockPrisma as any);
        const freshCh2 = await getStudentCharge(ch2.id, mockPrisma as any);
        assert.strictEqual(freshCh1.status, "PAID");
        assert.strictEqual(freshCh2.status, "PAID");
      });
    });

    test("harus menolak over-allocation: alokasi melebihi sisa tagihan", async () => {
      const mockPrisma = createMockPrismaFinanceOperations();

      await runWithTenantContext(mockTenantContext, async () => {
        const cat = await createFeeCategory(
          { code: "SPP", name: "SPP", amount: 200000 },
          mockPrisma as any
        );
        const ch = await createStudentCharge(
          { studentId: "std_001", feeCategoryId: cat.id, amount: 200000 },
          mockPrisma as any
        );

        await assert.rejects(
          async () => {
            await createPaymentTransaction(
              {
                studentId: "std_001",
                amount: 300000,
                allocations: [{ studentChargeId: ch.id, amount: 300000 }],
              },
              mockPrisma as any
            );
          },
          { name: "PaymentError" }
        );
      });
    });

    test("harus menolak pembayaran terhadap tagihan berstatus VOID", async () => {
      const mockPrisma = createMockPrismaFinanceOperations();

      await runWithTenantContext(mockTenantContext, async () => {
        const cat = await createFeeCategory(
          { code: "SPP", name: "SPP", amount: 200000 },
          mockPrisma as any
        );
        const ch = await createStudentCharge(
          { studentId: "std_001", feeCategoryId: cat.id, amount: 200000 },
          mockPrisma as any
        );

        await voidStudentCharge(ch.id, mockPrisma as any);

        await assert.rejects(
          async () => {
            await createPaymentTransaction(
              {
                studentId: "std_001",
                amount: 200000,
                allocations: [{ studentChargeId: ch.id, amount: 200000 }],
              },
              mockPrisma as any
            );
          },
          { name: "PaymentError" }
        );
      });
    });
  });

  describe("3. Receipt & Operational Settings Integration", () => {
    test("harus menggunakan prefix kwitansi kustom dari pengaturan operasional lembaga", async () => {
      const mockPrisma = createMockPrismaFinanceOperations();

      const receiptNumber = await generateUniqueReceiptNumber(
        "inst_ops_demo",
        mockPrisma as any
      );

      // Sesuai pre-seed settingsJson: receiptNumberPrefix = "KWT"
      assert.ok(
        receiptNumber.startsWith("KWT-"),
        `Nomor kwitansi [${receiptNumber}] harus berawalan prefix KWT`
      );
    });

    test("harus menyajikan rincian kwitansi lengkap dengan catatan kaki operasional lembaga", async () => {
      const mockPrisma = createMockPrismaFinanceOperations();

      await runWithTenantContext(mockTenantContext, async () => {
        const cat = await createFeeCategory(
          { code: "SPP", name: "SPP Bulanan", amount: 200000 },
          mockPrisma as any
        );
        const ch = await createStudentCharge(
          { studentId: "std_001", feeCategoryId: cat.id, amount: 200000 },
          mockPrisma as any
        );

        const pay = await createPaymentTransaction(
          {
            studentId: "std_001",
            amount: 200000,
            allocations: [{ studentChargeId: ch.id, amount: 200000 }],
          },
          mockPrisma as any
        );

        const details = await getReceiptDetails(pay.payment.id, mockPrisma as any);
        assert.strictEqual(details.institution.name, "Pesantren Bina Insan Mandiri");
        assert.strictEqual(
          details.footerNote,
          "Jazakumullahu khairan atas pembayaran syahriah santri."
        );
        assert.strictEqual(details.paymentTransaction.amount, 200000);
      });
    });
  });

  describe("4. Cashbook Immutability & Operational Mutation", () => {
    test("pembayaran kasir harus otomatis mencatatkan entri buku kas masuk (INCOME)", async () => {
      const mockPrisma = createMockPrismaFinanceOperations();

      await runWithTenantContext(mockTenantContext, async () => {
        const cat = await createFeeCategory(
          { code: "SPP", name: "SPP", amount: 150000 },
          mockPrisma as any
        );
        const ch = await createStudentCharge(
          { studentId: "std_001", feeCategoryId: cat.id, amount: 150000 },
          mockPrisma as any
        );

        await createPaymentTransaction(
          {
            studentId: "std_001",
            amount: 150000,
            allocations: [{ studentChargeId: ch.id, amount: 150000 }],
          },
          mockPrisma as any
        );

        const cashEntries = await listCashbookEntries({}, mockPrisma as any);
        assert.strictEqual(cashEntries.total, 1);
        assert.strictEqual(cashEntries.items[0].type, "INCOME");
        assert.strictEqual(cashEntries.items[0].amount, 150000);
        assert.ok(cashEntries.items[0].paymentTransactionId);
      });
    });

    test("bendahara dapat mencatat pengeluaran operasional (EXPENSE) secara manual", async () => {
      const mockPrisma = createMockPrismaFinanceOperations();

      await runWithTenantContext(mockTenantContext, async () => {
        const entry = await createCashbookEntry(
          {
            type: "EXPENSE",
            amount: 75000,
            description: "Beli spidol whiteboard",
          },
          mockPrisma as any
        );

        assert.strictEqual(entry.type, "EXPENSE");
        assert.strictEqual(entry.amount, 75000);
      });
    });
  });

  describe("5. Financial Operational Reports Aggregations", () => {
    test("harus mengagregasi rekap penerimaan kasir dan breakdown komponen biaya", async () => {
      const mockPrisma = createMockPrismaFinanceOperations();

      await runWithTenantContext(mockTenantContext, async () => {
        const cat = await createFeeCategory(
          { code: "SPP", name: "SPP", amount: 200000 },
          mockPrisma as any
        );
        const ch = await createStudentCharge(
          { studentId: "std_001", feeCategoryId: cat.id, amount: 200000 },
          mockPrisma as any
        );

        await createPaymentTransaction(
          {
            studentId: "std_001",
            amount: 200000,
            paymentMethod: "CASH",
            allocations: [{ studentChargeId: ch.id, amount: 200000 }],
          },
          mockPrisma as any
        );

        const report = await getPaymentSummaryReport({}, mockPrisma as any);
        assert.strictEqual(report.totalTransactions, 1);
        assert.strictEqual(report.totalAmount, 200000);
        assert.strictEqual(report.byMethod[0].method, "CASH");
        assert.strictEqual(report.byCategory[0].name, "SPP");
      });
    });

    test("harus menyajikan laporan arus kas operasional (inflow, outflow, netBalance)", async () => {
      const mockPrisma = createMockPrismaFinanceOperations();

      await runWithTenantContext(mockTenantContext, async () => {
        // Pemasukan 300.000
        await createCashbookEntry(
          { type: "INCOME", amount: 300000, description: "Donasi umum" },
          mockPrisma as any
        );
        // Pengeluaran 100.000
        await createCashbookEntry(
          { type: "EXPENSE", amount: 100000, description: "Konsumsi rapat" },
          mockPrisma as any
        );

        const report = await getCashflowReport({}, mockPrisma as any);
        assert.strictEqual(report.totalIncome, 300000);
        assert.strictEqual(report.totalExpense, 100000);
        assert.strictEqual(report.netBalance, 200000);
      });
    });

    test("harus menolak akses laporan dari pengguna tanpa izin finance:view", async () => {
      const mockPrisma = createMockPrismaFinanceOperations();

      await runWithTenantContext(mockTeacherContext, async () => {
        await assert.rejects(
          async () => {
            await getPaymentSummaryReport({}, mockPrisma as any);
          },
          { name: "AuthorizationError" }
        );
      });
    });
  });
});
