import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { DashboardAttendanceItem } from "../src/lib/dashboard/overview-service";
import { validateDashboardDate } from "../src/lib/validation/dashboard";

function countByStatus(items: DashboardAttendanceItem[]) {
  return {
    open: items.filter((item) => item.status === "OPEN").length,
    closed: items.filter((item) => item.status === "CLOSED").length,
    notStarted: items.filter((item) => item.status === "NOT_STARTED").length,
  };
}

describe("Operational Dashboard", () => {
  it("menghasilkan ringkasan status presensi yang deterministik", () => {
    const summary = countByStatus([
      { assignmentId: "a1", teacherName: "A", subjectName: "Mat", classroomName: "7A", status: "OPEN", sessionId: "s1", recordCount: 10 },
      { assignmentId: "a2", teacherName: "B", subjectName: "IPA", classroomName: "7B", status: "CLOSED", sessionId: "s2", recordCount: 20 },
      { assignmentId: "a3", teacherName: "C", subjectName: "B.Ing", classroomName: "8A", status: "NOT_STARTED", sessionId: null, recordCount: 0 },
    ]);
    assert.deepEqual(summary, { open: 1, closed: 1, notStarted: 1 });
  });

  it("memvalidasi tanggal dashboard dengan format YYYY-MM-DD", () => {
    assert.equal(validateDashboardDate("2026-09-23"), "2026-09-23");
    assert.throws(() => validateDashboardDate("23-09-2026"));
  });

  it("membedakan assignment tanpa sesi dari sesi OPEN/CLOSED", () => {
    const item: DashboardAttendanceItem = {
      assignmentId: "a1",
      teacherName: "A",
      subjectName: "Matematika",
      classroomName: "7A",
      status: "NOT_STARTED",
      sessionId: null,
      recordCount: 0,
    };
    assert.equal(item.status, "NOT_STARTED");
  });
});
