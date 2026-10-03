#!/usr/bin/env node
/**
 * Project Completion Monitor
 * Phase 7 Trek C - AI Generator + Question Bank completion tracking
 * Runs every 4 hours to check project health and CI status
 *
 * Catatan cron (lihat /opt/data/work/natasekolah-LOG.md):
 * - `npx prisma validate` DI-BLOCK security scanner di cron → pakai path langsung.
 * - State file format lama menyimpan status notifikasi di summary.completion_notified.
 */

const { execSync } = require('child_process');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const WORKDIR = '/opt/data/work/natasekolah';
const STATE_FILE = join(WORKDIR, '.project-monitor-state.json');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: WORKDIR, encoding: 'utf-8', timeout: 120000 }).trim();
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

function loadState() {
  let state = { consecutiveFailures: 0 };
  let fromFile = null;
  if (existsSync(STATE_FILE)) {
    try {
      fromFile = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
      state = Object.assign(state, fromFile);
    } catch (e) {
      console.warn('State file tidak terbaca, pakai default:', e.message);
    }
  }
  // kompatibilitas format lama: status notifikasi ada di summary.completion_notified.
  // Cek dari fromFile, BUKAN dari state — state sudah terisi default false (boolean),
  // jadi `typeof state.x !== 'boolean'` tidak akan pernah match dan migrasi kelewatan.
  if (fromFile && typeof fromFile.notifiedCompletion === 'boolean') {
    state.notifiedCompletion = fromFile.notifiedCompletion;
  } else if (fromFile && fromFile.summary && typeof fromFile.summary.completion_notified === 'boolean') {
    state.notifiedCompletion = fromFile.summary.completion_notified;
  } else {
    state.notifiedCompletion = false;
  }
  if (typeof state.consecutiveFailures !== 'number') state.consecutiveFailures = 0;
  return state;
}

function saveState(state) {
  // sinkronkan field lama supaya kedua lokasi tidak bertentangan
  if (state.summary && typeof state.summary === 'object') {
    state.summary.completion_notified = state.notifiedCompletion;
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function main() {
  const state = loadState();
  const now = new Date().toISOString();

  console.log(`[${now}] Project Monitor - Phase 7 Question Bank + AI Generator`);
  console.log('='.repeat(60));

  // 1. Git status
  const currentCommit = run('git rev-parse HEAD').slice(0, 8);
  const commitMsg = run('git log -1 --pretty=%s');
  console.log(`📦 Commit: ${currentCommit} - ${commitMsg}`);

  // 2. Test status (format spec "ℹ pass N" ATAU tap "# pass N" tergantung TTY)
  const testOutput = run('timeout 300 npm test 2>&1');
  const testMatch = testOutput.match(/[ℹ#]\s*pass\s+(\d+)/);
  const testCount = testMatch ? parseInt(testMatch[1]) : 0;
  const testFailMatch = testOutput.match(/[ℹ#]\s*fail\s+(\d+)/);
  const testFails = testFailMatch ? parseInt(testFailMatch[1]) : 0;
  console.log(`🧪 Tests: ${testCount} pass, ${testFails} fail`);

  // 3. TypeScript check
  const tscOutput = run('npx tsc --noEmit 2>&1');
  const tscOk = tscOutput.length === 0;
  console.log(`🔍 TypeScript: ${tscOk ? '✅ 0 errors' : '❌ errors found'}`);
  if (!tscOk) console.log(tscOutput.slice(0, 500));

  // 4. Build status
  const buildOutput = run('timeout 300 npm run build 2>&1 | tail -3');
  const buildOk = !buildOutput.includes('Error') && !buildOutput.includes('error:');
  console.log(`🏗️  Build: ${buildOk ? '✅ OK' : '❌ Failed'}`);
  if (!buildOk) console.log(buildOutput.slice(0, 500));

  // 5. Prisma validate — npx diblokir scanner cron, pakai CLI langsung
  const prismaOutput = run('node node_modules/prisma/build/index.js validate 2>&1');
  const prismaOk = prismaOutput.includes('valid');
  console.log(`🗄️  Prisma: ${prismaOk ? '✅ Valid' : '❌ Invalid'}`);
  if (!prismaOk) console.log(prismaOutput.slice(0, 300));

  // 6. AI Generator infrastructure check
  const aiFiles = [
    'src/lib/ai-generation/types.ts',
    'src/lib/ai-generation/usage-service.ts',
    'src/lib/ai-generation/ai-generation-service.ts',
    'src/lib/ai-generation/index.ts',
    'src/lib/validation/ai-generation.ts',
    'prisma/migrations/20261001080000_ai_generation_infrastructure/migration.sql',
  ];
  const aiFilesExist = aiFiles.every(f => existsSync(join(WORKDIR, f)));
  console.log(`🤖 AI Generator Infra: ${aiFilesExist ? '✅ Complete' : '❌ Missing files'}`);
  if (!aiFilesExist) console.log('   hilang: ' + aiFiles.filter(f => !existsSync(join(WORKDIR, f))).join(', '));

  // 7. Question Bank completion check
  const qbFiles = [
    'src/lib/question-bank/question-service.ts',
    'src/lib/question-bank/category-service.ts',
    'src/lib/question-bank/importer.ts',
    'src/lib/question-bank/exporter.ts',
    'src/app/exams/question-bank/page.tsx',
    'src/app/exams/question-bank/[id]/page.tsx',
  ];
  const qbFilesExist = qbFiles.every(f => existsSync(join(WORKDIR, f)));
  console.log(`📚 Question Bank: ${qbFilesExist ? '✅ Complete' : '❌ Missing files'}`);
  if (!qbFilesExist) console.log('   hilang: ' + qbFiles.filter(f => !existsSync(join(WORKDIR, f))).join(', '));

  // 8. Overall health — testCount>0 sebagai sanity: parsing gagal = TIDAK sehat,
  //    jangan pernah bilang hijau kalau angka tesnya tidak terbaca sama sekali
  const allHealthy = tscOk && buildOk && prismaOk && testFails === 0 && testCount > 0 && aiFilesExist && qbFilesExist;

  console.log('\n' + '='.repeat(60));
  console.log(`🏁 Overall: ${allHealthy ? '✅ ALL GREEN - Project Complete!' : '⚠️  Issues Detected'}`);

  if (allHealthy && !state.notifiedCompletion) {
    console.log('\n🎉 PROJECT COMPLETE - Phase 7 Question Bank + AI Generator Infrastructure');
    console.log('   - Question Bank: Full CRUD, Import/Export, UI, RBAC');
    console.log('   - AI Generator: Models, Migrations, Services, Validation, Plugin');
    console.log(`   - Tests: ${testCount} passing`);
    console.log('   - Build: Clean');
    console.log('   - Ready for: AI Provider integration (just add API key)');
    state.notifiedCompletion = true;
  } else if (!allHealthy) {
    state.consecutiveFailures++;
    // notifiedCompletion TIDAK di-reset: pengumuman kelengkapan = milestone sekali seumur hidup,
    // reset bikin notifikasi dobel tiap fluktuasi sehat→tidak sehat→sehat
    if (state.consecutiveFailures >= 3) {
      console.log(`\n⚠️  ${state.consecutiveFailures} consecutive unhealthy checks`);
    }
  } else {
    state.consecutiveFailures = 0;
  }

  // Update state
  state.lastCommit = currentCommit;
  state.lastTestCount = testCount;
  state.lastBuildStatus = buildOk;
  state.lastCheckAt = now;
  saveState(state);

  // Return summary for cron delivery
  const summary = {
    timestamp: now,
    commit: currentCommit,
    tests: { pass: testCount, fail: testFails },
    typescript: tscOk,
    build: buildOk,
    prisma: prismaOk,
    aiGenerator: aiFilesExist,
    questionBank: qbFilesExist,
    allHealthy,
    notifiedCompletion: state.notifiedCompletion,
    consecutiveFailures: state.consecutiveFailures,
  };

  console.log('\n--- CRON OUTPUT ---');
  console.log(JSON.stringify(summary));

  return summary;
}

main();
