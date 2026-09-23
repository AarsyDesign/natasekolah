# Architecture Decision Records (ADR) - NataSekolah

## ADR-001: Pemilihan PostgreSQL dan Prisma ORM
* **Status:** Diterima (Accepted)
* **Konteks:** NataSekolah membutuhkan penyimpanan data relasional yang kokoh untuk mendukung multi-tenancy, integritas transaksi finansial (SPP), dan data historis siswa yang tidak boleh tertimpa.
* **Keputusan:** Menggunakan PostgreSQL sebagai basis data utama dan Prisma sebagai ORM untuk menjamin *type safety* ujung-ke-ujung (end-to-end) dan migrasi skema yang terkelola.
* **Konsekuensi:** Skema relasional yang ketat membutuhkan perencanaan cermat untuk compound key dan relasi tenant, namun mencegah korupsi data kesiswaan di masa depan.

---

## ADR-002: Isolasi Multi-Tenancy Berbasis Baris (Row-Level Multi-Tenancy)
* **Status:** Diterima (Accepted)
* **Konteks:** NataSekolah melayani ratusan institusi (sekolah formal, pondok pesantren, rumah tahfidz, PKBM) dalam satu platform terpusat.
* **Keputusan:** Menggunakan pola *Shared Process, Shared Database, Isolated by Row*. Setiap tabel operasional menyertakan `institutionId` yang diisolasi di tingkat logika aplikasi dan query database.
* **Konsekuensi:** Lebih efisien dalam pemanfaatan sumber daya server dibanding skema terpisah, namun menuntut disiplin mutlak agar tidak ada query yang bocor tanpa filter `institutionId`.

---

## ADR-003: Model Historis Penempatan Siswa (Sacred History)
* **Status:** Diterima (Accepted)
* **Konteks:** Di sekolah dan pesantren, siswa berpindah kelas setiap tahun ajaran, mutasi, atau lulus. Model data konvensional sering menimpa `classroomId` langsung di tabel `Student`, menghancurkan riwayat akademik masa lalu.
* **Keputusan:** Entitas `Student` dilarang keras menyimpan `classroomId` langsung. Penempatan kelas dilakukan melalui tabel persimpangan historis `Enrollment` dengan constraint unik `@@unique([studentId, academicYearId])`.
* **Konsekuensi:** Query penempatan kelas saat ini membutuhkan *join* ke tabel `Enrollment`, namun menjamin integritas rekam jejak santri dari kelas 7 hingga lulus tetap utuh.

---

## ADR-004: Pola Outbox Terpadu untuk Notifikasi WhatsApp
* **Status:** Diterima (Accepted)
* **Konteks:** WhatsApp API pihak ketiga rentan terhadap kegagalan jaringan, *rate limiting*, dan *timeout*. Pengiriman pesan secara langsung pada alur request utama dapat memblokir proses bisnis dan memicu duplikasi kwitansi/pesan.
* **Keputusan:** Menerapkan *Outbox Pattern* (`NotificationOutbox`). Event notifikasi ditulis dalam transaksi database yang sama dengan mutasi bisnis (misal pembayaran kasir), lalu diproses secara asinkron oleh worker berlatar belakang.
* **Konsekuensi:** Membutuhkan worker scheduler tambahan, namun memberikan jaminan keandalan (*at-least-once delivery*) dan membebaskan antarmuka pengguna dari *latency* pihak ketiga.

---

## ADR-005: Integritas Transaksi Keuangan Tanpa Hard Delete
* **Status:** Diterima (Accepted)
* **Konteks:** Pembatalan transaksi pembayaran di kasir berisiko memicu kecurangan (fraud) jika data dapat dihapus begitu saja dari basis data.
* **Keputusan:** Transaksi finansial tidak boleh di-hard delete. Setiap koreksi dilakukan melalui status `VOID` atau transaksi pembalik (`REVERSAL`), dan seluruh aktivitas dicatat ke dalam `AuditLog`.
* **Konsekuensi:** Volume data transaksi bertambah, namun audit finansial dan akuntabilitas bendahara terjamin 100%.

---

## ADR-006: Sesi Terautentikasi Berbasis Cookie HttpOnly dengan Token Acak Ter-hash
* **Status:** Diterima (Accepted)
* **Konteks:** Sistem membutuhkan mekanisme autentikasi multi-tenant yang aman dari serangan XSS dan CSRF, serta mendukung pemutusan sesi instan (session revocation).
* **Keputusan:**
  1. Menggunakan token acak 256-bit kriptografis aman (`crypto.randomBytes(32)`).
  2. Browser hanya menerima raw token melalui cookie `HttpOnly`, `Secure`, `SameSite=Lax` dengan nama `natasekolah_session`.
  3. Basis data hanya menyimpan nilai hash SHA-256 dari token (`tokenHash`), menjamin jika database bocor, penyerang tidak dapat langsung membajak sesi aktif.
  4. Masa berlaku sesi ditetapkan 7 hari dengan pembaruan `lastUsedAt` berkala.
* **Konsekuensi:** Query database diperlukan saat validasi sesi pertama kali, namun memberikan kontrol penuh terhadap pencabutan sesi (*instant revocation*) dan perlindungan keamanan maksimal.

---

## ADR-007: Isolasi Konteks Institusi via Node.js AsyncLocalStorage
* **Status:** Diterima (Accepted)
* **Konteks:** Memastikan `institutionId` terikat secara otomatis pada alur eksekusi tanpa bergantung pada kiriman parameter dari klien yang rawan dipalsukan.
* **Keputusan:** Menggunakan `AsyncLocalStorage` untuk mengalirkan `TenantContext` di seluruh lapisan layanan, dan menegakkan fungsi penjaga `enforceTenantFilter()` serta `assertTenantAccess()`.
* **Konsekuensi:** Memerlukan pembungkusan alur eksekusi di middleware atau route handler, namun mencegah secara mutlak celah kebocoran konteks antar-request (*cross-tenant context bleeding*).

---

## ADR-008: Dual-Track Identity Model (Internal User vs Guardian)
* **Status:** Diterima (Accepted)
* **Konteks:** Pengguna internal lembaga (Ustadz, Guru, Admin TU) memiliki hak operasional berdasarkan peran (**RBAC**), sementara Wali Murid hanya berhak mengakses data santri asuhnya berdasarkan hubungan perwalian yang sah (**ReBAC**). Menggabungkan wali ke dalam tabel staf atau memberi peran `PARENT` di RBAC merusak prinsip pemisahan hak akses dan menimbulkan risiko eskalasi hak istimewa.
* **Keputusan:**
  1. Memisahkan tabel profil `User` (staf/guru) dan `Guardian` (wali murid).
  2. Menyatukan autentikasi sesi dalam model `Session` tunggal dengan pembeda `subjectType` (`INTERNAL_USER` vs `GUARDIAN`) yang dijaga invariant ketat (`userId` xor `guardianId`).
  3. Relasi wali dan santri diatur via tabel `GuardianStudent` dengan compound foreign key `[id, institutionId]` untuk mencegah hubungan bersilang lintas-lembaga.
  4. Pengenalan akun wali menggunakan token undangan 1x pakai (`GuardianInvitation`) yang dikirim via WhatsApp.
* **Konsekuensi:** Desain arsitektur sangat bersih dan aman, mencegah wali murid mengeksekusi fitur operasional staf, dan memungkinkan wali memantau banyak santri di satu lembaga secara terisolasi.

---

## ADR-009: Fine-Grained Role-Based Access Control (RBAC) untuk Internal Lembaga
* **Status:** Diterima (Accepted)
* **Konteks:** Lembaga pendidikan NataSekolah membutuhkan pembagian kewenangan yang jelas antara pimpinan yayasan, kepala sekolah, operator administrasi, guru kelas/pengajar, dan staf keuangan agar tidak terjadi tumpang tindih otorisasi.
* **Keputusan:**
  1. **6 Peran Resmi:** Membatasi peran staf internal pada 6 peran baku: `SUPER_ADMIN`, `FOUNDATION_HEAD`, `PRINCIPAL`, `ADMIN`, `TEACHER`, dan `FINANCE_STAFF`.
  2. **Central Typed Permission Matrix:** Menggunakan TypeScript typed constants (`ROLES`, `PERMISSIONS`, `ROLE_PERMISSIONS`) sebagai *single source of truth* tanpa premature dynamic RBAC database tables.
  3. **Otorisasi Server-Side:** Menyediakan API terpadu `hasPermission(session, perm)`, `requirePermission(session, perm)`, `hasRole(session, role)`, dan `requireRole(session, role)` yang beroperasi langsung di atas `ValidatedSessionPayload` / `TenantContext`.
  4. **Strict Authorization Order:** RBAC tidak pernah meniadakan isolasi tenant. Urutan evaluasi wajib: $\text{Session} \rightarrow \text{Tenant} \rightarrow \text{RBAC} \rightarrow \text{Domain Access}$.
  5. **No Super Admin Global Bypass:** `SUPER_ADMIN` tidak memiliki bypass diam-diam (`if (role === 'SUPER_ADMIN') return true`). Seluruh izin platform didefinisikan eksplisit dalam `ROLE_PERMISSIONS.SUPER_ADMIN` dan tetap tunduk pada tenant boundary.
  6. **Teacher Assignment Boundary:** Izin peran guru (`TEACHER`) mencakup `academic:view` dan `attendance:manage`, namun pembatasan kelas/santri riil ditegakkan pada domain layer via *Teacher Assignment*.
  7. **Guardian Total Exclusion:** Sesi `GUARDIAN` secara instan ditolak (403 Forbidden) jika mencoba memanggil guard RBAC staf internal.
* **Konsekuensi:** Model otorisasi sangat cepat, type-safe saat kompilasi, kebal terhadap manipulasi klien (*anti-tampering*), dan menjaga kejelasan batas antara peran staf, penugasan guru, dan akses wali santri.

---

## ADR-010: Input Validation Boundary with Zod and Toggleable Domain Plugin Registry
* **Status:** Diterima (Accepted)
* **Konteks:** Menjelang dimulainya Phase 1 (Master Data Engine), aplikasi membutuhkan standarisasi validasi data masukan dari klien agar bebas dari serangan injeksi dan unbounded data, serta membutuhkan arsitektur plugin domain fleksibel yang membedakan fitur Core dari fitur khusus institusi (Formal vs Pesantren vs Tahfidz vs PKBM).
* **Keputusan:**
  1. **Central Zod Validation:** Menggunakan library tunggal `zod` untuk memvalidasi request body, form input, dan query filter di lapisan terluar (`src/lib/validation/*`).
  2. **Pemisahan Validasi vs Otorisasi:** Zod hanya memvalidasi bentuk data (*syntactic & structural correctness*). Validasi lolos tidak berarti pengguna berhak mengeksekusi operasi.
  3. **Pembersihan Atribut Keamanan (Anti-Tampering):** Input sanitizer `sanitizeClientInput()` secara aktif membuang field `institutionId`, `userId`, `guardianId`, `role`, `roles`, `permissions`, dan `isSuperAdmin` dari payload request klien, menjamin otoritas keamanan hanya berasal dari server session.
  4. **Unified Core vs Toggleable Domain Plugins:** Fitur inti (Multi-tenancy, Auth, Buku Induk, SPP Dasar, Presensi Cepat, Outbox) selalu aktif tanpa dependensi plugin. Fitur domain (`FORMAL_ACADEMIC`, `PESANTREN_LIVING`, `TAHFIDZ`, `PKBM`) diaktifkan per institusi via kolom `Institution.enabledPlugins`.
  5. **Rantai Evaluasi Otorisasi 5 Tingkat:**
     $$\text{Zod Input Validation} \longrightarrow \text{Session} \longrightarrow \text{Tenant Isolation} \longrightarrow \text{RBAC} \longrightarrow \text{Plugin Guard} \longrightarrow \text{Domain Resource}$$
* **Konsekuensi:** Input aplikasi selalu bersih, aman, dan bertipe kuat (*strongly-typed*). Lembaga sekolah umum tidak akan terbebani modul asrama pondok, dan pondok pesantren salafiyah tidak terbebani modul kurikulum nasional, dengan integritas tenant dan RBAC yang tetap solid.

---

## ADR-011: Sacred History Enrollment Engine and Independent Student Master Data
* **Status:** Diterima (Accepted)
* **Konteks:** Pada Phase 1 (Buku Induk & Academic Core), data siswa harus dikelola dengan integritas historis yang utuh. Menghubungkan siswa langsung ke `Classroom` via `Student.classroomId` akan menghancurkan riwayat akademik masa lalu setiap kali siswa naik kelas, mutasi, atau lulus.
* **Keputusan:**
  1. **Student Identity is Independent from Classroom Membership:** Model `Student` berdiri sendiri sebagai master identitas primer Buku Induk tanpa atribut `classroomId`.
  2. **Enrollment as Single Source of Truth:** Penempatan kelas, kenaikan kelas, dan kelulusan dicatat secara eksklusif dalam entitas `Enrollment` dengan constraint `@@unique([studentId, academicYearId])`.
  3. **Compound Relational Keys Hardening:** Menggunakan compound foreign keys pada level PostgreSQL:
     - `Student`: `@@unique([id, institutionId])` dan `@@unique([institutionId, nis])`.
     - `AcademicYear`: `@@unique([id, institutionId])` dan `@@unique([institutionId, name])`.
     - `Classroom`: `@@unique([id, institutionId])`, `@@unique([id, academicYearId, institutionId])`, dan `@@unique([institutionId, academicYearId, name])`.
     - `Enrollment`: Menautkan `[studentId, institutionId]`, `[academicYearId, institutionId]`, dan `[classroomId, academicYearId, institutionId]`.
  4. **Single Active Academic Year Invariant:** Satu institusi hanya boleh memiliki maksimal satu tahun ajaran dengan `isActive: true`. Pengaktifan tahun baru secara atomik menonaktifkan tahun lama via Prisma transaction.
* **Konsekuensi:** Terjamin 100% secara matematis dan relasional bahwa riwayat kelas masa lalu tidak pernah hilang saat santri naik kelas, tidak terjadi kebocoran rombel lintas-lembaga, dan rombel pada enrollment dipastikan berada pada tahun ajaran yang sah.

---

## ADR-012: Teacher Teaching Assignment and Teaching Scope Architecture
* **Status:** Diterima (Accepted)
* **Konteks:** Pada Phase 2 (Academic Teaching Core), sistem harus mengetahui guru siapa mengajar mata pelajaran apa, di rombel mana, dan pada tahun ajaran mana. Fondasi ini nantinya akan digunakan oleh absensi harian, nilai, ujian, jurnal mengajar, raport, jadwal pelajaran, dan analitika akademik. Diperlukan kepastian model identitas guru, struktur penugasan, integritas histori akademik, serta batasan otorisasi data (*resource scope*).
* **Keputusan:**
  1. **Teacher Identity Derived from Internal User Model:** Tenaga pendidik (Guru/Asatidz) tidak memiliki tabel login atau otentikasi terpisah. Guru adalah pengguna internal lembaga yang direpresentasikan oleh model `User` dengan peran `TEACHER` di dalam institusi aktif.
  2. **Teaching Scope Derived from TeacherAssignment:** Model `TeacherAssignment` memetakan hubungan kuartet akademik:
     $$\text{Teacher (User)} \times \text{Subject} \times \text{Classroom} \times \text{AcademicYear}$$
     dengan constraint unik `@@unique([teacherId, subjectId, classroomId, academicYearId])`.
  3. **Compound Relational Constraints Hardening:** Seluruh relasi `TeacherAssignment` dilindungi oleh compound keys di tingkat basis data PostgreSQL:
     - `[teacherId, institutionId] -> User([id, institutionId])`
     - `[subjectId, institutionId] -> Subject([id, institutionId])`
     - `[academicYearId, institutionId] -> AcademicYear([id, institutionId])`
     - `[classroomId, academicYearId, institutionId] -> Classroom([id, academicYearId, institutionId])`
     Constraint ini secara fisik menggagalkan upaya penugasan guru lintas lembaga, mapel lintas lembaga, dan ketidakcocokan tahun ajaran rombel (*academic year mismatch*).
  4. **Historical Assignment Integrity:** Penugasan terikat pada `AcademicYear` sehingga rekam jejak mengajar guru masa lalu tersimpan abadi dan tidak tertimpa saat semester atau tahun ajaran berganti.
  5. **Resource Scope Authorization Enforcement:** Pengguna dengan peran `TEACHER` murni secara otomatis hanya dapat melihat dan mengakses penugasan miliknya sendiri (`teacherId = session.userId`). Guru dilarang melihat penugasan guru lain kecuali memiliki izin administratif `academic:manage`. Pembuatan, pembaruan, dan pembatalan penugasan wajib memiliki izin `academic:manage`.
* **Konsekuensi:** Tidak ada fragmentasi akun bagi staf yang merangkap guru, integritas multi-tenant terjamin di tingkat database constraint, riwayat pengajaran aman dari modifikasi destruktif, dan resource scope guru terisolasi dengan aman.

---

## ADR-013: Attendance Historical Integrity via Enrollment and Immutability of Closed Sessions
* **Status:** Diterima (Accepted)
* **Konteks:** Pada Phase 3 (Attendance Core), sistem absensi harian dibangun di atas `TeacherAssignment` dan `Enrollment`. Absensi siswa bukan sekadar status langsung di entitas `Student` (seperti `Student.attendanceStatus`), melainkan data transaksional historis. Diperlukan jaminan bahwa rekam jejak absensi tetap menunjuk pada enrollment yang sah saat absensi dibuat, serta sesi absensi yang telah ditutup tidak dapat diubah-ubah secara retroaktif.
* **Keputusan:**
  1. **Absensi Sebagai Data Transaksional, Bukan Status Statis Siswa:**
     Absensi dimodelkan secara berjenjang:
     $$\text{TeacherAssignment} \longrightarrow \text{AttendanceSession} \longrightarrow \text{AttendanceRecord} \longrightarrow \text{Student / Enrollment}$$
     Entitas `Student` dilarang menyimpan status kehadiran langsung.
  2. **Dual-Key Pointer di AttendanceRecord:**
     `AttendanceRecord` menyimpan `studentId` DAN `enrollmentId` sekaligus. Hal ini menjamin rekam jejak absensi tetap terikat pada histori akademik siswa pada rombel dan tahun ajaran saat itu, meskipun di masa depan siswa naik kelas atau mutasi ke rombel lain.
  3. **One Session per Assignment per Day:**
     Satu penugasan guru hanya boleh memiliki maksimal 1 sesi absensi per tanggal kalender akademik (`@@unique([teacherAssignmentId, attendanceDate])`). Tanggal dinormalkan ke UTC midnight untuk mencegah kesalahan pergeseran zona waktu.
  4. **Strict Enrollment-Derived Roster:**
     Daftar siswa (roster) diturunkan secara eksklusif dari pendaftaran aktif siswa (`Enrollment.status = "ENROLLED"`, `Student.status = "ACTIVE"`) pada rombel dan tahun ajaran penugasan. Siswa dari rombel lain, tahun ajaran lain, atau tenant lain ditolak keras (`InvalidAttendanceContextError`).
  5. **Immutability of Closed Sessions (CLOSED = Kekal):**
     Setelah `AttendanceSession.status = CLOSED`, seluruh operasi penulisan/pembaruan rekaman kehadiran ditolak secara permanen (`AttendanceSessionClosedError`). Sesi hanya dapat ditutup jika seluruh siswa eligible dalam rombel telah memiliki catatan kehadiran (`AttendanceIncompleteError`). Rekaman sesi CLOSED tetap dapat dibaca untuk histori dan audit.
  6. **Teacher Resource-Scope Authorization:**
     Guru (`TEACHER`) hanya berhak melihat, membuka, mengisi, dan menutup sesi untuk `TeacherAssignment` miliknya sendiri (`assignment.teacherId = session.userId`). Guru dilarang keras mengakses atau memodifikasi absensi guru lain (`AttendanceAccessDeniedError`). Admin dan Kepala Sekolah (`academic:manage` / `attendance:manage`) berhak mengakses seluruh sesi dalam tenant.
* **Konsekuensi:** Histori kehadiran siswa tersimpan abadi dan dapat dipertanggungjawabkan, bebas dari korupsi data historis kenaikan kelas, kebal dari manipulasi retroaktif setelah sesi ditutup, serta tenant isolation dan teacher scope terlindungi di seluruh lapisan sistem.

---

## ADR-014: Financial Historical Data Integrity and Dynamic Calculated Balances
* **Status:** Diterima (Accepted)
* **Konteks:** Pada Phase 4 (Finance Core), sistem mengelola iuran sekolah/pesantren, kewajiban pembayaran siswa (`StudentCharge`), transaksi penerimaan kasir (`PaymentTransaction`), alokasi pembayaran (`PaymentAllocation`), Buku Kas Umum (`CashbookEntry`), dan kwitansi (`Receipt`). Seringkali sistem keuangan menyimpan saldo atau total tunggakan secara mutable pada tabel `Student` atau `Institution`. Hal ini berisiko tinggi memicu *race condition*, ketidakcocokan saldo, dan manipulasi data.
* **Keputusan:**
  1. **Balance is NOT Source of Truth:** Saldo atau total sisa tagihan **dilarang disimpan sebagai kolom mutable** pada `Student` atau `Institution`. Saldo selalu dihitung secara dinamis dari transaksi:
     $$\text{Balance} = \sum \text{StudentCharge.amount} - \sum \text{PaymentAllocation.amount}$$
  2. **Historical Snapshot Amount on StudentCharge:**
     Ketika `StudentCharge` dibuat dari `FeeCategory`, nominal `amount` pada `StudentCharge` dibekukan sebagai *historical snapshot*. Perubahan nominal pada master `FeeCategory` tidak akan menimpa tagihan historis yang sudah dibuat sebelumnya.
  3. **Atomic Multi-Entity Payment Orchestration:**
     Setiap pembayaran kasir dialokasikan secara atomis menggunakan transaksi Prisma (`$transaction`). Pembuatan `PaymentTransaction`, `PaymentAllocation`, pembaruan status `StudentCharge` (`UNPAID` $\rightarrow$ `PARTIAL` $\rightarrow$ `PAID`), pencatatan `CashbookEntry` bertipe `INCOME`, dan penerbitan `Receipt` dieksekusi sebagai unit kerja tunggal. Kegagalan pada salah satu entitas akan membatalkan seluruh rangkaian transaksi (*atomic rollback*).
  4. **Financial Immutability and No Hard Delete:**
     Data transaksi pembayaran (`PaymentTransaction`) dan kwitansi (`Receipt`) tidak menyediakan alur `DELETE` atau arbitrary `EDIT`. Koreksi transaksi di masa mendatang dilakukan melalui mekanisme pembatalan `VOID` atau `REVERSAL`.
  5. **Sequential Atomic Receipt & Number Generation:**
     Nomor kwitansi (`KW-YYYYMM-XXXXXX`), nomor transaksi (`TRX-YYYYMM-XXXXXX`), dan nomor BKU (`CSH-YYYYMM-XXXXXX`) dihasilkan secara atomis berbasis urutan tanggal dan tenant ID, mencegah *race condition* dan duplikasi nomor.
* **Konsekuensi:** Integritas keuangan lembaga terjamin 100%, saldo bebas dari korupsi data akibat *race condition*, audit kasir akurat, dan kepatuhan multi-tenant terlindungi ketat.

---

## ADR-015: Formal Academic Core, Assessment Scoring and Frozen Report Card Snapshot
* **Status:** Diterima (Accepted)
* **Konteks:** Pada Formal Academic Core, sistem mencatat rencana penilaian akademik (`Assessment`), penilaian berbasis roster kesiswaan (`AssessmentScore`), kalkulasi agregasi nilai akhir per mata pelajaran, dan buku raport siswa (`ReportCard`). Sistem raport konvensional seringkali melakukan live query terhadap nilai yang terus berubah. Masalah timbul ketika raport telah diserahkan kepada orang tua, namun di kemudian hari guru mengubah nilai tugas lampau atau siswa berpindah kelas/tahun ajaran, menyebabkan isi raport berubah secara retroaktif tanpa jejak.
* **Keputusan:**
  1. **Assessment Bound to Quartet TeacherAssignment:**
     Penilaian akademik tidak berdiri bebas, melainkan terikat pada `TeacherAssignment`. Guru (`TEACHER`) hanya berhak membuat assessment dan menginput nilai untuk rombel dan mapel yang ditugaskan kepadanya.
  2. **Strict Enrollment-Derived Grading:**
     Pencatatan nilai siswa (`AssessmentScore`) wajib memverifikasi pendaftaran aktif siswa (`Enrollment`) pada rombel dan tahun ajaran penugasan. Upaya menginput nilai siswa luar rombel ditolak keras.
  3. **Two-Stage Report Card Lifecycle (DRAFT vs PUBLISHED):**
     - `DRAFT`: Nilai dihitung secara dinamis dari seluruh assessment yang tersedia. Digunakan selama proses review dan koreksi oleh guru/wali kelas.
     - `PUBLISHED`: Raport diterbitkan resmi dan dibekukan.
  4. **Frozen Historical Snapshot (Immutable Published Report):**
     Saat berstatus `PUBLISHED`, seluruh informasi murid, rombel, tahun ajaran, semester, nilai per mata pelajaran, predikat, dan rekap kehadiran dibekukan ke dalam kolom `frozenData` (JSON snapshot). Operasi pembacaan raport terbit selalu mengutamakan `frozenData`. Nilai raport yang sudah terbit dijamin 100% tidak akan pernah berubah meskipun nilai assessment diubah atau dihapus di kemudian hari.
  5. **No Duplicate Publication:**
     Raport yang sudah berstatus `PUBLISHED` ditolak secara permanen jika dicoba untuk diterbitkan ulang (`ReportCardAlreadyPublishedError`).
* **Konsekuensi:** Akuntabilitas nilai akademik dan rekam jejak raport siswa terjamin secara permanen dan sah secara hukum/institusional, bebas dari korupsi data akibat perubahan nilai masa lalu, dan kepatuhan multi-tenant terlindungi di seluruh tingkatan.

---

## ADR-016: Pesantren & Tahfidz Living Core, Mutaba'ah Enrollment Integrity, and Single Attendance Engine
* **Status:** Diterima (Accepted)
* **Konteks:** Pada Phase 6 (Pesantren & Tahfidz Living Core), platform membutuhkan modul mata pelajaran kepesantrenan (diniyah, kitab kuning), mutaba'ah tahfidz Al-Qur'an harian, manajemen asrama (gedung, kamar, kapasitas, dan riwayat penempatan), serta presensi asrama santri. Terdapat godaan umum dalam pengembangan software untuk menduplikasi tabel mata pelajaran, menyimpan penempatan kamar langsung di kolom siswa (`Student.roomId`), atau membangun mesin absensi kedua khusus asrama yang terpisah dari absensi sekolah.
* **Keputusan:**
  1. **Backward-Compatible Subject Category Extension:**
     Mata pelajaran diniyah, kitab, tahsin, tajwid, fiqih, dll. diintegrasikan langsung pada model `Subject` yang ada menggunakan nilai kategori baru (`DINIAH`, `KITAB`, `TAHSIN`, `TAJWID`, `AKHLAQ`, `FIQIH`, `AQIDAH`, `HADITS`, `LAINNYA`), tanpa membuat tabel `PesantrenSubject` duplikat.
  2. **Tahfidz Mutaba'ah Bound to Sacred Enrollment:**
     Setiap rekaman hafalan (`TahfidzRecord`) wajib menunjuk `enrollmentId` aktif saat santri menyetorkan ziyadah atau muraja'ah. Catatan hafalan historis tetap merujuk secara akurat pada konteks tahun ajaran dan kelas santri saat itu, bahkan setelah santri naik kelas, lulus, atau berganti ustadz pembimbing.
  3. **Zero Client Authority on Recorder Identity:**
     Atribut `recordedBy` pada `TahfidzRecord` diekstrak secara mutlak dari sesi server (`ctx.userId`), menjamin santri atau pihak luar tidak dapat memalsukan nama ustadz pengampu.
  4. **Dormitory Sacred History via Assignment Model:**
     Penempatan santri ke kamar asrama **dilarang keras disimpan di kolom statis `Student.roomId`**. Sistem menggunakan model `StudentDormitoryAssignment` dengan status `ACTIVE` dan `ENDED`, mencatat tanggal mulai dan tanggal selesai. Kapasitas kamar divalidasi secara ketat dan santri dilarang memiliki lebih dari 1 penempatan aktif secara bersamaan.
  5. **Single Attendance Engine Reused for Living:**
     Absensi asrama tidak membangun mesin kedua yang terpisah. Model `AttendanceSession` diperluas dengan diskriminator `context` (`ACADEMIC` atau `LIVING`) dan relasi opsional `dormitoryRoomId` berpasangan dengan `institutionId`. Presensi asrama menggunakan `AttendanceRecord` yang sama dengan penegakan integritas compound foreign keys dan validasi status penghuni kamar aktif.
* **Konsekuensi:** Arsitektur sistem tetap ramping dan kohesif (*DRY - Don't Repeat Yourself*), seluruh rekam jejak santri di sekolah maupun asrama terintegrasi dalam *One Student, One Identity*, dan batas keamanan multi-tenant terjaga konsisten di semua alur.

