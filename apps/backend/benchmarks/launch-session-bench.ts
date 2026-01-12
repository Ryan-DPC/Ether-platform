import { describe, expect, test } from 'bun:test';

const BASE_URL = process.env.API_URL || 'https://vext-backend.onrender.com';
const CONCURRENCY = 10;
const REQUESTS = 50;

console.log(`🚀 Starting Launch Session Benchmark on ${BASE_URL}\n`);

// Mock valid ObjectId (24 hex chars)
const VALID_GAME_ID = '507f1f77bcf86cd799439011';

async function benchmarkSessionStart() {
  const name = 'Session Start (POST)';
  const path = '/stats/session/start';

  console.log(`Running ${name} test...`);

  const start = performance.now();
  let success = 0;
  let fails = 0;

  const promises = [];

  for (let i = 0; i < REQUESTS; i++) {
    promises.push(
      fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: VALID_GAME_ID,
        }),
      })
        .then(async (res) => {
          // We expect 200 or 201.
          // If ID doesn't exist in DB it might 404, but it should NOT 500.
          if (res.status < 500) {
            success++;
          } else {
            fails++;
            const text = await res.text();
            console.log(`❌ Failed: ${res.status} - ${text}`);
          }
        })
        .catch((err) => {
          fails++;
          console.error(`Network Error: ${err.message}`);
        })
    );
  }

  await Promise.all(promises);

  const end = performance.now();
  const duration = (end - start) / 1000;

  console.log(`📊 Benchmark: ${name}`);
  console.log(`   Requests: ${REQUESTS}`);
  console.log(`   Time: ${duration.toFixed(2)}s`);
  console.log(`   Success (Non-500): ${success}`);
  console.log(`   Failures (500s): ${fails}`);
  console.log('-----------------------------------');
}

benchmarkSessionStart();
