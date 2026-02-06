# Syslog Parser Workflows

## Contents
- Adding New Log Formats
- Testing Parser Changes
- Debugging Parse Failures
- Pipeline Integration Wiring
- Generating Test Traffic

## Adding New Log Formats

Copy this checklist and track progress:
- [ ] Step 1: Collect 5+ sample logs in `test/fixtures/palo-alto-samples.txt`
- [ ] Step 2: Identify field positions (CSV) or key names (structured data)
- [ ] Step 3: Add extraction logic to `src/parsers/palo-alto-parser.js`
- [ ] Step 4: Add test cases in `test/test-parser.js`
- [ ] Step 5: Run tests and verify 60%+ parse success rate
- [ ] Step 6: Test graceful degradation on malformed input

### Step-by-Step

1. Add sample messages to `test/fixtures/palo-alto-samples.txt`:
```
<14>1 2024-01-26T10:00:00Z PA-NEW src=10.0.0.1 dst=192.168.1.1 action=deny threat_type=newtype
```

2. Run tests to see current behavior:
```bash
node test/test-parser.js
```

3. If extraction fails, add logic to the appropriate method in `PaloAltoParser`:
```javascript
// Add new format detection in extractSourceIP(), extractDestinationIP(), etc.
const newMatch = parsed.message.match(/new_src_field=([0-9.]+)/i);
if (newMatch?.[1] && this.validateIPv4(newMatch[1])) return newMatch[1];
```

4. Iterate until tests pass:
```bash
node test/test-parser.js
# If validation fails, fix extraction logic and repeat
# Only proceed when success rate >= 60%
```

### WARNING: Adding Formats Without Test Fixtures

**The Problem:** Writing extraction logic without corresponding test samples means regressions go undetected. The test suite validates against `test/fixtures/palo-alto-samples.txt` -- formats not represented there are untested.

**The Fix:** ALWAYS add at least 2 samples per new format: one well-formed, one malformed.

---

## Testing Parser Changes

### Run the Test Suite

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
PASS: Standard RFC 5424 field extraction
PASS: Structured data field extraction

TEST: Escape Sequence Handling
----------------------------------------
PASS: Escape sequence handling

TEST: Action Filtering
----------------------------------------
PASS: ALLOW logs filtered

TEST: Parse Success Rate
----------------------------------------
Parse success rate: 70.0% (parsed 7/10 samples)
SUCCESS: Parse success rate meets expected threshold (60-80%)
```

### Test Categories

| Test | Purpose | Pass Criteria |
|------|---------|---------------|
| Field Extraction | Verify IP/action/threat parsing from RFC 5424 and structured data | Exact field match against known values |
| Escape Sequences | Handle `#012` octal newlines, `\n` in messages | No crash, graceful handling |
| Action Filtering | Skip ALLOW/permitted logs | No `parsed` event emitted |
| Graceful Degradation | Handle malformed/incomplete input | No crash, `parse-error` event emitted |
| Success Rate | Overall parse quality across all fixtures | >= 60% of samples parsed |

### Test Architecture

The test suite uses a custom runner (no framework). Tests wire into the event bus to verify event emission:

```javascript
const EventEmitter = require('events');
global.eventBus = new EventEmitter();
const parser = new PaloAltoParser();

// Verify parsed event emission
let parsedEvent = null;
eventBus.once('parsed', (data) => { parsedEvent = data; });
parser.parse(sampleMessage);
// Assert parsedEvent has expected fields
```

---

## Debugging Parse Failures

### Check the Dead Letter Queue

```bash
# View recent failures (JSONL format)
tail -20 logs/failed-messages.jsonl

# Count failures by error type
cat logs/failed-messages.jsonl | jq -r '.error' | sort | uniq -c | sort -rn
```

### Send a Single Test Message

```bash
# Start server on dev port
SYSLOG_PORT=5514 node src/app.js &

# Send structured data format
echo '<14>1 2024-01-26T10:00:00Z PA-VM - - - [pan@0 src=192.168.1.100 dst=10.0.0.50 action=deny threat_type=malware] Test' | nc -u localhost 5514

# Watch console for PARSED and ENRICHED output
```

### Add Temporary Debug Logging

```javascript
// In PaloAltoParser.parse()
parse(rawMessage) {
  console.log('RAW INPUT:', rawMessage.substring(0, 200));
  const parsed = parser(cleanedMessage, options);
  console.log('NSYSLOG OUTPUT:', JSON.stringify(parsed, null, 2));
  console.log('STRUCTURED DATA:', parsed.structuredData);
  // ... continue normal flow
}
```

### Common Failure Patterns

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `null` sourceIP on CSV logs | Wrong field index for PA version | Compare against Palo Alto log format docs |
| Empty structuredData | `nsyslog-parser-2` skips bracket blocks | Manual regex extraction (see SKILL.md) |
| All messages return `null` | Action field not found, everything filtered | Check `extractAction()` regex and CSV index |
| Parser crash on specific input | Unhandled exception in extraction | Wrap in try/catch in `parse()` method |
| `#012` in raw message | Octal newline escape from syslog relay | Pre-process with `.replace(/#012/g, ' ')` |
| IPv6 addresses return `null` | `validateIPv4()` rejects non-IPv4 | Expected -- IPv6 support not implemented |

---

## Pipeline Integration Wiring

### Data Flow

```
SyslogReceiver -> EventBus('message') -> PaloAltoParser -> EventBus('parsed') -> EnrichmentPipeline -> EventBus('enriched') -> WebSocket Broadcast
```

### Wiring in src/app.js

```javascript
const eventBus = require('./events/event-bus');
const { PaloAltoParser } = require('./parsers/palo-alto-parser');
const { SyslogReceiver } = require('./receivers/udp-receiver');
const { DeadLetterQueue } = require('./utils/error-handler');

const parser = new PaloAltoParser();
const receiver = new SyslogReceiver({ port: 5514 });
const dlq = new DeadLetterQueue();

// Wire: receiver -> event bus
receiver.on('message', (data) => eventBus.emit('message', data));

// Wire: event bus -> parser
eventBus.on('message', (data) => parser.parse(data.raw));

// Wire: parse errors -> dead letter queue
eventBus.on('parse-error', (error) => {
  dlq.add(error.rawMessage, new Error(error.error));
});
```

The parser internally emits `parsed` events to `eventBus`. The enrichment pipeline (see the **maxmind** skill) listens for `parsed` events and emits `enriched` events. The WebSocket broadcaster (see the **websocket** skill) forwards `enriched` events to connected dashboard clients.

### Metrics Reporting

```javascript
let totalReceived = 0, totalParsed = 0, totalFailed = 0;

eventBus.on('message', () => totalReceived++);
eventBus.on('parsed', () => totalParsed++);
eventBus.on('parse-error', () => totalFailed++);

setInterval(() => {
  const rate = totalReceived > 0 ? (totalParsed / totalReceived * 100).toFixed(2) : 0;
  console.log(`METRICS: Received=${totalReceived}, Parsed=${totalParsed}, Failed=${totalFailed}, Rate=${rate}%`);
}, 10000);
```

---

## Generating Test Traffic

Use the attack simulator for live testing against a running server:

```bash
# Default: 5 events/sec for 5 minutes (1500 total)
SYSLOG_PORT=5514 node test/send-random-attacks.js

# Custom rate and duration
node test/send-random-attacks.js --rate 10 --duration 60 --port 5514

# High-volume stress test
node test/send-random-attacks.js --rate 100 --duration 30
```

The simulator generates RFC 5424 structured data format messages:
```
<14>1 2024-01-26T10:00:00Z PA-5220 - - - [pan@0 src=5.45.192.100 dst=192.168.1.10 action=deny threat_type=malware sport=54321 dport=443 proto=tcp] Attack blocked
```

All generated messages use `action=deny` so they pass the action filter. Source IPs span 25+ countries for realistic geographic distribution on the globe visualization. See the **lru-cache** skill for monitoring cache hit rates during sustained traffic.
