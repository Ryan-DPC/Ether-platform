import { describe, expect, test } from 'bun:test';

const BASE_URL = process.env.API_URL || 'https://vext-backend.onrender.com';
const CONCURRENCY = 50;
const REQUESTS = 1000;

console.log(`🚀 Starting Load Test on ${BASE_URL}\n`);

async function benchmark(name: string, path: string, count: number) {
  const start = performance.now();
  let success = 0;
  let fails = 0;
  let firstErrorLogged = false;

  // Check baseline connectivity first
  try {
    const check = await fetch(`${BASE_URL}${path}`);
    if (!check.ok) {
      console.warn(
        `⚠️ Warning: First request to ${path} returned ${check.status} ${check.statusText}`
      );
      const text = await check.text();
      console.warn(`   Response: ${text.slice(0, 100)}`);
    }
  } catch (e: any) {
    console.error(`❌ Critical: Could not connect to ${name} at ${BASE_URL}${path}`);
    console.error(`   Error: ${e.message}`);
    return 0;
  }

  const promises = [];

  for (let i = 0; i < count; i++) {
    promises.push(
      fetch(`${BASE_URL}${path}`)
        .then(async (res) => {
          if (res.ok) {
            success++;
          } else {
            fails++;
            if (!firstErrorLogged) {
              firstErrorLogged = true;
              const txt = await res.text();
              console.log(
                `\n(debug) First Failure on ${name}: ${res.status} - ${txt.slice(0, 100)}...`
              );
            }
          }
        })
        .catch((err) => {
          fails++;
          if (!firstErrorLogged) {
            firstErrorLogged = true;
            console.log(`\n(debug) First Network Error on ${name}: ${err.message}`);
          }
        })
    );

    // Limit concurrency
    if (promises.length >= CONCURRENCY) {
      await Promise.all(promises);
      promises.length = 0;
    }
  }

  await Promise.all(promises);

  const end = performance.now();
  const duration = (end - start) / 1000; // sec
  const rps = count / duration || 0;

  console.log(`📊 Benchmark: ${name}`);
  console.log(`   Requests: ${count}`);
  console.log(`   Time: ${duration.toFixed(2)}s`);
  console.log(`   RPS: ${rps.toFixed(2)} req/s`);
  console.log(`   Success: ${success}`);
  console.log(`   Failures: ${fails}`);
  console.log('-----------------------------------');

  return rps;
}

// Run benchmarks
async function run() {
  // 1. Health Check
  await benchmark('Health Check', '/health', REQUESTS);

  // 2. Store Items (DB Read High Traffic)
  await benchmark('Store Items', '/api/items/store', 500);

  // 3. Games List (DB Read)
  await benchmark('Games List', '/api/games/all', 500);

  // 4. Game Reviews (Stress likely empty array but tests routing)
  // Using a fake ID, expected 404 or empty array depending on implementation
  await benchmark('Game Reviews (Random ID)', '/api/games/invalid-id/reviews', 200);

  console.log('\n✅ Benchmarks Completed');
}

run();
