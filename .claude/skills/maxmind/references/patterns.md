# MaxMind Patterns Reference

## Contents
- Initialization Patterns
- Caching Patterns
- Error Handling
- Response Structure
- Anti-Patterns

## Initialization Patterns

### Async Initialization is Required

The MaxMind database must be loaded into memory before lookups. The `initialize()` method is async and must complete before calling `get()`.

```javascript
// CORRECT - Await initialization
const geo = new GeoLocator();
await geo.initialize();  // Loads ~60MB database into memory
const result = geo.get('8.8.8.8');
```

```javascript
// WRONG - Will throw "GeoLocator not initialized"
const geo = new GeoLocator();
const result = geo.get('8.8.8.8');  // Error!
```

### Database Path Configuration

Database path is hardcoded relative to the geolocation module:

```javascript
// src/enrichment/geolocation.js:22
const dbPath = path.join(__dirname, '../../data/GeoLite2-City.mmdb');
```

**Expected location:** `data/GeoLite2-City.mmdb` from project root.

## Caching Patterns

### Cache Configuration

The project uses a two-layer cache:
1. **MaxMind internal cache** (10,000 items) - built into `maxmind.open()`
2. **LRU application cache** (10,000 items, 1-hour TTL) - wraps the GeoLocator

```javascript
// src/enrichment/cache.js:13-17
this.cache = new LRUCache({
  max: 10000,              // Maximum cached IPs
  ttl: 1000 * 60 * 60,     // 1 hour TTL
  updateAgeOnGet: false,   // Don't reset TTL on access
});
```

**Why `updateAgeOnGet: false`:** Geo data doesn't change often. Resetting TTL on every access would keep stale data longer. Fixed TTL ensures periodic refresh.

### Cache Null Values

The cache stores `null` results for private/invalid IPs to prevent repeated database lookups:

```javascript
// src/enrichment/cache.js:56-57
const geoData = this.geoLocator.get(ip);
this.cache.set(ip, geoData);  // Even if null
```

This prevents performance degradation when logs contain many internal IPs.

## Error Handling

### Graceful Degradation

Never crash on lookup failures. Return `null` and let the pipeline continue:

```javascript
// src/enrichment/geolocation.js:50-69
try {
  const result = this.lookup.get(ip);
  if (!result) return null;  // IP not in database
  return { latitude, longitude, city, country, countryName };
} catch (err) {
  console.error(`GeoLocator error for IP ${ip}:`, err.message);
  return null;  // Don't throw - let pipeline continue
}
```

### Enrichment Pipeline Error Flow

Even when geo lookup fails, the pipeline emits an enriched event with `geo: null`:

```javascript
// src/enrichment/enrichment-pipeline.js:86-93
this.eventBus.emit('enriched', {
  ...event,
  geo: null,
  isOCDETarget: targetingOCDE,
  enrichmentError: err.message,
  enrichmentTime: Date.now() - startTime
});
```

## Response Structure

### Successful Lookup

```javascript
{
  latitude: 37.751,
  longitude: -97.822,
  city: 'Mountain View',      // null if not available
  country: 'US',              // ISO 3166-1 alpha-2
  countryName: 'United States'
}
```

### Failed Lookup

Returns `null` for:
- Private IP ranges (10.x, 192.168.x, 172.16-31.x)
- Invalid IP formats
- IPs not in database (very rare for public IPs)

## Anti-Patterns

### WARNING: Synchronous Initialization

**The Problem:**

```javascript
// BAD - Blocking the event loop
const geo = new GeoLocator();
geo.initializeSync();  // Doesn't exist, but illustrates the issue
```

**Why This Breaks:**
1. Loading 60MB database blocks Node.js event loop
2. All incoming syslog messages queue up during load
3. Potential message buffer overflow on high-volume streams

**The Fix:** Always use async initialization at startup:

```javascript
async function start() {
  await enrichmentPipeline.initialize();  // Block startup, not runtime
  // ... start receiver after geo is ready
}
```

### WARNING: Unbounded Cache

**The Problem:**

```javascript
// BAD - No size limit
this.cache = new Map();  // Grows forever
```

**Why This Breaks:**
1. Memory leak as unique IPs accumulate
2. Node.js process eventually crashes with OOM
3. Attack traffic can deliberately exhaust memory

**The Fix:** Use LRU cache with bounded size. See the **lru-cache** skill.

### WARNING: Skipping IPv4 Validation

**The Problem:**

```javascript
// BAD - Passing arbitrary strings to MaxMind
const result = this.lookup.get(userInput);
```

**Why This Breaks:**
1. Non-IP strings can cause unexpected behavior
2. IPv6 addresses may not be handled correctly
3. Malformed input wastes cache space

**The Fix:**

```javascript
// src/enrichment/geolocation.js:46-48
if (!this.isValidIPv4(ip)) {
  return null;
}
```