import { NotificationTemplateKey } from "../validation/notification";

export function renderNotificationMessage(
  templateKey: NotificationTemplateKey,
  payload: Record<string, string | number | boolean | null>
): string {
  switch (templateKey) {
    case "PAYMENT_RECEIPT": {
      const studentName = payload.studentName || "Siswa";
      const receiptNo = payload.receiptNo || "-";
      const amount = payload.amount ? `Rp ${Number(payload.amount).toLocaleString("id-ID")}` : "Rp 0";
      const paymentDate = payload.paymentDate || new Date().toLocaleDateString("id-ID");
      const category = payload.categoryName || "Pembayaran";

      return `[NataSekolah] KWITANSI PEMBAYARAN REGULER\n\n` +
        `Yth. Wali dari ${studentName},\n` +
        `Terima kasih, pembayaran telah kami terima dengan rincian:\n\n` +
        `• No. Kwitansi: ${receiptNo}\n` +
        `• Jenis Pos: ${category}\n` +
        `• Jumlah: ${amount}\n` +
        `• Tanggal: ${paymentDate}\n\n` +
        `Bukti pembayaran sah ini diterbitkan secara otomatis oleh sistem NataSekolah.`;
    }

    case "ATTENDANCE_ALERT": {
      const studentName = payload.studentName || "Siswa";
      const status = payload.status || "ALPA";
      const date = payload.date || new Date().toLocaleDateString("id-ID");
      const subject = payload.subjectName ? ` (Mata Pelajaran: ${payload.subjectName})` : "";
      const statusText =
        status === "ABSENT" || status === "ALPA"
          // eslint-disable-next-line antislop/no-slop-words
          ? "TIDAK HADIR (ALPA)"
          : status === "SICK"
          ? "SAKIT"
          : "IZIN";

      return `[NataSekolah] PEMBERITAHUAN KEHADIRAN SISWA\n\n` +
        `Yth. Wali dari ${studentName},\n` +
        `Diberitahukan bahwa putra/putri Anda tercatat ${statusText} pada tanggal ${date}${subject}.\n\n` +
        `Apabila ada kekeliruan atau permohonan izin resmi, mohon menghubungi pihak sekolah/madrasah.`;
    }

    case "GUARDIAN_INVITE": {
      const guardianName = payload.guardianName || "Bapak/Ibu";
      const studentName = payload.studentName || "Siswa";
      const inviteUrl = payload.inviteUrl || "#";

      return `[NataSekolah] UNDANGAN AKTIVASI AKUN WALI MURID\n\n` +
        `Assalamu'alaikum Wr. Wb. Yth. ${guardianName},\n` +
        `Anda diundang untuk mengaktifkan portal wali murid NataSekolah bagi siswa ${studentName}.\n\n` +
        `Klik tautan di bawah untuk aktivasi (berlaku 72 jam):\n` +
        `${inviteUrl}\n\n` +
        `Terima kasih.`;
    }

    case "ANNOUNCEMENT": {
      const title = payload.title || "Pengumuman Sekolah";
      const body = payload.body || "";

      return `[NataSekolah] ${title}\n\n${body}`;
    }

    case "CUSTOM_ALERT":
    default: {
      return (payload.message as string) || "Pemberitahuan dari NataSekolah.";
    }
  }
}
