# Node.js Types Reference

## Contents
- JSDoc Conventions
- Event Payloads
- Configuration Objects
- Validation Patterns
- Anti-Patterns

## JSDoc Conventions

Plain JavaScript with JSDoc for type documentation. NEVER add TypeScript files or `@ts-check`.

```javascript
/**
 * @param {Object} options
 * @param {number} options.port - UDP port (default: 514)
 * @param {string} options.address - Bind address (default: '127.0.0.1')
 */
constructor(options = {}) {
  this.port = options.port || 514;
  this.address = options.address || '127.0.0.1';
}
```

## Event Payloads

Four event types flow through the pipeline. Each payload is a plain object — no classes, no prototypes.

### message Event (UDP Receiver to Event Bus)

```javascript
/** @typedef {Object} MessageEvent
 * @property {string} raw - Raw syslog message (UTF-8 decoded)
 * @property {string} remoteAddress - Sender IP
 * @property {number} remotePort - Sender port
 * @property {string} timestamp - ISO 8601 string
 */
const messageData = {
  raw: msg.toString('utf8'),
  remoteAddress: rinfo.address,
  remotePort: rinfo.port,
  timestamp: new Date().toISOString()
};
```

### parsed Event (Parser to Event Bus)

See the **syslog-parser** skill for field extraction details.

```javascript
/** @typedef {Object} ParsedEvent
 * @property {string} timestamp - Event timestamp
 * @property {string|null} sourceIP - Attack source IP
 * @property {string|null} destinationIP - Target IP
 * @property {string} threatType - malware|intrusion|ddos|unknown
 * @property {string} action - deny|allow|drop|block
 * @property {string} raw - Original syslog message
 */
```

### enriched Event (Enrichment to Event Bus)

See the **maxmind** skill for geo data structure.

```javascript
/** @typedef {Object} EnrichedEvent
 * @property {string} timestamp
 * @property {string|null} sourceIP
 * @property {string|null} destinationIP
 * @property {string} threatType
 * @property {string} action
 * @property {GeoData|null} geo - Geolocation data
 * @property {boolean} isOCDETarget - Destination in OCDE IP ranges
 * @property {number} enrichmentTime - Processing time in ms
 * @property {string} [enrichmentError] - Present only on failure
 */
```

### parse-error Event (Parser to Event Bus)

```javascript
/** @typedef {Object} ParseErrorEvent
 * @property {string} error - Error message
 * @property {string} rawMessage - Original message that failed
 * @property {Date} timestamp - When the error occurred
 */
```

## Configuration Objects

### LRU Cache Options

See the **lru-cache** skill for tuning guidance.

```javascript
/** @typedef {Object} CacheOptions
 * @property {number} max - Maximum cached IPs (10000)
 * @property {number} ttl - TTL in ms (3600000 = 1 hour)
 * @property {boolean} updateAgeOnGet - Reset TTL on access (false)
 */
this.cache = new LRUCache({ max: 10000, ttl: 3600000, updateAgeOnGet: false });
```

### UDP Socket Options

```javascript
const socketOptions = {
  type: 'udp4',
  reuseAddr: true,
  recvBufferSize: 33554432  // 32MB — handles burst traffic without drops
};
```

### Environment Variable Parsing

```javascript
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3000', 10);
const HTTP_BIND = process.env.HTTP_BIND_ADDRESS || '127.0.0.1';
const SYSLOG_PORT = parseInt(process.env.SYSLOG_PORT || '514', 10);
const isProduction = process.env.NODE_ENV === 'production';
```

## Validation Patterns

### Null-Safe Property Access

MaxMind lookups return deeply nested objects. Always use optional chaining:

```javascript
// GOOD — handles missing nested properties
return {
  latitude: result?.location?.latitude || null,
  longitude: result?.location?.longitude || null,
  city: result?.city?.names?.en || null,
  country: result?.country?.iso_code || null,
  countryName: result?.country?.names?.en || null
};
```

### Guard Clauses for Function Inputs

```javascript
// src/utils/ip-matcher.js
function isOCDETarget(ip, ranges) {
  if (!ip || !ranges || ranges.length === 0) return false;
  return ipRangeCheck(ip, ranges);
}
```

### Boolean Naming Convention

Use `is`/`has`/`should` prefixes consistently:

```javascript
ws.isAlive = true;
ws.isAuthenticated = !!session;
const isOCDETarget = ipMatcher.isOCDETarget(event.destinationIP, ranges);
const isProduction = process.env.NODE_ENV === 'production';
```

## Anti-Patterns

### WARNING: Inconsistent Return Types

**The Problem:**

```javascript
// BAD — returns string or falls through to undefined
extractSourceIP(parsed) {
  if (parsed.structuredData?.src) {
    return parsed.structuredData.src;
  }
  // Implicit undefined return
}
```

**Why This Breaks:**
1. Callers must check for both null and undefined
2. `undefined` becomes `"undefined"` in JSON payloads sent to dashboards
3. Optional chaining does not help — `undefined?.foo` is still undefined

**The Fix:**

```javascript
// GOOD — explicit null for "not found"
extractSourceIP(parsed) {
  return parsed.structuredData?.src || null;
}
```

### WARNING: parseInt Without Radix

**The Problem:**

```javascript
// BAD — parseInt('08') returns 0 in older engines (octal interpretation)
const port = parseInt(process.env.SYSLOG_PORT);
```

**The Fix:**

```javascript
// GOOD — always specify radix 10
const port = parseInt(process.env.SYSLOG_PORT || '514', 10);
```
