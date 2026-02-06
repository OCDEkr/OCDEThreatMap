# OCDE Cyber Threat Map

Real-time visual threat map for the Orange County Department of Education (OCDE). The system ingests Palo Alto firewall DENY logs via UDP syslog, performs IP geolocation lookups using MaxMind GeoLite2, and renders animated arcs from attack origin countries to OCDE's location on an interactive 3D globe. Designed for security operations awareness and NOC display visibility.

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Runtime | Node.js | 18.x+ | Server-side JavaScript runtime (CommonJS modules) |
| Framework | Express | 5.x | HTTP server for dashboard, admin panel, and API routes |
| Security | Helmet | 8.x | HTTP security headers (CSP, HSTS, etc.) |
| Security | bcrypt | 6.x | Password hashing (12 salt rounds) |
| Auth | express-session | 1.x | Server-side session management with httpOnly cookies |
| Rate Limiting | express-rate-limit | 8.x | Brute-force protection on login and API routes |
| WebSocket | ws | 8.x | Real-time bidirectional communication for live attack updates |
| Geolocation | MaxMind | 5.x | IP-to-location mapping via GeoLite2-City database |
| Syslog Parser | nsyslog-parser-2 | 0.9.x | RFC 5424 syslog message parsing |
| Caching | lru-cache | 11.x | In-memory LRU cache for geolocation lookups (10K items, 1h TTL) |
| Visualization | Globe.GL | 2.x | 3D WebGL globe rendering with Three.js |
| 3D Engine | Three.js | 0.160.x | WebGL rendering foundation for globe visualization |
| Mapping | D3.js | 7.x | Alternative 2D flat map view (CDN-loaded, not in package.json) |
| File Upload | Multer | 2.x | Logo upload handling (5MB limit, image MIME types) |
| Config | dotenv | 17.x | Environment variable loading from .env files |
| IP Matching | ip-range-check | 0.2.x | CIDR range matching for OCDE target detection |

## Quick Start

```bash
# Prerequisites
# - Node.js 18.x or higher
# - MaxMind GeoLite2-City database (place in data/GeoLite2-City.mmdb)
# - Root privileges for port 514 binding (or use alternative port)

# Installation
git clone https://github.com/OCDEkr/OCDEThreatMap.git
cd ocdeThreatMap
npm install

# Configuration
cp .env.example .env
# Edit .env with your credentials
# Generate a session secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Development (no sudo needed)
SYSLOG_PORT=5514 node src/app.js

# Production (port 514 requires root)
sudo $(which node) src/app.js

# Testing
node test/test-parser.js
```

## Project Structure

```
ocdeThreatMap/
├── src/
│   ├── app.js                    # Application entry point and pipeline wiring
│   ├── receivers/
│   │   └── udp-receiver.js       # UDP syslog listener (32MB buffer)
│   ├── parsers/
│   │   └── palo-alto-parser.js   # RFC 5424 parser with PA field extraction
│   ├── enrichment/
│   │   ├── geolocation.js        # MaxMind GeoLite2 IP lookup wrapper
│   │   ├── cache.js              # LRU cache wrapper (10K items, 1h TTL)
│   │   └── enrichment-pipeline.js # Coordinates parsing → geo enrichment
│   ├── websocket/
│   │   ├── ws-server.js          # WebSocket server with session auth
│   │   ├── broadcaster.js        # Event broadcast to connected clients
│   │   ├── attack-broadcaster.js # Batched attack broadcasting (100ms/50 events)
│   │   ├── auth-handler.js       # WebSocket upgrade authentication
│   │   └── heartbeat.js          # 30s ping/pong keepalive
│   ├── middleware/
│   │   ├── session.js            # Express session config (cookie: ocde.sid)
│   │   ├── auth-check.js         # Route authentication guard
│   │   └── rate-limiter.js       # Login, API, and password rate limiters
│   ├── routes/
│   │   ├── login.js              # POST /login - credential verification
│   │   ├── logout.js             # POST /logout - session destruction
│   │   ├── change-password.js    # POST /api/change-password - bcrypt hashing
│   │   ├── settings.js           # GET/PUT /api/settings - dashboard config
│   │   └── logo.js               # GET/POST/DELETE /api/logo - logo management
│   ├── events/
│   │   └── event-bus.js          # Central EventEmitter singleton (maxListeners=20)
│   └── utils/
│       ├── error-handler.js      # Dead letter queue (logs/failed-messages.jsonl)
│       ├── ip-matcher.js         # OCDE IP range CIDR matching
│       └── security.js           # bcrypt, constant-time comparison, security logging
├── public/
│   ├── index.html                # Root page (redirects to /dashboard)
│   ├── login.html                # Admin login page
│   ├── dashboard.html            # Main visualization dashboard (public, no auth)
│   ├── admin.html                # Admin panel (password, settings, logo)
│   ├── globe.html                # Standalone globe view
│   ├── css/
│   │   └── dashboard.css         # NOC-optimized dark theme (black bg, cyan/green)
│   ├── js/
│   │   ├── globe.js              # Globe.GL init (POV: 33.7490, -117.8705, alt 2.5)
│   │   ├── arcs.js               # Arc wrapper (max 500, 1500ms lifetime)
│   │   ├── custom-arcs.js        # Three.js BufferGeometry arcs (max 150, 2000ms, country colors)
│   │   ├── flat-map.js           # 2D Canvas flat map alternative
│   │   ├── flat-map-d3.js        # D3.js flat map with geo projections and country colors
│   │   ├── coordinates.js        # Country center-point coordinate lookup
│   │   ├── ws-client.js          # WebSocket client with reconnection
│   │   ├── dashboard-client.js   # Dashboard event handler and OCDE filter
│   │   ├── stats-display.js      # Attack statistics panel (total, APM)
│   │   ├── stats-metrics.js      # Metrics calculation engine
│   │   ├── top-stats.js          # Top 5 countries/threat types panels
│   │   ├── performance-monitor.js # FPS tracking via stats.js
│   │   └── world-map-data.js     # GeoJSON country coordinate data
│   ├── images/
│   │   └── OCDE-SUP-blue.png     # Default OCDE logo
│   └── uploads/                  # Custom logo uploads (gitignored)
├── scripts/
│   └── build.js                  # Standalone executable builder (pkg)
├── data/
│   ├── GeoLite2-City.mmdb        # MaxMind database (download separately)
│   └── password.hash             # bcrypt password hash (auto-created, gitignored)
├── test/
│   ├── test-parser.js            # Parser test suite (custom runner)
│   ├── send-random-attacks.js    # Random attack generator for testing
│   └── fixtures/
│       └── palo-alto-samples.txt # Sample syslog messages
├── logs/                         # Dead letter queue output (gitignored)
├── dist/                         # Build output - standalone executables (gitignored)
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
1. UDP Receiver listens for syslog messages on configurable port (default 514)
2. Palo Alto Parser extracts fields from RFC 5424 format, filters for DENY actions only
3. Enrichment Pipeline adds geolocation via cached MaxMind lookups, detects OCDE targets
4. Event Bus emits `enriched` events to WebSocket broadcaster
5. Attack Broadcaster batches events (100ms intervals, up to 50 per batch)
6. Connected dashboards render animated arcs on 3D globe or 2D flat map

**Key Design Decisions:**
- **In-memory only**: No database — focus on real-time visualization, not historical analysis
- **Event-driven**: Loose coupling via central EventEmitter allows independent component development
- **Graceful degradation**: Parse failures logged to dead letter queue, never crash the pipeline
- **Public dashboard**: Dashboard viewable without login (NOC display use case); admin functions require authentication
- **Localhost by default**: Both HTTP and syslog bind to `127.0.0.1` unless overridden by env vars or admin settings
- **Country-based arc colors**: `COUNTRY_COLORS` maps in both `custom-arcs.js` (hex int) and `flat-map-d3.js` (hex string) — keep in sync when modifying

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
| Attack Broadcaster | `src/websocket/attack-broadcaster.js` | Batched event formatting and broadcast |
| Globe Visualization | `public/js/globe.js` | 3D globe with country borders and arc rendering |
| Custom Arc System | `public/js/custom-arcs.js` | Three.js BufferGeometry arcs with adaptive sampling |
| Arc Manager | `public/js/arcs.js` | Arc lifecycle wrapper for Globe.GL native arcs |
| Flat Map | `public/js/flat-map-d3.js` | D3.js 2D flat map alternative with country colors |

### HTTP Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | Redirects to `/dashboard` |
| GET | `/dashboard` | No | Main visualization page (public) |
| GET | `/login` | No | Admin login page (redirects to /admin if already authenticated) |
| GET | `/admin` | Yes | Admin panel (settings, password, logo) |
| POST | `/login` | No | Credential verification (rate limited: 5/15min) |
| POST | `/logout` | No | Session destruction |
| GET | `/api/auth/status` | No | Check authentication state |
| GET | `/api/settings` | No | Read dashboard settings (heading, network config) |
| PUT | `/api/settings` | Yes | Update dashboard settings |
| POST | `/api/change-password` | Yes | Change admin password (rate limited: 3/hr) |
| GET | `/api/logo` | No | Get current logo |
| POST | `/api/logo` | Yes | Upload custom logo (5MB max, images only) |
| DELETE | `/api/logo` | Yes | Remove custom logo, revert to default |

## Development Guidelines

### Code Style

**File Naming:**
- Server-side files: **kebab-case** (`udp-receiver.js`, `attack-broadcaster.js`, `event-bus.js`)
- Client-side files: **kebab-case** (`dashboard-client.js`, `flat-map-d3.js`, `ws-client.js`)
- Test files: **kebab-case** (`test-parser.js`, `send-random-attacks.js`)

**Code Naming:**
- Classes: **PascalCase** (`SyslogReceiver`, `EnrichmentPipeline`, `PaloAltoParser`)
- Functions: **camelCase** (`extractSourceIP`, `wireEventBroadcast`, `broadcastAttack`)
- Variables: **camelCase** (`eventBus`, `parsedCount`, `geoData`)
- Constants: **SCREAMING_SNAKE_CASE** (`MAX_ARCS`, `ARC_LIFETIME`, `BATCH_INTERVAL_MS`)
- Boolean variables: `is`/`has`/`should` prefix (`isAlive`, `hadError`, `isRotating`)

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

- **Never crash on malformed input** — log errors, emit `parse-error`, continue processing
- **Dead letter queue** — failed messages logged to `logs/failed-messages.jsonl`
- **Socket errors** — logged but don't terminate the receiver
- **WebSocket send failures** — terminate broken client connection, continue broadcasting
- **Uncaught exceptions** — logged with stack trace, process continues

## Available Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start application (default port 514 requires sudo) |
| `npm run dev` | Start with `--watch` for auto-reload on changes |
| `npm run build` | Build standalone executables for all platforms |
| `npm run build:linux` | Build Linux x64 executable |
| `npm run build:macos` | Build macOS x64 executable |
| `npm run build:windows` | Build Windows x64 executable |
| `node test/test-parser.js` | Run parser test suite |
| `node test/send-random-attacks.js` | Generate random attack traffic for testing |
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
| `SESSION_SECRET` | Yes (prod) | Express session signing key (32+ hex chars) | fallback value |
| `DASHBOARD_USERNAME` | No | Admin login username | `admin` |
| `DASHBOARD_PASSWORD` | No | Admin login password | `ChangeMe` |
| `SYSLOG_PORT` | No | UDP syslog listen port | `514` |
| `SYSLOG_BIND_ADDRESS` | No | UDP syslog bind address | `127.0.0.1` |
| `HTTP_PORT` | No | HTTP server listen port | `3000` |
| `HTTP_BIND_ADDRESS` | No | HTTP server bind address | `127.0.0.1` |
| `NODE_ENV` | No | Set to `production` for secure cookies over HTTPS | `development` |
| `OCDE_IP_RANGES` | No | Comma-separated CIDR ranges for target detection | (empty) |

## Testing

- **Test location:** `test/test-parser.js`
- **Test fixtures:** `test/fixtures/palo-alto-samples.txt`
- **Test pattern:** Custom runner with assertion-style tests (no framework)
- **Success threshold:** 60%+ parse rate on fixtures (includes malformed samples)
- **Attack simulator:** `test/send-random-attacks.js` generates random UDP attack traffic

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

**Standalone Executables:**
```bash
npm run build          # All platforms (Linux, macOS, Windows)
# Output: dist/{linux,macos,windows}/ with executable + public/ + start script
```

**Palo Alto Firewall Configuration:**
1. Navigate to Device > Server Profiles > Syslog
2. Add server with receiver IP, port 514, UDP transport
3. Set format to IETF (RFC 5424) — NOT BSD
4. In Log Settings, configure THREAT logs to forward to syslog server
5. Verify "Send Hostname in Syslog" setting matches expected format

**Network Binding:**
- Both HTTP and syslog default to `127.0.0.1` (localhost only)
- Set `HTTP_BIND_ADDRESS=0.0.0.0` and `SYSLOG_BIND_ADDRESS=0.0.0.0` to accept remote connections
- These can also be changed at runtime via the admin panel settings API

**Dashboard Access:**
- Public dashboard: `http://localhost:3000/dashboard` (no login required)
- Admin panel: `http://localhost:3000/admin` (login required)
- Login page: `http://localhost:3000/login`
- WebSocket auto-reconnects on connection loss

## Security Features

- **bcrypt** password hashing (12 rounds) with file persistence to `data/password.hash`
- **Helmet.js** security headers including Content Security Policy
- **Rate limiting**: login (5/15min), API (100/min), password change (3/hr)
- **httpOnly, sameSite=lax** session cookies (cookie name: `ocde.sid`, 24h expiry)
- **Constant-time** password comparison via `crypto.timingSafeEqual`
- **Security event logging** with color-coded console output
- **Multer** file upload validation (image MIME types only, 5MB limit)
- **Graceful shutdown** on SIGINT/SIGTERM with final metrics reporting

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
| express | Routes, middleware, session handling, Helmet CSP |
| express-session | Session configuration, cookie settings, auth middleware |
| websocket | WebSocket server, client reconnection, heartbeat, broadcast |
| maxmind | Geolocation lookups, database initialization |
| syslog-parser | RFC 5424 parsing, Palo Alto log field extraction |
| lru-cache | Geolocation cache configuration, hit rate optimization |
| globe-gl | 3D globe rendering, arc animations, country borders |
| three-js | WebGL rendering, BufferGeometry, scene management |
| d3 | Flat map projections, SVG/Canvas geographic rendering |
| frontend-design | NOC dark theme, dashboard layout, high-contrast styling |


## Skill Usage Guide

When working on tasks involving these technologies, invoke the corresponding skill:

| Skill | Invoke When |
|-------|-------------|
| websocket | Handles WebSocket server, client reconnection, heartbeat, and event broadcasting |
| express | Configures Express routes, middleware, session handling, and Helmet CSP |
| node | Manages Node.js runtime, CommonJS modules, and EventEmitter patterns |
| syslog-parser | Parses RFC 5424 syslog messages and extracts Palo Alto firewall fields |
| lru-cache | Manages in-memory LRU cache for geolocation lookups with TTL expiration |
| express-session | Manages session configuration, httpOnly cookies, and authentication middleware |
| maxmind | Performs IP geolocation lookups using MaxMind GeoLite2-City database |
| frontend-design | Applies NOC dark theme styling with pure black background, cyan/green/red colors, and Courier New monospace typography |
| three-js | Manages Three.js WebGL rendering, BufferGeometry, and scene management |
| d3 | Implements D3.js geo projections and 2D flat map SVG rendering |
| globe-gl | Renders 3D WebGL globe with country borders and animated arc visualization |
