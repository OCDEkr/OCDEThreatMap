# Syslog Parser Workflows

## Contents
- Adding New Log Formats
- Testing Parser Changes
- Debugging Parse Failures
- Pipeline Integration
- Performance Tuning

## Adding New Log Formats

Copy this checklist and track progress:
- [ ] Step 1: Collect 5+ sample logs in `test/fixtures/`
- [ ] Step 2: Identify field positions (CSV) or key names (structured)
- [ ] Step 3: Add extraction method in parser class
- [ ] Step 4: Add test cases for new format
- [ ] Step 5: Verify 60%+ parse success rate
- [ ] Step 6: Test graceful degradation on malformed input

### Workflow

1. Add samples to `test/fixtures/palo-alto-samples.txt`:
```
<14>1 2024-01-26T10:00:00Z PA-NEW src=10.0.0.1 dst=192.168.1.1 action=deny threat_type=newtype
```

2. Run tests to see current behavior:
```bash
node test/test-parser.js
```

3. If parse fails, add extraction logic:
```javascript
// Try new format in extractSourceIP()
const newMatch = parsed.message.match(/new_src_field=([0-9.]+)/i);
if (newMatch?.[1]) return this.validateIPv4(newMatch[1]) ? newMatch[1] : null;
```

4. Iterate until tests pass:
```bash
node test/test-parser.js
# If validation fails, fix issues and repeat
```

---

## Testing Parser Changes

### Run Test Suite

```bash
node test/test-parser.js
```

### Expected Output

```
==================================================
PALO ALTO PARSER TEST SUITE
==================================================

TEST: Field Extraction
----------------------------------------
✓ PASS: Standard RFC 5424 field extraction
✓ PASS: Structured data field extraction

TEST: Action Filtering
----------------------------------------
✓ PASS: ALLOW logs filtered

TEST: Parse Success Rate
----------------------------------------
Parse success rate: 70.0% (parsed 7/10 samples)
✓ SUCCESS: Parse success rate meets expected threshold (60-80%)
```

### Test Categories

| Test | Purpose | Pass Criteria |
|------|---------|---------------|
| Field Extraction | Verify IP/action/threat parsing | Exact field match |
| Escape Sequences | Handle `#012`, `\n` in messages | No crash |
| Action Filtering | Skip ALLOW logs | No `parsed` event |
| Graceful Degradation | Handle malformed input | No crash, emit `parse-error` |
| Success Rate | Overall parse quality | ≥60% |

---

## Debugging Parse Failures

### Check Dead Letter Queue

```bash
# View recent failures
tail -20 logs/failed-messages.jsonl | jq .

# Count failures by error type
cat logs/failed-messages.jsonl | jq -r '.error' | sort | uniq -c
```

### Manual Message Testing

```bash
# Start server on dev port
SYSLOG_PORT=5514 node src/app.js &

# Send test message
echo '<14>1 2024-01-26T10:00:00Z PA-VM - - - [pan@0 src=192.168.1.100 dst=10.0.0.50 action=deny threat_type=malware] Test' | nc -u localhost 5514

# Check console output for parse results
```

### Debug Extraction Issues

```javascript
// Add temporary logging
parse(rawMessage) {
  console.log('RAW:', rawMessage.substring(0, 200));
  const parsed = parser(rawMessage, options);
  console.log('PARSED:', JSON.stringify(parsed, null, 2));
  // ...
}
```

### Common Failure Patterns

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `null` sourceIP | Wrong CSV field index | Check Palo Alto version docs |
| Empty structuredData | Parser not extracting brackets | Manual regex extraction |
| All messages filtered | Action field not found | Add extraction method |
| Crashes on input | Unhandled exception | Add try/catch |

---

## Pipeline Integration

The parser integrates with the enrichment pipeline via EventEmitter. See the **node** skill for event patterns.

### Data Flow

```
UDP Receiver → Parser → Event Bus → Enrichment → WebSocket
    ↓             ↓          ↓           ↓
 'message'    'parsed'   'enriched'  broadcast
```

### Wiring in app.js

```javascript
const eventBus = require('./events/event-bus');
const { PaloAltoParser } = require('./parsers/palo-alto-parser');
const { SyslogReceiver } = require('./receivers/udp-receiver');

const parser = new PaloAltoParser();
const receiver = new SyslogReceiver({ port: 5514 });

// Wire receiver → parser
receiver.on('message', (data) => {
  parser.parse(data.raw);
});

// Parser emits to eventBus internally
// Enrichment listens to eventBus.on('parsed', ...)
```

---

## Performance Tuning

### UDP Buffer Size

```javascript
// In udp-receiver.js - Handle high-volume traffic
this.socket = dgram.createSocket({
  type: 'udp4',
  reuseAddr: true,
  recvBufferSize: 33554432  // 32MB buffer
});
```

### Parser Options

```javascript
// Minimal options for speed
const parsed = parser(rawMessage, {
  cef: true,
  fields: true,
  pid: false,              // Skip if not needed
  generateTimestamp: false // Don't auto-generate
});
```

### Avoid Blocking Operations

```javascript
// DON'T: Sync file write on every parse error
fs.appendFileSync(file, JSON.stringify(entry));

// DO: Buffer and flush periodically
this.dlqBuffer.push(entry);
if (this.dlqBuffer.length >= 50) {
  fs.appendFile(file, this.dlqBuffer.map(JSON.stringify).join('\n'));
  this.dlqBuffer = [];
}
```

### Cache Metrics Threshold

The enrichment pipeline expects 80%+ cache hit rate. Monitor via:

```javascript
// In enrichment-pipeline.js
this.geoLocator.startMetricsLogging(30000);  // Log every 30s
```

If hit rate drops, increase cache size in the **lru-cache** skill configuration.