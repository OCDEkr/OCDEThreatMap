---
name: lru-cache
description: |
  Configures in-memory LRU cache for geolocation lookup optimization.
  Use when: Adding caching to expensive operations, optimizing IP lookup performance,
  implementing cache-aside patterns, tracking cache hit rates.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# LRU Cache Skill

This codebase uses `lru-cache` v11.x to wrap MaxMind geolocation lookups, targeting 80%+ cache hit rate for sub-millisecond IP lookups. The `CachedGeoLocator` class at `src/enrichment/cache.js` demonstrates the cache-aside pattern with TTL-based expiration and metrics tracking.

## Quick Start

### Basic Cache Setup

```javascript
const { LRUCache } = require('lru-cache');

const cache = new LRUCache({
  max: 10000,              // Maximum entries
  ttl: 1000 * 60 * 60,     // 1 hour TTL
  updateAgeOnGet: false,   // Don't reset TTL on access
});
```

### Cache-Aside Pattern (This Codebase)

```javascript
get(ip) {
  if (this.cache.has(ip)) {
    this.metrics.hits++;
    return this.cache.get(ip);
  }
  
  this.metrics.misses++;
  const geoData = this.geoLocator.get(ip);
  this.cache.set(ip, geoData);  // Cache null results too
  return geoData;
}
```

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| `max` | Hard limit on entries | `max: 10000` |
| `ttl` | Time-to-live in ms | `ttl: 3600000` (1 hour) |
| `updateAgeOnGet` | Reset TTL on access | `false` for fixed expiration |
| `has()` + `get()` | Check then fetch | Avoids undefined vs not-cached ambiguity |

## Common Patterns

### Metrics Tracking

```javascript
this.metrics = { hits: 0, misses: 0, startTime: Date.now() };

getMetrics() {
  const total = this.metrics.hits + this.metrics.misses;
  const hitRate = total > 0 ? (this.metrics.hits / total * 100).toFixed(2) : 0;
  return {
    hits: this.metrics.hits,
    misses: this.metrics.misses,
    hitRate: parseFloat(hitRate),
    cacheSize: this.cache.size,
  };
}
```

### Periodic Metrics Logging

```javascript
this.metricsInterval = setInterval(() => {
  const metrics = this.getMetrics();
  console.log(`[Cache] Hit Rate: ${metrics.hitRate}% | Size: ${metrics.cacheSize}`);
  
  if (metrics.hitRate < 80 && (metrics.hits + metrics.misses) > 100) {
    console.warn('WARNING: Hit rate below 80% target');
  }
}, 30000);
```

## See Also

- [patterns](references/patterns.md) - Cache-aside, wrapper class, negative caching
- [workflows](references/workflows.md) - Integration, monitoring, tuning

## Related Skills

- See the **maxmind** skill for the underlying geolocation service being cached
- See the **node** skill for EventEmitter patterns used in the enrichment pipeline