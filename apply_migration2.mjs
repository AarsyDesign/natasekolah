import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://postgres@localhost/natasekolah?host=/opt/data/work/.pgdata' }
  }
});

async function main() {
  try {
    // First, fix ai_generation_usage FKs with correct lowercase column names
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ai_generation_usage"
        ADD CONSTRAINT "ai_generation_usage_institutionId_fkey"
        FOREIGN KEY ("institutionid") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `);
    console.log('FK institutionId added to ai_generation_usage');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ai_generation_usage"
        ADD CONSTRAINT "ai_generation_usage_userId_institutionId_fkey"
        FOREIGN KEY ("userid", "institutionid") REFERENCES "User"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;
    `);
    console.log('FK userId added to ai_generation_usage');
    
    // Now create ai_generation_jobs table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "ai_generation_jobs" (
        "id" TEXT NOT NULL,
        "institutionId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "subjectId" TEXT NOT NULL,
        "prompt" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "model" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'DRAFT',
        "resultJson" TEXT,
        "errorMessage" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "reviewedAt" TIMESTAMP(3),
        "savedAt" TIMESTAMP(3),
        CONSTRAINT "ai_generation_jobs_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Created ai_generation_jobs table');
    
    // Unique index
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX "ai_generation_jobs_id_institutionId_key"
        ON "ai_generation_jobs" ("id", "institutionId");
    `);
    console.log('Unique index jobs added');
    
    // Index userId status
    await prisma.$executeRawUnsafe(`
      CREATE INDEX "ai_generation_jobs_institutionId_userId_status_idx"
        ON "ai_generation_jobs" ("institutionId", "userId", "status");
    `);
    console.log('Index userId status added');
    
    // Index createdAt
    await prisma.$executeRawUnsafe(`
      CREATE INDEX "ai_generation_jobs_institutionId_createdAt_idx"
        ON "ai_generation_jobs" ("institutionId", "createdAt");
    `);
    console.log('Index createdAt added');
    
    // FK institutionId jobs
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ai_generation_jobs"
        ADD CONSTRAINT "ai_generation_jobs_institutionId_fkey"
        FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `);
    console.log('FK institutionId jobs added');
    
    // FK userId institutionId jobs
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ai_generation_jobs"
        ADD CONSTRAINT "ai_generation_jobs_userId_institutionId_fkey"
        FOREIGN KEY ("userId", "institutionId") REFERENCES "User"("id", "institutionId") ON DELETE CASCADE ON UPDATE CASCADE;
    `);
    console.log('FK userId jobs added');
    
    // FK subjectId institutionId jobs
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ai_generation_jobs"
        ADD CONSTRAINT "ai_generation_jobs_subjectId_institutionId_fkey"
        FOREIGN KEY ("subjectId", "institutionId") REFERENCES "Subject"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;
    `);
    console.log('FK subjectId jobs added');
    
    // Verify
    const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ai%'`;
    console.log('AI tables:', tables);
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
