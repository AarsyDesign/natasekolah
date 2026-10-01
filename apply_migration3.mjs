import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://postgres@localhost/natasekolah?host=/opt/data/work/.pgdata' }
  }
});

async function main() {
  try {
    // FK subjectId institutionId jobs - reference "subjects" (lowercase)
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ai_generation_jobs"
        ADD CONSTRAINT "ai_generation_jobs_subjectId_institutionId_fkey"
        FOREIGN KEY ("subjectId", "institutionId") REFERENCES "subjects"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;
    `);
    console.log('FK subjectId jobs added');
    
    // Verify
    const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ai%'`;
    console.log('AI tables:', tables);
    
    // Verify constraints
    const constraints = await prisma.$queryRaw`SELECT conname FROM pg_constraint WHERE conrelid = 'ai_generation_jobs'::regclass`;
    console.log('Constraints on ai_generation_jobs:', constraints);
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
