# LRU Cache Patterns Reference

## Contents
- Cache-Aside Pattern
- Wrapper Class Pattern
- Negative Caching
- TTL Configuration
- Anti-Patterns

---

## Cache-Aside Pattern

The standard pattern in this codebase. Check cache first, fetch on miss, store result.

```javascript
// From src/enrichment/cache.js:44-60
get(ip) {
  // Check if IP exists in cache (handles both hit and stale)
  if (this.cache.has(ip)) {
    this.metrics.hits++;
    return this.cache.get(ip);
  }

  // Cache miss - lookup and cache result
  this.metrics.misses++;
  const geoData = this.geoLocator.get(ip);
  
  // Cache the result (even if null)
  this.cache.set(ip, geoData);
  return geoData;
}
```

**Why `has()` before `get()`:** The `get()` method returns `undefined` for both missing keys AND keys explicitly set to `undefined`. Using `has()` first distinguishes cache miss from cached null/undefined.

---

## Wrapper Class Pattern

Encapsulate cache logic in a dedicated class that mirrors the underlying service interface.

```javascript
// DO: Wrapper class with same interface
class CachedGeoLocator {
  constructor() {
    this.geoLocator = new GeoLocator();
    this.cache = new LRUCache({ max: 10000, ttl: 3600000 });
    this.metrics = { hits: 0, misses: 0 };
  }
  
  async initialize() {
    await this.geoLocator.initialize();
  }
  
  get(ip) { /* cache-aside logic */ }
}

// DON'T: Inline caching scattered throughout code
const cache = new LRUCache({ max: 10000 });
function enrichEvent(event) {
  if (cache.has(event.ip)) { /* ... */ }  // Cache logic mixed with business logic
}
```

**Why this matters:** Centralized caching makes hit rate monitoring, cache tuning, and testing significantly easier. Scattered caching becomes unmaintainable.

---

## Negative Caching

Cache failed lookups to prevent repeated expensive operations on invalid inputs.

```javascript
// DO: Cache null results
const geoData = this.geoLocator.get(ip);
this.cache.set(ip, geoData);  // geoData may be null - that's intentional

// DON'T: Only cache successful results
const geoData = this.geoLocator.get(ip);
if (geoData) {
  this.cache.set(ip, geoData);  // Private IPs will be looked up every time
}
```

**Why this matters:** Invalid IPs (private ranges, bogon addresses) return null. Without negative caching, every request for `192.168.1.1` hits the MaxMind database unnecessarily.

---

## TTL Configuration

### Fixed Expiration (This Codebase)

```javascript
this.cache = new LRUCache({
  max: 10000,
  ttl: 1000 * 60 * 60,     // 1 hour
  updateAgeOnGet: false,   // Entries expire at fixed time, not sliding window
});
```

**Use fixed expiration when:** Data has a natural staleness threshold (geo data rarely changes, but should refresh periodically).

### Sliding Window Expiration

```javascript
this.cache = new LRUCache({
  max: 10000,
  ttl: 1000 * 60 * 60,
  updateAgeOnGet: true,    // Reset TTL on every access
});
```

**Use sliding window when:** You want to keep hot data indefinitely while evicting cold data.

---

## WARNING: Common Anti-Patterns

### Using `get()` Alone for Cache Check

**The Problem:**

```javascript
// BAD - Cannot distinguish cache miss from cached null
const data = cache.get(key);
if (!data) {
  // Is this a miss or did we cache null?
  data = fetchFromSource(key);
  cache.set(key, data);
}
```

**Why This Breaks:**
1. Null/undefined cached values trigger unnecessary fetches
2. Negative caching becomes impossible
3. Hit rate metrics become unreliable

**The Fix:**

```javascript
// GOOD - Explicit cache check
if (cache.has(key)) {
  return cache.get(key);  // May return null - that's fine
}
```

---

### No Cache Size Limit

**The Problem:**

```javascript
// BAD - Unbounded cache
const cache = new LRUCache({ ttl: 3600000 });  // No max!
```

**Why This Breaks:**
Memory grows unbounded until process crashes. Under high-volume syslog ingestion, unique IPs accumulate rapidly.

**The Fix:**

```javascript
// GOOD - Always set max
const cache = new LRUCache({ max: 10000, ttl: 3600000 });
```

---

### Forgetting Async Initialization

**The Problem:**

```javascript
// BAD - Using cache before underlying service is ready
class CachedService {
  constructor() {
    this.cache = new LRUCache({ max: 1000 });
    this.service = new SlowService();  // Not initialized!
  }
  
  get(key) {
    if (!this.cache.has(key)) {
      return this.service.fetch(key);  // Throws: service not ready
    }
  }
}
```

**The Fix:**

```javascript
// GOOD - Explicit async initialization
async initialize() {
  await this.service.initialize();
  console.log('CachedService ready');
}