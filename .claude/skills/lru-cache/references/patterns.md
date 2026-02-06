# LRU Cache Patterns Reference

## Contents
- Cache-Aside Pattern
- Wrapper Class Pattern
- Negative Caching
- TTL Configuration
- Anti-Patterns

---

## Cache-Aside Pattern

Check cache first, fetch on miss, store result. This is the only caching strategy in this project.

```javascript
// From src/enrichment/cache.js:44-60
get(ip) {
  if (this.cache.has(ip)) {
    this.metrics.hits++;
    return this.cache.get(ip);
  }
  this.metrics.misses++;
  const geoData = this.geoLocator.get(ip);
  this.cache.set(ip, geoData);  // Cache even null results
  return geoData;
}
```

**Why `has()` before `get()`:** In lru-cache v11, `get()` returns `undefined` for both missing and expired keys. `has()` is the only way to distinguish a miss from a cached null — critical for negative caching.

---

## Wrapper Class Pattern

```javascript
// DO: Wrapper class with same interface as underlying service
class CachedGeoLocator {
  constructor() {
    this.geoLocator = new GeoLocator();
    this.cache = new LRUCache({ max: 10000, ttl: 3600000, updateAgeOnGet: false });
    this.metrics = { hits: 0, misses: 0, startTime: Date.now() };
  }
  async initialize() { await this.geoLocator.initialize(); }
  get(ip) { /* cache-aside logic */ }
}
```

```javascript
// DON'T: Inline caching scattered throughout business logic
function enrichEvent(event) {
  if (cache.has(event.ip)) { geo = cache.get(event.ip); }
  else { geo = geoLocator.get(event.ip); cache.set(event.ip, geo); }
  // Cache logic mixed with enrichment — impossible to instrument or test
}
```

**Why:** Centralized caching makes hit rate monitoring, tuning, and testing trivial. Scattered cache reads/writes are unmaintainable. See the **maxmind** skill for the `GeoLocator` being wrapped.

---

## Negative Caching

```javascript
// DO: Cache null results — prevents repeated lookups of private/bogon IPs
const geoData = this.geoLocator.get(ip);
this.cache.set(ip, geoData);  // geoData may be null — intentional
```

```javascript
// DON'T: Only cache successful results
if (geoData) { this.cache.set(ip, geoData); }
// Private IPs (192.168.x.x, 10.x.x.x) hit MaxMind every time — destroys hit rate
```

**Why:** Firewall logs contain many private IPs that MaxMind cannot geolocate. Without negative caching, these trigger disk-backed MMDB lookups on every event, making the 80% hit rate target impossible.

---

## TTL Configuration

```javascript
// Fixed expiration (this codebase) — entry expires 1 hour after insertion
this.cache = new LRUCache({
  max: 10000,
  ttl: 1000 * 60 * 60,
  updateAgeOnGet: false,
});

// Sliding window — TTL resets on every access
// AVOID for geolocation: stale geo data for hot IPs persists indefinitely
this.cache = new LRUCache({
  max: 10000,
  ttl: 1000 * 60 * 60,
  updateAgeOnGet: true,   // WARNING: hot IPs never expire
});
```

**Decision rule:** Use fixed (`false`) when data has a natural freshness window. Use sliding (`true`) only for session-like data.

---

## WARNING: Anti-Patterns

### Using `get()` Alone for Cache Check

```javascript
// BAD — Cannot distinguish cache miss from cached null
const data = cache.get(key);
if (!data) { data = fetchFromSource(key); cache.set(key, data); }
```

**Why:** Null cached values trigger unnecessary fetches. Negative caching becomes impossible.

```javascript
// GOOD — Explicit existence check
if (cache.has(key)) { return cache.get(key); }
```

### No Cache Size Limit

```javascript
// BAD — Memory grows unbounded until OOM crash
const cache = new LRUCache({ ttl: 3600000 });  // No max!
```

**Why:** In lru-cache v11, omitting `max` without `maxSize` means no eviction. Unique IPs accumulate until Node.js OOMs.

```javascript
// GOOD — Always set max
const cache = new LRUCache({ max: 10000, ttl: 3600000 });
```

### Forgetting Async Initialization

```javascript
// BAD — Cache wrapper used before MaxMind DB loads
const cached = new CachedGeoLocator();
cached.get('8.8.8.8');  // Throws: MMDB reader is null
```

**Why:** Constructor creates cache synchronously but `GeoLocator` loads MMDB asynchronously.

```javascript
// GOOD — Always await initialize() before first get()
const cached = new CachedGeoLocator();
await cached.initialize();
cached.get('8.8.8.8');  // Safe
```

See the **maxmind** skill for database initialization details.
