# Node.js Types Reference

## Contents
- Type Conventions
- JSDoc Patterns
- Common Structures
- Validation Patterns

## Type Conventions

This codebase uses JSDoc for type documentation (no TypeScript):

```javascript
/**
 * Create a new SyslogReceiver instance
 * @param {Object} options - Configuration options
 * @param {number} options.port - UDP port to listen on (default: 514)
 * @param {string} options.address - IP address to bind to (default: '0.0.0.0')
 */
constructor(options = {}) {
  this.port = options.port || 514;
  this.address = options.address || '0.0.0.0';
}
```

## Common Structures

### Event Payloads

**Message event (from UDP receiver):**

```javascript
/**
 * @typedef {Object} MessageEvent
 * @property {string} raw - Raw syslog message string
 * @property {string} remoteAddress - Sender IP address
 * @property {number} remotePort - Sender port
 * @property {string} timestamp - ISO 8601 timestamp
 */
const messageData = {
  raw: msg.toString('utf8'),
  remoteAddress: rinfo.address,
  remotePort: rinfo.port,
  timestamp: new Date().toISOString()
};
```

**Parsed event:**

```javascript
/**
 * @typedef {Object} ParsedEvent
 * @property {string} timestamp - Event timestamp
 * @property {string|null} sourceIP - Attack source IP
 * @property {string|null} destinationIP - Target IP
 * @property {string} threatType - malware|intrusion|ddos|unknown
 * @property {string} action - deny|allow|drop|block
 * @property {string} raw - Original message
 */
```

**Enriched event:**

```javascript
/**
 * @typedef {Object} EnrichedEvent
 * @property {string} timestamp
 * @property {string|null} sourceIP
 * @property {string|null} destinationIP
 * @property {string} threatType
 * @property {string} action
 * @property {GeoData|null} geo - Geolocation data
 * @property {boolean} isOCDETarget - Targets OCDE infrastructure
 * @property {number} enrichmentTime - Processing time in ms
 */
```

### Configuration Objects

**LRU Cache options:**

```javascript
/**
 * @typedef {Object} CacheOptions
 * @property {number} max - Maximum items (10000)
 * @property {number} ttl - Time-to-live in ms (3600000 = 1 hour)
 * @property {boolean} updateAgeOnGet - Reset TTL on access (false)
 */
this.cache = new LRUCache({
  max: 10000,
  ttl: 1000 * 60 * 60,
  updateAgeOnGet: false
});
```

## Validation Patterns

### IPv4 Validation

```javascript
/**
 * Validate IPv4 address format
 * @param {string} ip - IP address string
 * @returns {boolean} - True if valid IPv4
 */
validateIPv4(ip) {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}
```

### Safe Type Coercion

```javascript
// BAD - parseInt without radix
const port = parseInt(process.env.SYSLOG_PORT);

// GOOD - Always specify radix
const port = parseInt(process.env.SYSLOG_PORT || '514', 10);
```

### Null-Safe Property Access

```javascript
// GOOD - Optional chaining for deep properties
return {
  latitude: result?.location?.latitude || null,
  longitude: result?.location?.longitude || null,
  city: result?.city?.names?.en || null,
  country: result?.country?.iso_code || null
};
```

## Return Type Consistency

### WARNING: Inconsistent Return Types

**The Problem:**

```javascript
// BAD - Returns undefined implicitly
extractSourceIP(parsed) {
  if (parsed.structuredData?.src) {
    return parsed.structuredData.src;
  }
  // Falls through to undefined
}
```

**The Fix:**

```javascript
// GOOD - Explicit null for "not found"
extractSourceIP(parsed) {
  if (parsed.structuredData?.src) {
    return this.validateIPv4(parsed.structuredData.src) 
      ? parsed.structuredData.src 
      : null;
  }
  return null;  // Explicit return
}
```

## Boolean Naming

Use `is`, `has`, `should` prefixes for boolean variables:

```javascript
ws.isAlive = true;
const hadError = false;
const isRotating = true;
const isOCDETarget = isOCDETarget(event.destinationIP, ranges);
```