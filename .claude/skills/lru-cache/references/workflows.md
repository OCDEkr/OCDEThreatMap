# LRU Cache Workflows Reference

## Contents
- Integration with Enrichment Pipeline
- Cache Monitoring Setup
- Performance Tuning
- Testing Cache Behavior
- Graceful Shutdown

---

## Integration with Enrichment Pipeline

The cache wraps geolocation and is consumed by the enrichment pipeline. See the **maxmind** skill for `GeoLocator`.

```javascript
// From src/enrichment/enrichment-pipeline.js
class EnrichmentPipeline extends EventEmitter {
  constructor(eventBus) {
    super();
    this.eventBus = eventBus;
    this.geoLocator = new CachedGeoLocator();  // Cache wrapper, not raw GeoLocator
  }
  async initialize() {
    await this.geoLocator.initialize();
    this.geoLocator.startMetricsLogging(30000);
    this.eventBus.on('parsed', (event) => this.enrich(event));
  }
}
```

```javascript
// Enrichment method — src/enrichment/enrichment-pipeline.js:44-96
enrich(event) {
  const startTime = Date.now();
  try {
    const geoData = this.geoLocator.get(event.sourceIP);
    this.eventBus.emit('enriched', {
      ...event,
      geo: geoData ? { latitude: geoData.latitude, longitude: geoData.longitude,
        city: geoData.city, country: geoData.country, countryName: geoData.countryName } : null,
      isOCDETarget: isOCDETarget(event.destinationIP, this.ocdeRanges),
      enrichmentTime: Date.now() - startTime
    });
  } catch (err) {
    this.eventBus.emit('enriched', { ...event, geo: null, enrichmentError: err.message });
  }
}
```

### Integration Checklist

Copy this checklist and track progress:
- [ ] Import `CachedGeoLocator` from `src/enrichment/cache.js`
- [ ] Create instance in constructor
- [ ] Call `await initialize()` in async startup
- [ ] Call `startMetricsLogging(30000)` after initialization
- [ ] Use `get(ip)` for lookups — handles null gracefully
- [ ] Wire `stopMetricsLogging()` into shutdown handler

---

## Cache Monitoring Setup

```javascript
// From src/enrichment/cache.js:94-113
startMetricsLogging(intervalMs = 30000) {
  if (this.metricsInterval) { return; }
  this.metricsInterval = setInterval(() => {
    const metrics = this.getMetrics();
    console.log(`[GeoCache] Hit Rate: ${metrics.hitRate}% | Size: ${metrics.cacheSize}/${metrics.maxSize}`);
    if (metrics.hitRate < 80 && (metrics.hits + metrics.misses) > 100) {
      console.warn(`[GeoCache] WARNING: Hit rate ${metrics.hitRate}% below 80% target`);
    }
  }, intervalMs);
}
```

### Monitoring Validation Loop

1. Start: `SYSLOG_PORT=5514 node src/app.js`
2. Traffic: `node test/send-random-attacks.js`
3. Watch `[GeoCache]` lines every 30 seconds
4. If hit rate < 80% after 100+ lookups, tune parameters (see below)
5. Repeat until hit rate stabilizes above 80%

---

## Performance Tuning

```javascript
// Current config — sized for 5,000-8,000 unique IPs per hour
this.cache = new LRUCache({
  max: 10000,              // ~20% headroom over working set
  ttl: 1000 * 60 * 60,     // 1-hour TTL matches IP repeat rate
  updateAgeOnGet: false,
});
```

| Symptom | Metric | Action |
|---------|--------|--------|
| Hit rate < 80% | `hitRate` | Increase `max` |
| Cache always full | `cacheSize === maxSize` | Increase `max` |
| Memory too high | OS monitoring | Decrease `max` or TTL |
| Stale geo data | Dashboard inspection | Decrease TTL |

**Memory:** ~200 bytes/entry. At `max: 10000` = ~2-3 MB heap — negligible.

---

## Testing Cache Behavior

```javascript
const { CachedGeoLocator } = require('../src/enrichment/cache');
const cache = new CachedGeoLocator();
await cache.initialize();

// Verify hit/miss
cache.resetMetrics();
cache.get('8.8.8.8');  // Miss
cache.get('8.8.8.8');  // Hit
const m1 = cache.getMetrics();
assert(m1.hits === 1 && m1.misses === 1 && m1.hitRate === 50);

// Verify negative caching (null is cached, not re-fetched)
cache.resetMetrics();
cache.get('192.168.1.1');  // Miss — null (private IP)
cache.get('192.168.1.1');  // Hit — cached null
assert(cache.getMetrics().hits === 1);
```

### Config Change Validation

1. Edit `src/enrichment/cache.js`
2. Run: `node test/test-parser.js`
3. Start app + send traffic, verify `[GeoCache]` hit rate > 80%
4. Only commit when validation passes

---

## Graceful Shutdown

```javascript
// src/enrichment/cache.js — clean up intervals to prevent process hang
stopMetricsLogging() {
  if (this.metricsInterval) {
    clearInterval(this.metricsInterval);
    this.metricsInterval = null;
  }
}

// Wired in src/app.js via EnrichmentPipeline.shutdown()
process.on('SIGINT', () => {
  enrichmentPipeline.shutdown();  // Calls stopMetricsLogging()
  server.close();
  receiver.stop();
  process.exit(0);
});
```

**Why:** `setInterval` keeps the event loop alive. Without cleanup, the process hangs on shutdown. See the **node** skill for signal handling patterns.
