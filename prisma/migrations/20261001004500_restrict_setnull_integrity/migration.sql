-- Ubah aksi referensial 3 relasi FK komposit dari SetNull menjadi Restrict.
--
-- Alasan: ketiga FK ini ikut memuat "institutionId" yang WAJIB not-null
-- (penjaga tenant isolation). ON DELETE SET NULL pada kolom not-null akan
-- gagal di tingkat database (atau berpotensi membiarkan baris tanpa tenant).
-- Prisma juga memperingatkan hal ini (3 warning "referenced field is required").
--
-- Pilihan Restrict (bukan Cascade) sejalan dengan prinsip "histori data suci":
-- AcademicYear / PaymentTransaction / User penerbit tidak boleh dihapus selama
-- masih dirujuk. Kode aplikasi sendiri tidak melakukan hard delete pada ketiga
-- induk tersebut, jadi tidak ada alur yang terganggu.
--
-- Induk yang dilindungi:
--   student_charges.academicYearId  -> AcademicYear
--   cashbook_entries.paymentTransactionId -> PaymentTransaction
--   report_cards.publishedById      -> User (penerbit rapor)

-- DropForeignKey
ALTER TABLE "student_charges" DROP CONSTRAINT "student_charges_academicYearId_institutionId_fkey";

-- DropForeignKey
ALTER TABLE "cashbook_entries" DROP CONSTRAINT "cashbook_entries_paymentTransactionId_institutionId_fkey";

-- DropForeignKey
ALTER TABLE "report_cards" DROP CONSTRAINT "report_cards_publishedById_institutionId_fkey";

-- AddForeignKey
ALTER TABLE "student_charges" ADD CONSTRAINT "student_charges_academicYearId_institutionId_fkey" FOREIGN KEY ("academicYearId", "institutionId") REFERENCES "AcademicYear"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashbook_entries" ADD CONSTRAINT "cashbook_entries_paymentTransactionId_institutionId_fkey" FOREIGN KEY ("paymentTransactionId", "institutionId") REFERENCES "payment_transactions"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_publishedById_institutionId_fkey" FOREIGN KEY ("publishedById", "institutionId") REFERENCES "User"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;
