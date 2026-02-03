---
name: maxmind
description: |
  Integrates MaxMind GeoLite2 database for IP geolocation lookups.
  Use when: Adding/modifying IP geolocation, working with the enrichment pipeline, troubleshooting geo lookups, or optimizing cache performance.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# MaxMind Skill

IP geolocation using the MaxMind GeoLite2-City database. This project wraps the `maxmind` npm package with an LRU cache layer for high-throughput lookups on firewall log streams. The `GeoLocator` class handles raw lookups; `CachedGeoLocator` adds caching; `EnrichmentPipeline` orchestrates the full enrichment flow.

## Quick Start

### Basic Lookup

```javascript
const { GeoLocator } = require('./enrichment/geolocation.js');

const geo = new GeoLocator();
await geo.initialize(); // Loads GeoLite2-City.mmdb into memory

const result = geo.get('8.8.8.8');
// { latitude: 37.751, longitude: -97.822, city: null, country: 'US', countryName: 'United States' }
```

### Cached Lookup (Preferred)

```javascript
const { CachedGeoLocator } = require('./enrichment/cache.js');

const geoLocator = new CachedGeoLocator();
await geoLocator.initialize();

const result = geoLocator.get('203.0.113.50');
// First call: cache miss -> MaxMind lookup
// Subsequent calls: cache hit -> sub-millisecond

const metrics = geoLocator.getMetrics();
// { hits: 847, misses: 153, hitRate: 84.7, cacheSize: 153, maxSize: 10000, uptimeSeconds: 3600 }
```

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| Database path | `data/GeoLite2-City.mmdb` | Relative to project root |
| Initialize pattern | Always call `initialize()` before `get()` | `await geo.initialize()` |
| Null results | Private/invalid IPs return `null` | `geo.get('192.168.1.1')` → `null` |
| Cache null values | Prevents repeated lookups of invalid IPs | Internal behavior |
| TTL | 1 hour cache expiry | `ttl: 1000 * 60 * 60` |

## Common Patterns

### Integration with Enrichment Pipeline

**When:** Processing parsed syslog events with geolocation

```javascript
const { EnrichmentPipeline } = require('./enrichment/enrichment-pipeline.js');

const pipeline = new EnrichmentPipeline(eventBus);
await pipeline.initialize();

// Pipeline listens for 'parsed' events, emits 'enriched' events
eventBus.on('enriched', (event) => {
  console.log(event.geo?.countryName, event.enrichmentTime);
});
```

### Metrics Monitoring

**When:** Ensuring cache hit rate stays above 80%

```javascript
geoLocator.startMetricsLogging(30000); // Log every 30 seconds
// Output: [GeoCache] Hits: 847 | Misses: 153 | Hit Rate: 84.70% | Cache Size: 153/10000
```

## See Also

- [patterns](references/patterns.md) - Initialization, caching, and error handling patterns
- [workflows](references/workflows.md) - Database updates, testing, and debugging

## Related Skills

- **lru-cache** - Cache configuration and tuning
- **node** - EventEmitter patterns used by enrichment pipeline