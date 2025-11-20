#!/usr/bin/env node

/**
 * Cleanup script to fix stuck 'in_progress' audits
 * This marks all old in_progress audits as 'failed' so they don't block new audits
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || './data/site-tracker.db';

console.log('🔧 Cleaning up stuck audits...');
console.log(`Database: ${dbPath}\n`);

try {
  const db = new Database(dbPath);

  // Find all in_progress audits
  const stuckAudits = db.prepare(`
    SELECT id, url, audit_date, health_score
    FROM audits
    WHERE status = 'in_progress'
    ORDER BY audit_date DESC
  `).all();

  if (stuckAudits.length === 0) {
    console.log('✅ No stuck audits found. Database is clean!');
    db.close();
    process.exit(0);
  }

  console.log(`Found ${stuckAudits.length} stuck audit(s):\n`);
  stuckAudits.forEach(audit => {
    console.log(`  - ID ${audit.id}: ${audit.url} (${audit.audit_date})`);
  });

  console.log('\n❓ What would you like to do?');
  console.log('  1. Mark all as FAILED');
  console.log('  2. DELETE all stuck audits');
  console.log('  3. Cancel (do nothing)');

  // Read user input
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('\nEnter your choice (1/2/3): ', (answer) => {
    if (answer === '1') {
      // Mark as failed
      const updateStmt = db.prepare(`
        UPDATE audits
        SET status = 'failed'
        WHERE status = 'in_progress'
      `);
      const result = updateStmt.run();
      console.log(`\n✅ Marked ${result.changes} audit(s) as FAILED`);
    } else if (answer === '2') {
      // Delete
      const deleteStmt = db.prepare(`
        DELETE FROM audits
        WHERE status = 'in_progress'
      `);
      const result = deleteStmt.run();
      console.log(`\n✅ Deleted ${result.changes} stuck audit(s)`);
    } else {
      console.log('\n❌ Cancelled. No changes made.');
    }

    db.close();
    rl.close();
    process.exit(0);
  });

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
