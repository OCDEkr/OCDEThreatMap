# MaxMind Workflows Reference

## Contents
- Database Setup and Updates
- Testing Geolocation
- Debugging Lookup Failures
- Performance Monitoring and Cache Tuning
- Production Deployment

## Database Setup and Updates

### Initial Setup

```bash
mkdir -p data
# Download from MaxMind (replace YOUR_LICENSE_KEY)
curl -o GeoLite2-City.tar.gz \
  "https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=YOUR_LICENSE_KEY&suffix=tar.gz"
tar -xzf GeoLite2-City.tar.gz
mv GeoLite2-City_*/GeoLite2-City.mmdb data/
rm -rf GeoLite2-City.tar.gz GeoLite2-City_*/
```

Requires a free MaxMind account. GeoLite2-City provides city-level accuracy — sufficient for arcs originating from country centers.

### Database Update Checklist

MaxMind updates GeoLite2 weekly. Current config: `watchForUpdates: false`.

- [ ] Download new database from MaxMind
- [ ] Backup current: `cp data/GeoLite2-City.mmdb data/GeoLite2-City.mmdb.bak`
- [ ] Replace database file in `data/`
- [ ] Restart application (or set `watchForUpdates: true` for hot reload)
- [ ] Verify with test lookup against known IP (`8.8.8.8`)
- [ ] Check cache metrics for anomalies after update

## Testing Geolocation

### Quick Validation Script

```javascript
const { GeoLocator } = require('./src/enrichment/geolocation.js');
async function test() {
  const geo = new GeoLocator();
  await geo.initialize();
  console.log('Google DNS:', geo.get('8.8.8.8'));     // US coords
  console.log('Cloudflare:', geo.get('1.1.1.1'));     // AU coords
  console.log('Private:', geo.get('192.168.1.1'));    // null
  console.log('Invalid:', geo.get('not-an-ip'));      // null
}
test();
```

### Integration Test with Cache

```javascript
const { CachedGeoLocator } = require('./src/enrichment/cache.js');
async function testCache() {
  const geo = new CachedGeoLocator();
  await geo.initialize();
  geo.get('8.8.8.8');                    // miss
  geo.get('8.8.8.8');                    // hit
  geo.get('192.168.1.1');               // miss (null cached)
  geo.get('192.168.1.1');               // hit (null from cache)
  const m = geo.getMetrics();
  console.log(m);                        // hits: 2, misses: 2, hitRate: 50.00
  console.assert(m.hits === 2, 'Expected 2 hits');
  console.assert(m.misses === 2, 'Expected 2 misses');
}
testCache();
```

### Full Pipeline Test

```bash
# Terminal 1 — start server
SYSLOG_PORT=5514 node src/app.js
# Terminal 2 — send random attacks
node test/send-random-attacks.js
```

Watch for `[ENRICHED]` log lines with geo data and `[GeoCache]` metrics every 30s. See the **syslog-parser** skill for message formats.

## Debugging Lookup Failures

### All Lookups Return Null

| Check | Command/Action | Expected |
|-------|---------------|----------|
| Database exists | `ls -la data/GeoLite2-City.mmdb` | ~60-70MB file |
| Init succeeded | Check console for `GeoLocator initialized` | Message present |
| Traffic is external | Check source IPs in `[ENRICHED]` logs | Public IPs (not 10.x, 192.168.x) |

### Some Public IPs Return Null

| Symptom | Cause | Fix |
|---------|-------|-----|
| `8.8.8.8:80` returns null | Port in IP string | Strip port before lookup in parser |
| `2001:db8::1` returns null | IPv6 address | Expected — project only handles IPv4 |
| Random public IP null | Not in GeoLite2 | Rare — verify with `8.8.8.8` first |

### Diagnosis Loop

1. Check database exists and is correct size (~60-70MB)
2. Verify `GeoLocator initialized` log message appeared at startup
3. Test with known-good IP (`8.8.8.8`) using validation script above
4. If known-good works, inspect failing IP format (port suffix? IPv6?)
5. If known-good fails, re-download database and replace
6. Only proceed when known-good returns valid coordinates

## Performance Monitoring and Cache Tuning

### Metrics Logging

Enabled by default at 30-second intervals (`enrichment-pipeline.js:29`):

```javascript
this.geoLocator.startMetricsLogging(30000);
// Output: [GeoCache] Hits: 847 | Misses: 153 | Hit Rate: 84.70% | Cache Size: 153/10000
```

| Metric | Target | Action If Off-Target |
|--------|--------|---------------------|
| Hit Rate | >80% | Increase `max` in LRU or extend TTL |
| Cache Size | <10000 | Normal — LRU eviction working correctly |
| Enrichment Time | <5000ms | Check MaxMind internal cache, disk I/O |

### Cache Tuning for High-Cardinality Traffic

If hit rate stays below 80% (DDoS, port scans, botnets):

```javascript
// src/enrichment/cache.js — adjust constructor
this.cache = new LRUCache({
  max: 50000,                   // 5x default (~10MB extra RAM)
  ttl: 1000 * 60 * 60 * 4,     // 4 hours TTL
  updateAgeOnGet: false,
});
```

See the **lru-cache** skill for detailed tuning.

### Tuning Feedback Loop

1. Start server: `SYSLOG_PORT=5514 node src/app.js`
2. Run simulator: `node test/send-random-attacks.js`
3. Watch `[GeoCache]` log lines for hit rate
4. If hit rate < 80% after 100+ lookups, increase `max`
5. Restart and repeat until hit rate exceeds 80%

## Production Deployment

### Pre-Deployment Checklist

- [ ] `data/GeoLite2-City.mmdb` exists and is ~60-70MB
- [ ] Database readable by Node.js process user
- [ ] ~100MB memory available for database + cache overhead
- [ ] Test lookup returns coordinates for `8.8.8.8`
- [ ] `OCDE_IP_RANGES` env var set if target detection needed
- [ ] Consider `watchForUpdates: true` for automatic DB refresh

### Startup Order

Enrichment MUST initialize before UDP receiver accepts traffic. See the **node** skill for async initialization patterns.

```javascript
// src/app.js:192-218
async function start() {
  await enrichmentPipeline.initialize(); // 1. Load MaxMind DB
  server.listen(httpPort, httpBindAddress); // 2. HTTP server
  setupWebSocketServer(server, sessionParser); // 3. WebSocket
  await receiver.listen(); // 4. Syslog receiver LAST
}
```

**Why this order:** If the receiver starts before MaxMind loads, `get()` throws. Events would emit with `geo: null` for the first burst, showing arcs without origin data.

### Graceful Shutdown

```javascript
enrichmentPipeline.shutdown(); // Stops 30s metrics interval, prevents timer leak
```

Calls `stopMetricsLogging()` which clears the `setInterval` handle. Without this, the Node.js process hangs on exit.
