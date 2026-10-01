#!/usr/bin/env node
/**
 * Page Load Performance Audit
 * NataSekolah - Comprehensive page load time measurement
 */

const http = require('http');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:3000';
const PAGES = [
  // Public / Auth
  { path: '/login', name: 'Login', auth: false },
  
  // Dashboard
  { path: '/', name: 'Dashboard', auth: true },
  
  // Master Data
  { path: '/students', name: 'Students List', auth: true },
  { path: '/teachers', name: 'Teachers List', auth: true },
  { path: '/subjects', name: 'Subjects', auth: true },
  { path: '/classrooms', name: 'Classrooms', auth: true },
  { path: '/academic-years', name: 'Academic Years', auth: true },
  
  // Attendance
  { path: '/attendance', name: 'Attendance Daily', auth: true },
  { path: '/attendance/history', name: 'Attendance History', auth: true },
  
  // Finance
  { path: '/finance', name: 'Finance Dashboard', auth: true },
  { path: '/finance/charges', name: 'Student Charges', auth: true },
  { path: '/finance/payments', name: 'Payments', auth: true },
  { path: '/finance/cashbook', name: 'Cashbook', auth: true },
  { path: '/finance/reports', name: 'Finance Reports', auth: true },
  
  // Academic
  { path: '/assessments', name: 'Assessments', auth: true },
  { path: '/grades', name: 'Grades', auth: true },
  { path: '/reports', name: 'Report Cards', auth: true },
  
  // Question Bank (Phase 7)
  { path: '/exams/question-bank', name: 'Question Bank List', auth: true },
  
  // Settings
  { path: '/settings', name: 'Settings Overview', auth: true },
  { path: '/settings/users', name: 'Settings Users', auth: true },
  { path: '/settings/plugins', name: 'Settings Plugins', auth: true },
  { path: '/settings/terminology', name: 'Settings Terminology', auth: true },
  
  // Tahfidz / Pesantren
  { path: '/tahfidz', name: 'Tahfidz', auth: true },
  { path: '/dormitories', name: 'Dormitories', auth: true },
  
  // Teacher Workspace
  { path: '/teacher', name: 'Teacher Workspace', auth: true },
  { path: '/teacher-assignments', name: 'Teacher Assignments', auth: true },
];

const COOKIE = ''; // We'll use the dev server without auth for baseline

function fetchPage(path) {
  return new Promise((resolve) => {
    const start = performance.now();
    const url = `${BASE_URL}${path}`;
    
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = performance.now() - start;
        resolve({
          path,
          status: res.statusCode,
          duration: Math.round(duration),
          size: Buffer.byteLength(data, 'utf8'),
        });
      });
    });
    
    req.on('error', (err) => {
      const duration = performance.now() - start;
      resolve({
        path,
        status: 'ERROR',
        duration: Math.round(duration),
        error: err.message,
      });
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
      const duration = performance.now() - start;
      resolve({
        path,
        status: 'TIMEOUT',
        duration: Math.round(duration),
      });
    });
  });
}

async function runAudit() {
  console.log('='.repeat(70));
  console.log('PAGE LOAD PERFORMANCE AUDIT - NataSekolah');
  console.log(`Base: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('='.repeat(70));
  console.log('');
  console.log(`${'PAGE'.padEnd(30)} | ${'STATUS'.padStart(6)} | ${'TIME (ms)'.padStart(10)} | ${'SIZE (KB)'.padStart(10)}`);
  console.log('-'.repeat(70));
  
  const results = [];
  
  for (const page of PAGES) {
    const result = await fetchPage(page.path);
    results.push({ ...page, ...result });
    
    const statusStr = String(result.status);
    const timeStr = `${result.duration}ms`.padStart(10);
    const sizeStr = result.size ? `${(result.size / 1024).toFixed(1)}`.padStart(10) : 'N/A'.padStart(10);
    const name = page.name.padEnd(30);
    
    let statusIcon = '✅';
    if (statusStr === 'ERROR' || statusStr === 'TIMEOUT') statusIcon = '❌';
    else if (statusStr >= 400) statusIcon = '⚠️';
    else if (statusStr === 307 || statusStr === 302) statusIcon = '🔄';
    
    console.log(`${name} | ${statusIcon} ${statusStr} | ${timeStr} | ${sizeStr}`);
  }
  
  console.log('-'.repeat(70));
  
  // Summary
  const successful = results.filter(r => r.status === 200 || r.status === 307);
  const failed = results.filter(r => r.status !== 200 && r.status !== 307);
  const avgTime = successful.length > 0 
    ? Math.round(successful.reduce((a, b) => a + b.duration, 0) / successful.length) 
    : 0;
  const maxTime = successful.length > 0 
    ? Math.max(...successful.map(r => r.duration)) 
    : 0;
  const minTime = successful.length > 0 
    ? Math.min(...successful.map(r => r.duration)) 
    : 0;
  
  console.log('');
  console.log('RINGKASAN:');
  console.log(`  Total halaman: ${results.length}`);
  console.log(`  Berhasil (200/307): ${successful.length}`);
  console.log(`  Gagal/Error: ${failed.length}`);
  console.log(`  Rata-rata waktu: ${avgTime}ms`);
  console.log(`  Tercepat: ${minTime}ms`);
  console.log(`  Terlama: ${maxTime}ms`);
  
  if (failed.length > 0) {
    console.log('');
    console.log('HALAMAN GAGAL:');
    failed.forEach(f => console.log(`  - ${f.name} (${f.path}): ${f.status} ${f.error || ''}`));
  }
  
  // Top 5 slowest
  const slowest = successful
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 5);
  
  console.log('');
  console.log('TOP 5 TERLAMBAT:');
  slowest.forEach((s, i) => {
    console.log(`  ${i+1}. ${s.name} (${s.path}): ${s.duration}ms`);
  });
  
  console.log('');
  console.log('='.repeat(70));
  
  return { results, summary: { total: results.length, successful: successful.length, failed: failed.length, avgTime, maxTime, minTime } };
}

runAudit().catch(console.error);