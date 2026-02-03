# LRU Cache Workflows Reference

## Contents
- Integration with Enrichment Pipeline
- Cache Monitoring Setup
- Performance Tuning
- Testing Cache Behavior

---

## Integration with Enrichment Pipeline

The cache wraps the geolocation service and is consumed by the enrichment pipeline.

### Initialization Flow

```javascript
// From src/enrichment/enrichment-pipeline.js
class EnrichmentPipeline extends EventEmitter {
  constructor(eventBus) {
    super();
    this.geoLocator = new CachedGeoLocator();  // Cache wrapper
  }

  async initialize() {
    await this.geoLocator.initialize();  // Loads MaxMind DB
    this.geoLocator.startMetricsLogging(30000);  // 30-second intervals
    
    this.eventBus.on('parsed', (event) => {
      this.enrich(event);
    });
  }
}
```

### Integration Checklist

Copy this checklist and track progress:
- [ ] Step 1: Create CachedGeoLocator instance in constructor
- [ ] Step 2: Call `initialize()` in async startup
- [ ] Step 3: Start metrics logging after initialization
- [ ] Step 4: Wire event listener for parsed events
- [ ] Step 5: Use `get()` in enrichment method

---

## Cache Monitoring Setup

### Metrics Collection

```javascript
// From src/enrichment/cache.js:66-79
getMetrics() {
  const total = this.metrics.hits + this.metrics.misses;
  const hitRate = total > 0 ? (this.metrics.hits / total * 100).toFixed(2) : 0;
  const uptimeSeconds = Math.floor((Date.now() - this.metrics.startTime) / 1000);

  return {
    hits: this.metrics.hits,
    misses: this.metrics.misses,
    hitRate: parseFloat(hitRate),
    cacheSize: this.cache.size,
    maxSize: 10000,
    uptimeSeconds
  };
}
```

### Periodic Logging with Warning Threshold

```javascript
// From src/enrichment/cache.js:94-113
startMetricsLogging(intervalMs = 30000) {
  this.metricsInterval = setInterval(() => {
    const metrics = this.getMetrics();
    
    console.log(`[GeoCache] Hits: ${metrics.hits} | Misses: ${metrics.misses} | ` +
                `Hit Rate: ${metrics.hitRate}% | Size: ${metrics.cacheSize}/${metrics.maxSize}`);
    
    // Warning if hit rate below 80% target
    if (metrics.hitRate < 80 && (metrics.hits + metrics.misses) > 100) {
      console.warn(`[GeoCache] WARNING: Hit rate ${metrics.hitRate}% below 80% target`);
    }
  }, intervalMs);
}
```

### Monitoring Validation Loop

1. Start application with logging enabled
2. Observe cache metrics in console output
3. If hit rate < 80% after 100+ lookups, investigate:
   - Are most IPs unique? (Normal for diverse attack sources)
   - Is TTL too short for traffic patterns?
   - Is max size too small for working set?
4. Adjust parameters and repeat step 2

---

## Performance Tuning

### Sizing the Cache

**Rule of thumb:** Cache should hold your working set with ~20% headroom.

```javascript
// For this threat map with diverse attack IPs:
// - Expect 5,000-8,000 unique IPs per hour
// - Set max to 10,000 for headroom
// - 1-hour TTL matches expected IP repeat rate

this.cache = new LRUCache({
  max: 10000,
  ttl: 1000 * 60 * 60,  // 1 hour
});
```

### When to Increase Cache Size

| Symptom | Action |
|---------|--------|
| Hit rate < 80% consistently | Increase `max` |
| `cache.size` always at `max` | Increase `max` |
| Memory usage acceptable | Safe to increase |

### When to Decrease TTL

| Symptom | Action |
|---------|--------|
| Geo data becomes stale | Decrease TTL |
| Need fresher MaxMind updates | Decrease TTL |

---

## Testing Cache Behavior

### Reset Metrics Between Tests

```javascript
// From src/enrichment/cache.js:84-88
resetMetrics() {
  this.metrics.hits = 0;
  this.metrics.misses = 0;
  this.metrics.startTime = Date.now();
}
```

### Verifying Cache Hit Behavior

```javascript
// Test: Second lookup should be a cache hit
const cache = new CachedGeoLocator();
await cache.initialize();
cache.resetMetrics();

cache.get('8.8.8.8');  // Miss - first lookup
cache.get('8.8.8.8');  // Hit - cached

const metrics = cache.getMetrics();
assert(metrics.hits === 1);
assert(metrics.misses === 1);
assert(metrics.hitRate === 50);
```

### Verifying Negative Caching

```javascript
// Test: Private IPs should be cached as null
cache.resetMetrics();

cache.get('192.168.1.1');  // Miss - returns null
cache.get('192.168.1.1');  // Hit - cached null

const metrics = cache.getMetrics();
assert(metrics.hits === 1);  // Proves null was cached
```

---

## Graceful Shutdown

```javascript
// From src/enrichment/cache.js:118-124
stopMetricsLogging() {
  if (this.metricsInterval) {
    clearInterval(this.metricsInterval);
    this.metricsInterval = null;
    console.log('Cache metrics logging stopped');
  }
}

// Called from pipeline shutdown
shutdown() {
  this.geoLocator.stopMetricsLogging();
  console.log('EnrichmentPipeline shutdown');
}
```

**Always clean up intervals** to prevent memory leaks and orphaned timers during graceful shutdown.