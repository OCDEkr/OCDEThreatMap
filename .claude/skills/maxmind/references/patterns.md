# MaxMind Patterns Reference

## Contents
- Initialization Patterns
- Two-Layer Cache Architecture
- Response Structure
- Error Handling and Graceful Degradation
- Anti-Patterns

## Initialization Patterns

### Async-First Initialization

`initialize()` MUST complete before `get()` — throws if lookup handle is null.

```javascript
// GOOD — await at startup, before any event processing
async function start() {
  await enrichmentPipeline.initialize(); // Loads MaxMind DB
  const addr = await receiver.listen();  // Only then accept traffic
}
```

```javascript
// BAD — throws "GeoLocator not initialized - call initialize() first"
const geo = new GeoLocator();
const result = geo.get('8.8.8.8'); // Error!
```

### Database Path and Open Options

Hardcoded at `src/enrichment/geolocation.js:22` — resolves to `data/GeoLite2-City.mmdb`.

```javascript
this.lookup = await maxmind.open(dbPath, {
  cache: { max: 10000 },      // Internal maxmind cache (raw MMDB nodes)
  watchForUpdates: false       // Set true in production for live DB updates
});
```

## Two-Layer Cache Architecture

Layer 1: `maxmind` internal LRU (10K, raw MMDB nodes). Layer 2: application LRU (10K, 1h TTL, extracted response objects). See the **lru-cache** skill for tuning.

```javascript
// src/enrichment/cache.js:13-17
this.cache = new LRUCache({
  max: 10000,
  ttl: 1000 * 60 * 60,      // 1 hour fixed TTL
  updateAgeOnGet: false,     // Don't reset TTL on access
});
```

**Why `updateAgeOnGet: false`:** Geo data rarely changes. Fixed expiry ensures periodic refresh when MaxMind updates the database. Sliding TTL would keep stale entries alive indefinitely.

### Negative Caching

`null` results are cached to prevent repeated lookups of private/invalid IPs:

```javascript
// src/enrichment/cache.js:54-58
const geoData = this.geoLocator.get(ip);
this.cache.set(ip, geoData); // Caches null too
```

Critical for firewall logs — internal IPs (`10.x`, `192.168.x`) appear constantly. Without negative caching, every private IP triggers a MaxMind lookup that always returns null.

## Response Structure

```javascript
// Successful lookup — all 5 fields
{ latitude: 37.751, longitude: -97.822, city: 'Mountain View', country: 'US', countryName: 'United States' }

// Partial — city can be null
{ latitude: 37.751, longitude: -97.822, city: null, country: 'US', countryName: 'United States' }

// Failed: null (private IPs, invalid formats, missing DB entries)
null
```

The `country` field drives COUNTRY_COLORS in both `custom-arcs.js` and `flat-map-d3.js`. Downstream consumers must handle `geo: null`.

Enrichment also checks OCDE targeting via `ip-range-check` (`enrichment-pipeline.js:52`). Set `OCDE_IP_RANGES` env var as comma-separated CIDRs. Without it, `isOCDETarget` is always `false`.

## Error Handling and Graceful Degradation

### Never Throw on Lookup

```javascript
// src/enrichment/geolocation.js:50-69
try {
  const result = this.lookup.get(ip);
  if (!result) return null;
  return { latitude, longitude, city, country, countryName };
} catch (err) {
  console.error(`GeoLocator error for IP ${ip}:`, err.message);
  return null; // Don't throw — pipeline continues
}
```

### Emit on Failure Too

Pipeline emits enriched event with `geo: null` even on error — downstream consumers still receive attack data:

```javascript
// src/enrichment/enrichment-pipeline.js:86-93
this.eventBus.emit('enriched', {
  ...event, geo: null, isOCDETarget: targetingOCDE,
  enrichmentError: err.message, enrichmentTime: Date.now() - startTime
});
```

Pipeline warns if enrichment exceeds 5 seconds (`latencyWarningThreshold` at `enrichment-pipeline.js:14`).

## Anti-Patterns

### WARNING: Unbounded Cache

```javascript
// BAD — grows forever, OOM under attack traffic
this.cache = new Map();
this.cache.set(ip, geoData);
```

**Why This Breaks:** Attack traffic generates millions of unique source IPs. An unbounded Map grows without limit. At ~200 bytes/entry, 1M IPs = ~200MB. A sustained DDoS kills the process.

**The Fix:** Use LRU with bounded size (current: 10K items). See the **lru-cache** skill.

### WARNING: Skipping IPv4 Validation

```javascript
// BAD — passes arbitrary strings to MaxMind
const result = this.lookup.get(userInput);
```

**Why This Breaks:** Non-IP strings cause unpredictable behavior. IPv6 bypasses the regex. Malformed input wastes cache slots with garbage keys.

**The Fix:**

```javascript
if (!this.isValidIPv4(ip)) return null;
```

**When Tempted:** Logs with `src=host:port` format where port isn't stripped, or hostnames instead of IPs.

### WARNING: Synchronous Database Load

**The Problem:** Loading ~60MB synchronously blocks the event loop for 500ms-2s. All incoming UDP messages queue in OS buffer. On high-volume streams (1K+ events/sec), the 32MB UDP buffer overflows and drops messages silently.

**The Fix:** Always `await maxmind.open()` at startup, before starting the UDP receiver. See the **node** skill for async initialization patterns.
