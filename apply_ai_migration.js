const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres@localhost/natasekolah?host=/opt/data/work/.pgdata"
    }
  }
});

async function main() {
  try {
    const sql = fs.readFileSync('prisma/migrations/20261001080000_ai_generation_infrastructure/migration.sql', 'utf8');
    const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed) {
        await prisma.$executeRawUnsafe(trimmed + ';');
        console.log('Executed:', trimmed.substring(0, 60) + '...');
      }
    }
    console.log('All statements executed');
    const usage = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ai%'`;
    console.log('AI tables:', usage);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
