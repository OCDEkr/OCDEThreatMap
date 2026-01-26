# OCDE Cyber Threat Map - Syslog Receiver

## Overview
Real-time visual threat map for OCDE network. This repository contains the syslog ingestion and parsing system for Palo Alto firewall DENY logs.

## Requirements
- Node.js 22.x LTS or higher
- Root privileges for port 514 binding (or use setcap)
- Palo Alto firewall configured for RFC 5424 syslog format

## Installation
```bash
npm install
```

## Configuration

### Palo Alto Firewall Setup
Configure firewall to send syslog to this server:
1. Navigate to Device > Server Profiles > Syslog
2. Add server with receiver IP address, port 514, UDP transport
3. Set format to IETF (RFC 5424) — NOT BSD
4. In Log Settings, configure THREAT logs to forward to syslog server
5. Verify "Send Hostname in Syslog" setting matches expected format (recommend: disabled for consistent parsing)

**Critical:** Use RFC 5424 format to ensure consistent parsing across firmware versions (see .planning/phases/01-foundation-and-architecture/01-RESEARCH.md Pitfall 2).

### Port 514 Privileges
Port 514 requires root privileges on Linux. Options:

**Option 1 - Run with sudo using full path:**
```bash
sudo $(which node) src/app.js
```

**Option 2 - Grant Node.js capability (recommended for production):**
```bash
sudo setcap cap_net_bind_service=+ep $(which node)
node src/app.js
```

**Option 3 - Use alternative port (requires firewall reconfiguration):**
```bash
SYSLOG_PORT=10514 node src/app.js
```
Then reconfigure Palo Alto firewall to send syslog to port 10514.

## Running

**Start receiver:**
```bash
sudo $(which node) src/app.js
```

**Development mode with alternative port (no sudo needed):**
```bash
SYSLOG_PORT=5514 node src/app.js
```

## Testing

**Automated test suite:**
```bash
node test/test-parser.js
```

**Manual test (send sample log):**
```bash
# Using alternative port (no sudo needed)
SYSLOG_PORT=5514 node src/app.js &
echo '<14>1 2024-01-26T10:00:00Z PA-VM - - - [pan@0 src=192.168.1.100 dst=10.0.0.50 action=deny threat_type=malware] Test' | nc -u localhost 5514
```

## Monitoring

**Console output:**
- PARSED events: Successfully parsed DENY logs with extracted fields (JSON format)
- METRICS: Every 10 seconds shows received count, parsed count, failed count, success rate %
- Parse errors: Logged but don't crash application (graceful degradation)

**Success rate requirement:** Parse success rate should exceed 95% with real firewall logs.
Current test fixture rate: ~80% (includes malformed samples and edge cases for testing).

**Dead letter queue:** Failed messages logged to `logs/failed-messages.jsonl`

## Troubleshooting

**"sudo: node: command not found":**
- Use full path: `sudo $(which node) src/app.js`
- Or use alternative port: `SYSLOG_PORT=5514 node src/app.js` (no sudo needed)

**Parse success rate below 95%:**
- Verify firewall using RFC 5424 format (not BSD)
- Check "Send Hostname in Syslog" setting on firewall
- Review logs/failed-messages.jsonl for patterns in failures
- Request actual firewall log samples to test against

**No messages received:**
- Verify firewall syslog server configuration points to this server's IP
- Check network connectivity: `nc -u -l 514` and send test from firewall
- Verify firewall THREAT log forwarding enabled

## Architecture

**Event-driven flow:**
1. UDP receiver (src/receivers/udp-receiver.js) listens on port 514
2. Raw messages emitted to event bus as 'message' events
3. Parser (src/parsers/palo-alto-parser.js) consumes 'message' events
4. Parsed events emitted as 'parsed' events with extracted fields
5. Failed parses emitted as 'parse-error' events and logged to DLQ

**Key components:**
- src/receivers/udp-receiver.js: UDP socket server with 32MB receive buffer
- src/parsers/palo-alto-parser.js: RFC 5424 parser with Palo Alto field extraction
- src/events/event-bus.js: Central EventEmitter for message flow
- src/utils/error-handler.js: Dead letter queue for failed messages
- src/app.js: Application entry point, wiring, metrics

## Phase 1 Status
✓ UDP syslog receiver operational
✓ RFC 5424 parser with field extraction
✓ Event-driven architecture (sub-5 second latency)
✓ Graceful error handling and dead letter queue
✓ Parse success rate measurement
✓ Automated test suite (80% success rate on fixtures)

**Next phase:** IP geolocation enrichment (Phase 2)

## Research and Planning
See `.planning/` directory for:
- 01-RESEARCH.md: Technical research, pitfalls, code examples
- 01-XX-PLAN.md: Execution plans for each implementation step
- 01-XX-SUMMARY.md: Completion summaries with decisions and learnings