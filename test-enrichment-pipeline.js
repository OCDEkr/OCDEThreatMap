const { EnrichmentPipeline } = require('./src/enrichment/enrichment-pipeline.js');
const eventBus = require('./src/events/event-bus.js');

async function test() {
  const pipeline = new EnrichmentPipeline(eventBus);
  await pipeline.initialize();

  // Listen for enriched events
  let enrichedCount = 0;
  eventBus.on('enriched', (event) => {
    console.log('\n--- Enriched Event ---');
    console.log('Source IP:', event.sourceIP);
    console.log('Geo:', event.geo);
    console.log('Enrichment Time:', event.enrichmentTime + 'ms');
    enrichedCount++;
  });

  // Emit test parsed events
  console.log('Emitting test parsed events...\n');

  eventBus.emit('parsed', {
    timestamp: new Date().toISOString(),
    sourceIP: '8.8.8.8',
    destinationIP: '10.0.0.1',
    threatType: 'intrusion',
    action: 'deny',
    raw: 'test message 1'
  });

  eventBus.emit('parsed', {
    timestamp: new Date().toISOString(),
    sourceIP: '1.1.1.1',
    destinationIP: '10.0.0.1',
    threatType: 'malware',
    action: 'deny',
    raw: 'test message 2'
  });

  // Emit same IP again (should hit cache)
  eventBus.emit('parsed', {
    timestamp: new Date().toISOString(),
    sourceIP: '8.8.8.8',
    destinationIP: '10.0.0.1',
    threatType: 'ddos',
    action: 'deny',
    raw: 'test message 3'
  });

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Show metrics
  console.log('\n--- Cache Metrics ---');
  console.log(pipeline.getMetrics());

  // Validate
  console.log('\n--- Validation ---');
  console.log('Enriched events:', enrichedCount);
  console.log('Expected: 3 events, all with geo data');

  const metrics = pipeline.getMetrics();
  console.log('Cache hits:', metrics.hits, '(expect at least 1)');
  console.log('Cache misses:', metrics.misses, '(expect at least 2)');

  // Shutdown
  pipeline.shutdown();
}

test().catch(console.error);
