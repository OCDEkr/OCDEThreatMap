# OCDE Cyber Threat Map

Real-time visual threat map for the Orange County Department of Education (OCDE). The system ingests Palo Alto firewall DENY logs via UDP syslog, performs IP geolocation lookups using MaxMind GeoLite2, and renders animated arcs from attack origin countries to OCDE's location on an interactive 3D globe. Designed for security operations awareness and NOC display visibility.

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Runtime | Node.js | 22.x | Server-side JavaScript with native ES module support |
| Framework | Express | 5.x | HTTP server for dashboard and API routes |
| WebSocket | ws | 8.x | Real-time bidirectional communication for live attack updates |
| Geolocation | MaxMind | 5.x | IP-to-location mapping via GeoLite2-City database |
| Syslog Parser | nsyslog-parser-2 | 0.9.x | RFC 5424 syslog message parsing |
| Visualization | Globe.GL | 2.27.x | 3D WebGL globe rendering with Three.js |
| 3D Engine | Three.js | 0.160.x | WebGL rendering foundation for globe visualization |
| Mapping | D3.js | 7.8.x | Alternative flat map view with geo projections |
| Caching | lru-cache | 11.x | In-memory LRU cache for geolocation lookups |
| Session | express-session | 1.x | Server-side session management for authentication |

## Quick Start

```bash
# Prerequisites
- Node.js 22.x LTS or higher
- MaxMind GeoLite2-City database (place in data/GeoLite2-City.mmdb)
- Root privileges for port 514 binding (or use alternative port)

# Installation
git clone [repository]
cd ocdeThreatMap
npm install

# Configuration
cp .env.example .env
# Edit .env with your credentials

# Development (no sudo needed)
SYSLOG_PORT=5514 node src/app.js

# Production (port 514 requires root)
sudo $(which node) src/app.js

# Alternative: Grant Node.js capability (one-time setup)
sudo setcap cap_net_bind_service=+ep $(which node)
node src/app.js

# Testing
node test/test-parser.js
```

## Project Structure

```
ocdeThreatMap/
├── src/
│   ├── app.js                    # Application entry point and wiring
│   ├── receivers/
│   │   └── udp-receiver.js       # UDP syslog listener (port 514)
│   ├── parsers/
│   │   └── palo-alto-parser.js   # RFC 5424 parser with PA field extraction
│   ├── enrichment/
│   │   ├── geolocation.js        # MaxMind GeoLite2 IP lookup
│   │   ├── cache.js              # LRU cache wrapper for geo lookups
│   │   └── enrichment-pipeline.js # Coordinates parsing and geo enrichment
│   ├── websocket/
│   │   ├── ws-server.js          # WebSocket server with auth
│   │   ├── broadcaster.js        # Event broadcast to connected clients
│   │   ├── attack-broadcaster.js # Attack-specific broadcast formatting
│   │   ├── auth-handler.js       # WebSocket upgrade authentication
│   │   └── heartbeat.js          # Connection keepalive mechanism
│   ├── middleware/
│   │   ├── session.js            # Express session configuration
│   │   └── auth-check.js         # Route authentication middleware
│   ├── routes/
│   │   ├── login.js              # POST /login authentication
│   │   └── logout.js             # POST /logout session destruction
│   ├── events/
│   │   └── event-bus.js          # Central EventEmitter singleton
│   └── utils/
│       ├── error-handler.js      # Dead letter queue for failed messages
│       └── ip-matcher.js         # OCDE IP range matching utilities
├── public/
│   ├── index.html                # Login page
│   ├── dashboard.html            # Main visualization dashboard
│   ├── css/
│   │   └── dashboard.css         # NOC-optimized dark theme styles
│   ├── js/
│   │   ├── globe.js              # Globe.GL initialization and controls
│   │   ├── arcs.js               # Arc animation and lifecycle management
│   │   ├── custom-arcs.js        # Threat-type color coding for arcs
│   │   ├── flat-map.js           # 2D flat map alternative view
│   │   ├── flat-map-d3.js        # D3.js flat map implementation
│   │   ├── coordinates.js        # Geo coordinate utilities
│   │   ├── ws-client.js          # WebSocket client with reconnection
│   │   ├── dashboard-client.js   # Dashboard event handling
│   │   ├── stats-display.js      # Attack statistics rendering
│   │   ├── stats-metrics.js      # Metrics calculation
│   │   ├── top-stats.js          # Top countries/attack types panels
│   │   ├── performance-monitor.js # FPS and performance tracking
│   │   └── world-map-data.js     # GeoJSON world map data
│   └── images/
│       └── OCDE-SUP-blue.png     # OCDE logo
├── data/
│   └── GeoLite2-City.mmdb        # MaxMind geolocation database
├── test/
│   ├── test-parser.js            # Parser test suite
│   └── fixtures/
│       └── palo-alto-samples.txt # Test syslog samples
├── logs/                         # Dead letter queue output
├── .planning/                    # Project planning docs (GSD workflow)
├── package.json
└── .env.example
```

## Architecture Overview

The system follows an **event-driven pipeline architecture** optimized for sub-5 second end-to-end latency:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Palo Alto    │ ──▶ │ UDP Receiver │ ──▶ │   Parser     │ ──▶ │  Enrichment  │
│ Firewall     │     │ (Port 514)   │     │ (RFC 5424)   │     │  (MaxMind)   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                      │
                                                                      ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  3D Globe    │ ◀── │  Dashboard   │ ◀── │  WebSocket   │ ◀── │  Event Bus   │
│  (Globe.GL)  │     │  (Browser)   │     │  Broadcast   │     │  (enriched)  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

**Data Flow:**
1. UDP Receiver listens on port 514 for syslog messages
2. Palo Alto Parser extracts fields from RFC 5424 format, filters for DENY actions
3. Enrichment Pipeline adds geolocation data via cached MaxMind lookups
4. Event Bus emits `enriched` events to WebSocket broadcaster
5. Connected dashboards receive attacks and render animated arcs

**Key Design Decisions:**
- **In-memory only**: No database - focus on real-time visualization, not historical analysis
- **Event-driven**: Loose coupling via central EventEmitter allows independent component development
- **Graceful degradation**: Parse failures logged to dead letter queue, never crash the pipeline

### Key Modules

| Module | Location | Purpose |
|--------|----------|---------|
| Event Bus | `src/events/event-bus.js` | Central EventEmitter singleton for decoupled message flow |
| UDP Receiver | `src/receivers/udp-receiver.js` | High-volume UDP socket with 32MB buffer |
| Palo Alto Parser | `src/parsers/palo-alto-parser.js` | Extracts src/dst IP, threat type, action from syslog |
| Enrichment Pipeline | `src/enrichment/enrichment-pipeline.js` | Coordinates geo lookup and OCDE target detection |
| GeoLocator | `src/enrichment/geolocation.js` | MaxMind database wrapper for IP lookups |
| Cache | `src/enrichment/cache.js` | LRU cache with 1-hour TTL, 80%+ hit rate target |
| WebSocket Server | `src/websocket/ws-server.js` | Session-authenticated WebSocket connections |
| Attack Broadcaster | `src/websocket/attack-broadcaster.js` | Formats and sends enriched events to all clients |
| Globe Visualization | `public/js/globe.js` | 3D globe with country borders and arc rendering |
| Arc Manager | `public/js/arcs.js` | Attack arc lifecycle, animation, and cleanup |

## Development Guidelines

### Code Style

**File Naming:**
- Server-side files: **kebab-case** (`udp-receiver.js`, `attack-broadcaster.js`, `event-bus.js`)
- Test files: `test-*.js` pattern (`test-parser.js`)

**Code Naming:**
- Classes: **PascalCase** (`SyslogReceiver`, `EnrichmentPipeline`, `PaloAltoParser`)
- Functions: **camelCase** (`extractSourceIP`, `wireEventBroadcast`, `broadcastAttack`)
- Variables: **camelCase** (`eventBus`, `parsedCount`, `geoData`)
- Constants: **SCREAMING_SNAKE_CASE** (rare in codebase)
- Boolean variables: `is`, `has`, `should` prefix (`isAlive`, `hadError`, `isRotating`)

### Module Patterns

**Server-side (CommonJS):**
```javascript
const { EventEmitter } = require('events');
class MyClass extends EventEmitter { /* ... */ }
module.exports = { MyClass };
```

**Browser-side (IIFE exposing globals):**
```javascript
(function() {
  'use strict';
  window.myFunction = function() { /* ... */ };
})();
```

### Import Order

1. Node.js built-in modules (`events`, `dgram`, `path`, `http`)
2. External packages (`express`, `ws`, `maxmind`, `lru-cache`)
3. Local modules (`./events/event-bus`, `./parsers/palo-alto-parser`)

### Event Bus Events

| Event | Emitter | Payload |
|-------|---------|---------|
| `message` | UDP Receiver | `{ raw, remoteAddress, remotePort, timestamp }` |
| `parsed` | Palo Alto Parser | `{ timestamp, sourceIP, destinationIP, threatType, action, raw }` |
| `parse-error` | Palo Alto Parser | `{ error, rawMessage, timestamp }` |
| `enriched` | Enrichment Pipeline | `{ ...parsed, geo, isOCDETarget, enrichmentTime }` |

### Error Handling

- **Never crash on malformed input** - log errors, emit `parse-error`, continue processing
- **Dead letter queue** - failed messages logged to `logs/failed-messages.jsonl`
- **Socket errors** - logged but don't terminate the receiver
- **WebSocket send failures** - terminate broken client connection, continue broadcasting

## Available Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start application (requires sudo for port 514) |
| `npm run dev` | Start with --watch for auto-reload |
| `node test/test-parser.js` | Run parser test suite |
| `SYSLOG_PORT=5514 node src/app.js` | Development mode on unprivileged port |

### Manual Testing

```bash
# Start server on alternative port
SYSLOG_PORT=5514 node src/app.js &

# Send test syslog message
echo '<14>1 2024-01-26T10:00:00Z PA-VM - - - [pan@0 src=192.168.1.100 dst=10.0.0.50 action=deny threat_type=malware] Test' | nc -u localhost 5514
```

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `SESSION_SECRET` | Yes (prod) | Express session signing key | `ocde-threat-map-change-in-production` |
| `DASHBOARD_USERNAME` | No | Dashboard login username | `admin` |
| `DASHBOARD_PASSWORD` | Yes (prod) | Dashboard login password | `ChangeMe` |
| `SYSLOG_PORT` | No | UDP syslog port | `514` |
| `OCDE_IP_RANGES` | No | CIDR ranges for OCDE target detection | (empty) |

## Testing

- **Test location:** `test/test-parser.js`
- **Test fixtures:** `test/fixtures/palo-alto-samples.txt`
- **Test pattern:** Custom runner with assertion-style tests
- **Success threshold:** 60%+ parse rate on fixtures (includes malformed samples)

**Test coverage:**
- Field extraction from standard RFC 5424
- Structured data parsing
- Escape sequence handling (`#012` sequences)
- ALLOW log filtering (only DENY logs pass)
- Graceful degradation on malformed input

Run tests with: `node test/test-parser.js`

## Deployment

**Port 514 Privileges:**

Option 1 - Run with sudo:
```bash
sudo $(which node) src/app.js
```

Option 2 - Grant capability (recommended for production):
```bash
sudo setcap cap_net_bind_service=+ep $(which node)
node src/app.js
```

**Palo Alto Firewall Configuration:**
1. Navigate to Device > Server Profiles > Syslog
2. Add server with receiver IP, port 514, UDP transport
3. Set format to IETF (RFC 5424) — NOT BSD
4. In Log Settings, configure THREAT logs to forward to syslog server
5. Verify "Send Hostname in Syslog" setting matches expected format

**Dashboard Access:**
- URL: `http://localhost:3000/dashboard`
- Login with credentials from `.env` file
- WebSocket auto-reconnects on connection loss

## Additional Resources

- Project requirements: `.planning/PROJECT.md`
- Development roadmap: `.planning/ROADMAP.md`
- Phase documentation: `.planning/phases/`
- MaxMind GeoLite2: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
- Globe.GL documentation: https://globe.gl/
- D3.js geo projections: https://d3js.org/d3-geo

## Skill Usage Guide

When working on tasks involving these technologies, invoke the corresponding skill:

| Skill | Invoke When |
|-------|-------------|
| node | Node.js runtime, EventEmitter patterns, CommonJS modules |
| express | Routes, middleware, session handling |
| websocket | WebSocket server, client reconnection, heartbeat |
| maxmind | Geolocation lookups, database queries |
| threejs | 3D visualization, Globe.GL configuration |
| d3 | Flat map view, geographic projections |
| syslog | RFC 5424 parsing, Palo Alto log formats |


## Skill Usage Guide

When working on tasks involving these technologies, invoke the corresponding skill:

| Skill | Invoke When |
|-------|-------------|
| lru-cache | Configures in-memory LRU cache for geolocation lookup optimization |
| syslog-parser | Parses RFC 5424 syslog messages and Palo Alto firewall log formats |
| websocket | Implements WebSocket connections, authentication, and real-time communication |
| maxmind | Integrates MaxMind GeoLite2 database for IP geolocation lookups |
| three-js | Manages Three.js 3D rendering engine and WebGL visualization |
| globe-gl | Renders 3D WebGL globes with animated arcs and country borders |
| node | Manages Node.js runtime, ES modules, and package management |
| express | Configures Express routes, middleware, and HTTP server functionality |
| express-session | Implements session management and authentication middleware |
| frontend-design | Applies NOC-optimized dark theme styling and dashboard layout design |
| d3 | Renders 2D flat map visualizations and data-driven graphics |
