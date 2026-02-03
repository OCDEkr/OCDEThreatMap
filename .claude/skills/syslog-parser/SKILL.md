---
name: syslog-parser
description: |
  Parses RFC 5424 syslog messages and Palo Alto firewall log formats.
  Use when: implementing syslog receivers, parsing firewall logs, extracting threat data from structured/CSV syslog formats, handling escape sequences in log messages.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Syslog Parser Skill

Parses RFC 5424 syslog messages using `nsyslog-parser-2` with custom field extraction for Palo Alto firewall logs. This codebase uses an event-driven pipeline where parsed messages flow through the **event-bus** singleton.

## Quick Start

### Basic Parser Setup

```javascript
const parser = require('nsyslog-parser-2');
const eventBus = require('../events/event-bus');

const parsed = parser(rawMessage, {
  cef: true,           // Enable CEF format for Palo Alto
  fields: true,        // Parse structured data
  pid: true,           // Extract PID from app[pid]
  generateTimestamp: false  // Don't auto-generate
});
```

### Extract Structured Data from RFC 5424

```javascript
// nsyslog-parser-2 doesn't extract [key=value] blocks automatically
if (parsed.message && parsed.message.includes('[')) {
  const structMatch = parsed.message.match(/\[([^\]]+)\]/);
  if (structMatch) {
    const kvPairs = structMatch[1].split(' ');
    kvPairs.forEach(kv => {
      const [key, value] = kv.split('=');
      if (key && value) parsed.structuredData[key] = value;
    });
  }
}
```

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| RFC 5424 | IETF syslog format with structured data | `<14>1 2024-01-26T10:00:00Z hostname...` |
| Priority | Facility + Severity encoded in angle brackets | `<14>` = facility 1, severity 6 |
| Structured Data | Key-value pairs in square brackets | `[pan@0 src=10.0.0.1 dst=192.168.1.1]` |
| CSV Format | Palo Alto comma-separated log fields | Field 8 = source IP, field 9 = dest IP |
| Action Filter | Only process DENY/DROP/BLOCK actions | Return `null` for ALLOW logs |

## Common Patterns

### Pre-process Escape Sequences

**When:** Logs contain `#012` (octal newline) or embedded newlines

```javascript
const cleanedMessage = rawMessage
  .replace(/#012/g, ' ')
  .replace(/\n/g, ' ')
  .trim();
```

### Validate IPv4 Before Use

**When:** Extracting IPs from untrusted input

```javascript
validateIPv4(ip) {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}
```

### Graceful Degradation on Parse Failure

**When:** Input may be malformed

```javascript
try {
  const parsed = parser(rawMessage, options);
  if (!parsed) throw new Error('Parser returned empty result');
  // Process...
} catch (err) {
  eventBus.emit('parse-error', {
    error: err.message,
    rawMessage,
    timestamp: new Date()
  });
  return null;  // Never crash
}
```

## See Also

- [patterns](references/patterns.md) - Field extraction, CSV parsing, threat categorization
- [workflows](references/workflows.md) - Testing, debugging, pipeline integration

## Related Skills

- **node** skill for EventEmitter patterns and module organization
- **express** skill for HTTP routes serving the dashboard
- **websocket** skill for broadcasting parsed events to clients
- **maxmind** skill for enriching parsed events with geolocation
- **lru-cache** skill for caching geolocation lookups