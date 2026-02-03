# OCDE Cyber Threat Map

A real-time 3D visualization system that displays firewall threat data on an interactive globe. Designed for Network Operations Center (NOC) wall displays, the system ingests Palo Alto firewall DENY logs via UDP syslog, performs IP geolocation, and renders animated arcs from attack origins to your network location.
<img width="3826" height="1891" alt="image" src="https://github.com/user-attachments/assets/4ab2b536-bb9c-43d0-812e-24779b385765" />
<img width="3815" height="1897" alt="image" src="https://github.com/user-attachments/assets/02716ab2-c81a-43b6-b9a0-de09003f2914" />
<img width="2133" height="1841" alt="image" src="https://github.com/user-attachments/assets/a0b54c28-b4dc-4577-af63-9745e0a561a6" />

## Features

- **Real-time Visualization** - Animated arcs show attacks as they happen on a 3D WebGL globe
- **IP Geolocation** - MaxMind GeoLite2 database maps source IPs to geographic coordinates
- **Threat Classification** - Color-coded arcs by threat type (malware, intrusion, DDoS, deny)
- **NOC-Optimized Display** - Dark theme with high-contrast colors, readable from 20+ feet
- **Live Statistics** - Top attacking countries, threat types, and attacks per minute
- **Secure Authentication** - Session-based login with bcrypt password hashing
- **Admin Panel** - Change passwords, customize headings, upload logo
- **Alternative Views** - Toggle between 3D globe and 2D flat map

## Prerequisites

- **Node.js 22.x** or higher
- **MaxMind GeoLite2-City database** (free, requires account)
- **Palo Alto firewall** configured to send syslog over UDP
- Root privileges for port 514 (or use alternative port)

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/OCDEkr/OCDEThreatMap.git
cd OCDEThreatMap
npm install
```

### 2. Download MaxMind Database

1. Create a free account at [MaxMind](https://www.maxmind.com/en/geolite2/signup)
2. Download **GeoLite2-City.mmdb**
3. Place it in the `data/` directory:
   ```bash
   mkdir -p data
   mv ~/Downloads/GeoLite2-City.mmdb data/
   ```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Required for production
SESSION_SECRET=your-64-character-random-string
DASHBOARD_PASSWORD=YourSecurePassword123!

# Optional
DASHBOARD_USERNAME=admin
SYSLOG_PORT=514
NODE_ENV=development
```

Generate a secure session secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Start the Server

**Development mode** (port 5514, no root required):
```bash
SYSLOG_PORT=5514 npm run dev
```

**Production mode** (port 514, requires root):
```bash
# Option 1: Run with sudo
sudo $(which node) src/app.js

# Option 2: Grant capability (recommended)
sudo setcap cap_net_bind_service=+ep $(which node)
npm start
```

### 5. Access the Dashboard

1. Open http://localhost:3000
2. Login with your configured credentials
3. The dashboard will display attacks in real-time

## Palo Alto Firewall Configuration

Configure your firewall to send threat logs to the server:

1. **Device > Server Profiles > Syslog**
   - Add server with your receiver's IP address
   - Port: 514 (or your configured port)
   - Transport: UDP
   - Format: **IETF (RFC 5424)** - NOT BSD

2. **Objects > Log Forwarding**
   - Create a profile that forwards THREAT logs to your syslog server

3. **Policies > Security**
   - Apply the log forwarding profile to your security rules

## Architecture

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

## Project Structure

```
OCDEThreatMap/
├── src/
│   ├── app.js                 # Application entry point
│   ├── receivers/             # UDP syslog listener
│   ├── parsers/               # RFC 5424 / Palo Alto parser
│   ├── enrichment/            # MaxMind geolocation + caching
│   ├── websocket/             # Real-time broadcast to clients
│   ├── middleware/            # Session, auth, rate limiting
│   ├── routes/                # Login, logout, admin APIs
│   └── utils/                 # Security utilities
├── public/
│   ├── dashboard.html         # Main visualization page
│   ├── admin.html             # Admin panel
│   ├── css/                   # NOC-optimized dark theme
│   └── js/                    # Globe.GL, D3, WebSocket client
├── data/
│   └── GeoLite2-City.mmdb     # MaxMind database (download separately)
└── test/                      # Parser tests
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SESSION_SECRET` | Yes (prod) | fallback | 32+ character secret for session signing |
| `DASHBOARD_USERNAME` | No | `admin` | Login username |
| `DASHBOARD_PASSWORD` | Yes (prod) | `change-me` | Login password |
| `SYSLOG_PORT` | No | `514` | UDP port for syslog receiver |
| `NODE_ENV` | No | `development` | Set to `production` for secure cookies |

## Security Features

- **bcrypt** password hashing (12 rounds)
- **Rate limiting** on login (5 attempts/15 min) and API routes
- **Helmet.js** security headers
- **httpOnly, sameSite strict** cookies
- **Constant-time** password comparison (timing attack prevention)
- **Security event logging** for auditing

## Testing

Send a test syslog message:

```bash
# Start server on alternative port
SYSLOG_PORT=5514 node src/app.js &

# Send test message
echo '<14>1 2024-01-26T10:00:00Z PA-VM - - - [meta src=203.0.113.50 dst=10.0.0.1 action=deny threat_type=malware]' | nc -u localhost 5514
```

Run parser tests:
```bash
node test/test-parser.js
```

## Building Standalone Executables

Create self-contained binaries that run without Node.js installed.

### Build All Platforms

```bash
npm run build
```

This creates executables for Linux, macOS, and Windows in the `dist/` directory.

### Build Single Platform

```bash
npm run build:linux    # Linux x64
npm run build:macos    # macOS x64
npm run build:windows  # Windows x64
```

### Distribution Structure

After building, each platform folder contains:

```
dist/
├── linux/
│   ├── ocde-threat-map-linux    # Executable
│   ├── public/                   # Web assets (required)
│   ├── data/                     # Place GeoLite2-City.mmdb here
│   ├── .env.example              # Configuration template
│   ├── start.sh                  # Launch script
│   └── QUICKSTART.md             # Quick reference
├── macos/
│   └── ...
└── windows/
    ├── ocde-threat-map-win.exe
    ├── start.bat
    └── ...
```

### Deploying a Build

1. Copy the entire platform folder to target machine
2. Download MaxMind GeoLite2-City.mmdb into the `data/` folder
3. Copy `.env.example` to `.env` and configure
4. Run the executable or use the start script

**Linux/macOS:**
```bash
chmod +x ocde-threat-map-linux start.sh
./start.sh
# Or directly: ./ocde-threat-map-linux
```

**Windows:**
```cmd
start.bat
REM Or directly: ocde-threat-map-win.exe
```

### Build Requirements

- Node.js 22.x (for building only - not needed to run)
- npm packages installed (`npm install`)
- ~500MB disk space for all platforms

## Admin Panel

Access the admin panel at `/admin` (requires authentication):

- **Change Password** - Update admin password with complexity requirements
- **Customize Heading** - Change the dashboard title
- **Upload Logo** - Replace the default logo with your organization's branding

## Troubleshooting

**Port 514 permission denied:**
```bash
# Grant Node.js capability to bind privileged ports
sudo setcap cap_net_bind_service=+ep $(which node)
```

**No attacks appearing:**
- Verify firewall is sending to correct IP/port
- Check syslog format is RFC 5424 (IETF), not BSD
- Ensure DENY/threat logs are being forwarded
- Check browser console for WebSocket connection errors

**WebSocket authentication failed:**
- Clear browser cookies and re-login
- Verify SESSION_SECRET matches between restarts

## License

ISC

## Acknowledgments

- [Globe.GL](https://globe.gl/) - 3D globe visualization
- [MaxMind GeoLite2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data) - IP geolocation
- [Three.js](https://threejs.org/) - WebGL rendering engine
