# Syslog Parser Patterns

## Contents
- Field Extraction Strategies
- CSV Format Parsing
- Threat Type Categorization
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
3. Missing 50%+ of valid logs

**The Fix:**

```javascript
// GOOD - Try multiple extraction strategies
extractSourceIP(parsed) {
  // Try structured data first
  if (parsed.structuredData?.src) {
    return this.validateIPv4(parsed.structuredData.src) 
      ? parsed.structuredData.src : null;
  }

  if (parsed.message) {
    // Try key=value format
    const kvMatch = parsed.message.match(/src=([0-9.]+)/i);
    if (kvMatch?.[1] && this.validateIPv4(kvMatch[1])) {
      return kvMatch[1];
    }

    // Try CSV format (field 8 is source IP)
    const csvParts = parsed.message.split(',');
    if (csvParts.length > 9 && csvParts[0] === '1') {
      const srcIP = csvParts[7];
      if (srcIP && this.validateIPv4(srcIP)) return srcIP;
    }
  }
  return null;
}
```

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
// Parse CSV-format Palo Alto log
const csvParts = parsed.message.split(',');
if (csvParts.length > 30 && csvParts[0] === '1') {
  const logType = csvParts[3];    // THREAT, TRAFFIC
  const subType = csvParts[4];    // url, vulnerability
  const srcIP = csvParts[7];
  const dstIP = csvParts[8];
  const action = csvParts[30];
}
```

### WARNING: Hardcoding Field Indices Without Validation

**The Problem:**
```javascript
// BAD - Assumes array length without checking
const srcIP = csvParts[7];  // Crashes if < 8 fields
```

**The Fix:**
```javascript
// GOOD - Validate array length first
if (csvParts.length > 9 && csvParts[0] === '1') {
  const srcIP = csvParts[7];
}
```

---

## Threat Type Categorization

Normalize varied threat labels to standard categories:

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

  if (t.includes('ddos') || t.includes('dos') ||
      t.includes('flood')) {
    return 'ddos';
  }

  return 'unknown';
}
```

---

## Event Bus Integration

The parser emits events to a singleton EventEmitter. See the **node** skill for EventEmitter patterns.

```javascript
// src/events/event-bus.js - Singleton pattern
const { EventEmitter } = require('events');
const eventBus = new EventEmitter();
eventBus.setMaxListeners(20);
module.exports = eventBus;
```

### Event Types

| Event | Emitter | When |
|-------|---------|------|
| `parsed` | PaloAltoParser | Successful DENY log parse |
| `parse-error` | PaloAltoParser | Parse failure |
| `enriched` | EnrichmentPipeline | After geo lookup |

```javascript
// Emitting parsed event
eventBus.emit('parsed', {
  timestamp,
  sourceIP,
  destinationIP,
  threatType,
  action,
  raw: rawMessage
});
```

---

## Dead Letter Queue Pattern

Failed messages go to `logs/failed-messages.jsonl` for analysis:

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
// GOOD - Prevent log file bloat
const entry = {
  timestamp: new Date().toISOString(),
  error: error.message,
  rawMessage: rawMessage.substring(0, 500),  // Truncate
  retryCount: 0
};
```

### DON'T: Block on File I/O

```javascript
// BAD - Synchronous write blocks event loop
fs.writeFileSync(file, JSON.stringify(entry));

// BETTER for high-volume - Buffer and flush periodically
this.buffer.push(entry);
if (this.buffer.length >= 100) this.flush();
```

---

## Action Filtering

Only process DENY/DROP/BLOCK actions. ALLOW logs are noise for threat visualization:

```javascript
const action = this.extractAction(parsed);
if (!action || action.toLowerCase() !== 'deny') {
  return null;  // Filter out, don't emit event
}
```

### Supported Actions

```javascript
const validDenyActions = ['deny', 'drop', 'block'];
const isBlocked = validDenyActions.includes(action.toLowerCase());
```