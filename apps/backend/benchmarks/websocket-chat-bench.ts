// Using Bun's native WebSocket API
const WS_URL = 'https://vext-ws-server.onrender.com';
const NUM_CONNECTIONS = 50;
const MESSAGES_PER_CONNECTION = 10;

interface BenchmarkResult {
  name: string;
  connections: number;
  messages: number;
  duration: number;
  messagesPerSecond: number;
  avgLatency: number;
}

async function benchmarkGlobalChat(): Promise<BenchmarkResult> {
  console.log(`🚀 Starting Global Chat Benchmark with ${NUM_CONNECTIONS} connections...`);

  const connections: WebSocket[] = [];
  const latencies: number[] = [];
  let messagesReceived = 0;

  // Create connections using Bun's native WebSocket
  for (let i = 0; i < NUM_CONNECTIONS; i++) {
    const ws = new WebSocket(`${WS_URL}?token=test_token_${i}`);
    connections.push(ws);

    ws.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data as string);
        if (message.type === 'chat:global-message') {
          const latency = Date.now() - message.data.timestamp;
          latencies.push(latency);
          messagesReceived++;
        }
      } catch (e) {
        // Ignore parse errors
      }
    };
  }

  // Wait for all connections to open
  await Promise.all(
    connections.map(
      (ws) =>
        new Promise((resolve) => {
          if (ws.readyState === WebSocket.OPEN) {
            resolve(null);
          } else {
            ws.onopen = () => resolve(null);
          }
        })
    )
  );

  console.log(`✅ ${NUM_CONNECTIONS} connections established`);

  // Start benchmark
  const startTime = Date.now();
  const totalMessages = NUM_CONNECTIONS * MESSAGES_PER_CONNECTION;

  // Send messages from each connection
  for (let i = 0; i < MESSAGES_PER_CONNECTION; i++) {
    for (const ws of connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'chat:broadcast',
            data: {
              content: `Benchmark message ${i}`,
              timestamp: Date.now(),
            },
          })
        );
      }
    }

    // Small delay between batches
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Wait for messages to propagate (max 5 seconds)
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  // Close all connections
  connections.forEach((ws) => ws.close());

  const avgLatency =
    latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

  return {
    name: 'Global Chat Broadcast',
    connections: NUM_CONNECTIONS,
    messages: totalMessages,
    duration,
    messagesPerSecond: totalMessages / duration,
    avgLatency,
  };
}

async function runBenchmark() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 WebSocket Global Chat Benchmark');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const result = await benchmarkGlobalChat();

    console.log('\n📊 Results:');
    console.log('-----------------------------------');
    console.log(`Connections: ${result.connections}`);
    console.log(`Total Messages: ${result.messages}`);
    console.log(`Duration: ${result.duration.toFixed(2)}s`);
    console.log(`Messages/Second: ${result.messagesPerSecond.toFixed(2)}`);
    console.log(`Avg Latency: ${result.avgLatency.toFixed(2)}ms`);
    console.log('-----------------------------------\n');

    console.log('✅ Benchmark Completed\n');
  } catch (error) {
    console.error('❌ Benchmark Failed:', error);
    process.exit(1);
  }
}

runBenchmark();
