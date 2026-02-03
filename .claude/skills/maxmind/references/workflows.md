# MaxMind Workflows Reference

## Contents
- Database Setup and Updates
- Testing Geolocation
- Debugging Lookup Failures
- Performance Monitoring
- Production Deployment

## Database Setup and Updates

### Initial Setup

Download GeoLite2-City database from MaxMind (requires free account):

```bash
# Create data directory
mkdir -p data

# Download from MaxMind (replace YOUR_LICENSE_KEY)
curl -o GeoLite2-City.mmdb.gz \
  "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=YOUR_LICENSE_KEY&suffix=tar.gz"

# Extract and place in data/
tar -xzf GeoLite2-City.mmdb.gz
mv GeoLite2-City_*/GeoLite2-City.mmdb data/
```

### Database Update Workflow

MaxMind updates GeoLite2 weekly. Update process:

Copy this checklist and track progress:
- [ ] Download new database from MaxMind
- [ ] Backup current database: `cp data/GeoLite2-City.mmdb data/GeoLite2-City.mmdb.bak`
- [ ] Replace database file (no restart needed if `watchForUpdates: true`)
- [ ] Verify with test lookup
- [ ] Clear cache if using application-level caching

**Note:** Current config has `watchForUpdates: false`. Enable in production:

```javascript
// src/enrichment/geolocation.js:28
watchForUpdates: true  // Auto-reload when .mmdb file changes
```

## Testing Geolocation

### Manual Lookup Test

```javascript
// Quick test script
const { GeoLocator } = require('./src/enrichment/geolocation.js');

async function test() {
  const geo = new GeoLocator();
  await geo.initialize();

  // Public IP - should return location
  console.log('Google DNS:', geo.get('8.8.8.8'));

  // Private IP - should return null
  console.log('Private:', geo.get('192.168.1.1'));

  // Invalid - should return null
  console.log('Invalid:', geo.get('not-an-ip'));
}

test();
```

### Expected Test Results

| IP | Expected Result |
|----|-----------------|
| `8.8.8.8` | US coordinates |
| `1.1.1.1` | AU coordinates |
| `192.168.1.1` | `null` (private) |
| `10.0.0.1` | `null` (private) |
| `256.1.1.1` | `null` (invalid) |
| `malformed` | `null` (invalid) |

## Debugging Lookup Failures

### Symptom: All lookups return null

1. **Check database file exists:**
   ```bash
   ls -la data/GeoLite2-City.mmdb
   # Should show ~60-70MB file
   ```

2. **Verify initialization completed:**
   ```javascript
   // Add logging in geolocation.js
   console.log('GeoLocator initialized with MaxMind GeoLite2-City database');
   ```

3. **Check for corrupted database:**
   ```bash
   # Re-download if size is wrong or file is truncated
   file data/GeoLite2-City.mmdb
   # Should output: "MaxMind database"
   ```

### Symptom: Some IPs fail that should work

1. **Verify IP format:**
   ```javascript
   // Must be dotted decimal IPv4
   geo.get('8.8.8.8');       // ✓ Valid
   geo.get('8.8.8.8:80');    // ✗ Invalid (includes port)
   geo.get('2001:4860::');   // ✗ IPv6 not validated
   ```

2. **Check if IP is in database:**
   ```javascript
   // Some rare public IPs may not be in GeoLite2
   const result = geo.get('some-ip');
   if (!result) {
     console.log('IP not found in database');
   }
   ```

### Symptom: High enrichment latency

Check cache hit rate. Target is 80%+:

```javascript
const metrics = geoLocator.getMetrics();
console.log(`Hit rate: ${metrics.hitRate}%`);
// If below 80%, investigate traffic patterns
```

**Causes of low hit rate:**
- Many unique source IPs (DDoS, scan traffic)
- Cache size too small for traffic volume
- TTL too short

## Performance Monitoring

### Enable Metrics Logging

```javascript
// src/enrichment/cache.js:94
this.geoLocator.startMetricsLogging(30000);  // Every 30 seconds
```

**Output format:**
```
[GeoCache] Hits: 847 | Misses: 153 | Hit Rate: 84.70% | Cache Size: 153/10000
```

### Metrics to Monitor

| Metric | Target | Action if Off-Target |
|--------|--------|---------------------|
| Hit Rate | >80% | Increase cache size or TTL |
| Cache Size | <max | Normal operation |
| Enrichment Time | <5000ms | Check MaxMind internal cache |

### Cache Tuning

If hit rate is consistently low:

```javascript
// Increase cache size (memory trade-off)
this.cache = new LRUCache({
  max: 50000,  // 5x default
  ttl: 1000 * 60 * 60 * 4,  // 4 hours TTL
});
```

## Production Deployment

### Pre-Deployment Checklist

Copy this checklist and track progress:
- [ ] GeoLite2-City.mmdb exists in `data/`
- [ ] Database file is readable by Node.js process
- [ ] Memory available for ~100MB (database + cache)
- [ ] Test lookup works with sample IPs
- [ ] Metrics logging enabled for monitoring
- [ ] Consider enabling `watchForUpdates: true`

### Startup Order

The enrichment pipeline must initialize before receiving messages:

```javascript
// src/app.js:136-139
async function start() {
  await enrichmentPipeline.initialize();  // Load MaxMind first
  // ... then start HTTP and syslog receivers
}
```

This ensures no messages are processed without geo data available.

### Shutdown

Stop metrics logging on graceful shutdown:

```javascript
// src/app.js:189
enrichmentPipeline.shutdown();  // Calls geoLocator.stopMetricsLogging()
```