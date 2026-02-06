# Syslog Parser Patterns

## Contents
- Field Extraction Strategies
- CSV Format Parsing
- Threat Type Categorization
- Action Filtering
- Event Bus Integration
- Dead Letter Queue Pattern

## Field Extraction Strategies

### WARNING: Assuming Single Extraction Method

**The Problem:**

```javascript
// BAD - Only tries key=value format
extractSourceIP(parsed) {
  const match = parsed.message.match(/src=([0-9.]+)/i);
  return match ? match[1] : null;
}
```

**Why This Breaks:**
1. Palo Alto logs come in BOTH key=value AND CSV formats
2. CSV format is more common in production THREAT logs
3. Missing 50%+ of valid logs silently -- no error, just null IPs

**The Fix:**

```javascript
// GOOD - Layered extraction: structuredData -> key=value -> CSV
extractSourceIP(parsed) {
  if (parsed.structuredData?.src) {
    return this.validateIPv4(parsed.structuredData.src)
      ? parsed.structuredData.src : null;
  }
  if (parsed.message) {
    const kvMatch = parsed.message.match(/src=([0-9.]+)/i);
    if (kvMatch?.[1] && this.validateIPv4(kvMatch[1])) return kvMatch[1];

    const csvParts = parsed.message.split(',');
    if (csvParts.length > 9 && csvParts[0] === '1') {
      const srcIP = csvParts[7];
      if (srcIP && this.validateIPv4(srcIP)) return srcIP;
    }
  }
  return null;
}
```

**When You Might Be Tempted:** When testing with only structured data samples (`[pan@0 src=... dst=...]`). Production Palo Alto firewalls send CSV-format THREAT logs far more often.

---

## CSV Format Parsing

Palo Alto THREAT logs use comma-separated format with specific field positions:

| Field Index | Content | Example |
|-------------|---------|---------|
| 0 | Format version | `1` |
| 3 | Log type | `THREAT` |
| 4 | Subtype | `url`, `vulnerability`, `spyware` |
| 7 | Source IP | `192.168.1.100` |
| 8 | Destination IP | `203.0.113.50` |
| 30 | Action | `deny`, `allow`, `drop` |
| 33 | Threat/content type | `malware`, `intrusion` |

```javascript
const csvParts = parsed.message.split(',');
if (csvParts.length > 30 && csvParts[0] === '1') {
  const logType = csvParts[3];    // THREAT, TRAFFIC
  const subType = csvParts[4];    // url, vulnerability
  const srcIP = csvParts[7];
  const dstIP = csvParts[8];
  const action = csvParts[30];
}
```

### WARNING: Hardcoding Field Indices Without Length Check

**The Problem:**
```javascript
// BAD - No bounds check, crashes on short messages
const srcIP = csvParts[7];
const action = csvParts[30];
```

**Why This Breaks:**
1. Truncated syslog messages over UDP produce short arrays
2. Array out-of-bounds returns `undefined`, not an error -- silent data corruption
3. `undefined.toLowerCase()` throws TypeError, crashing the pipeline

**The Fix:**
```javascript
// GOOD - Validate array length AND format version marker
if (csvParts.length > 30 && csvParts[0] === '1') {
  const action = csvParts[30];
  if (action && ['deny', 'allow', 'drop', 'block'].includes(action.toLowerCase())) {
    return action.toLowerCase();
  }
}
```

---

## Threat Type Categorization

Normalize varied Palo Alto threat labels into standard display categories:

```javascript
categorizeThreat(threat) {
  const t = threat.toLowerCase();

  if (t.includes('malware') || t.includes('virus') ||
      t.includes('trojan') || t.includes('spyware') ||
      t.includes('url')) {
    return 'malware';
  }
  if (t.includes('intrusion') || t.includes('exploit') ||
      t.includes('vulnerability') || t.includes('brute')) {
    return 'intrusion';
  }
  if (t.includes('ddos') || t.includes('dos') || t.includes('flood')) {
    return 'ddos';
  }
  return 'unknown';
}
```

Categories map to dashboard display colors in the **frontend-design** skill. Adding a new category requires updating both the parser and the client-side color mapping.

---

## Action Filtering

Only DENY/DROP/BLOCK actions pass through. ALLOW logs are noise for threat visualization:

```javascript
const action = this.extractAction(parsed);
if (!action || action.toLowerCase() !== 'deny') {
  return null;  // Filter out, don't emit event
}
```

### WARNING: Not Filtering Before Expensive Operations

**The Problem:**
```javascript
// BAD - Geo lookup before checking action wastes cache capacity
const geo = this.geoLocator.get(event.sourceIP);
const action = this.extractAction(parsed);
if (action !== 'deny') return null;
```

**Why This Breaks:**
1. ALLOW logs can be 10x more frequent than DENY logs
2. MaxMind lookups and LRU cache fills are wasted on discarded events
3. Pollutes cache with IPs that will never be displayed

**The Fix:**
Action extraction and filtering happen FIRST in `PaloAltoParser.parse()`, before any event is emitted to the enrichment pipeline.

---

## Event Bus Integration

The parser emits events to a singleton EventEmitter. See the **node** skill for EventEmitter patterns.

```javascript
// src/events/event-bus.js
const { EventEmitter } = require('events');
const eventBus = new EventEmitter();
eventBus.setMaxListeners(20);
module.exports = eventBus;
```

### Event Flow

| Event | Emitter | Payload |
|-------|---------|---------|
| `parsed` | PaloAltoParser | `{ timestamp, sourceIP, destinationIP, threatType, action, raw }` |
| `parse-error` | PaloAltoParser | `{ error, rawMessage, timestamp }` |
| `enriched` | EnrichmentPipeline | `{ ...parsed, geo, isOCDETarget, enrichmentTime }` |

```javascript
// Emitting parsed event (inside PaloAltoParser.parse())
eventBus.emit('parsed', {
  timestamp,
  sourceIP,
  destinationIP,
  threatType,
  action,
  raw: rawMessage
});
```

See the **maxmind** skill for the enrichment pipeline that consumes `parsed` events and the **websocket** skill for broadcasting `enriched` events.

---

## Dead Letter Queue Pattern

Failed messages persist to `logs/failed-messages.jsonl` for post-incident analysis:

```javascript
// JSONL format - one JSON object per line
{
  "timestamp": "2024-01-26T10:15:30.000Z",
  "error": "Parser returned empty result",
  "rawMessage": "<14>1 2024-01-26...",
  "retryCount": 0
}
```

### DO: Truncate Raw Messages

```javascript
// GOOD - Prevent log file bloat from oversized syslog payloads
const entry = {
  timestamp: new Date().toISOString(),
  error: error.message,
  rawMessage: rawMessage.substring(0, 500),
  retryCount: 0
};
```

### WARNING: Synchronous File I/O in Hot Path

**The Problem:**
```javascript
// Current implementation uses sync writes
fs.appendFileSync(file, JSON.stringify(entry) + '\n');
```

**Why This Is Risky:**
1. Under high error rates, sync writes block the event loop
2. Each `appendFileSync` call incurs a syscall overhead
3. At 1000+ errors/second, this becomes a bottleneck

**When Acceptable:** Current implementation is acceptable because parse errors are infrequent relative to successful parses. If error rates exceed 10% consistently, buffer and batch-flush:

```javascript
// BETTER for high-volume error scenarios
this.buffer.push(entry);
if (this.buffer.length >= 50) {
  fs.appendFile(file, this.buffer.map(JSON.stringify).join('\n') + '\n', () => {});
  this.buffer = [];
}
```
