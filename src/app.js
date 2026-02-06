/**
 * Application Entry Point
 * Wires UDP syslog receiver to event bus for message processing
 * Provides HTTP server for dashboard and WebSocket connections
 */

// Load environment variables from .env file
require('dotenv').config();

const http = require('http');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const { loginLimiter, apiLimiter, passwordChangeLimiter, threatFeedLimiter } = require('./middleware/rate-limiter');
const { SyslogReceiver } = require('./receivers/udp-receiver');
const eventBus = require('./events/event-bus');
const { PaloAltoParser } = require('./parsers/palo-alto-parser');
const { DeadLetterQueue } = require('./utils/error-handler');
const { EnrichmentPipeline } = require('./enrichment/enrichment-pipeline');
const { sessionParser } = require('./middleware/session');
const { requireAuth } = require('./middleware/auth-check');
const loginRouter = require('./routes/login');
const logoutRouter = require('./routes/logout');
const changePasswordRouter = require('./routes/change-password');
const settingsRouter = require('./routes/settings');
const logoRouter = require('./routes/logo');
const threatFeedRouter = require('./routes/threat-feed');
const { setupWebSocketServer } = require('./websocket/ws-server');
const { wireEventBroadcast, broadcastThreatFeed } = require('./websocket/broadcaster');

// Note about privileged ports
console.log('========================================');
console.log('OCDE Threat Map - Real-time Syslog Processor');
console.log('========================================');
console.log('');
console.log('Note: Port 514 requires root privileges.');
console.log('Run with sudo or use \'sudo setcap cap_net_bind_service=+ep $(which node)\' for non-root binding.');
console.log('');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Configure Express middleware
// Security headers with helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "unpkg.com", "cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],  // Allow inline event handlers (onclick, etc.)
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "unpkg.com", "raw.githubusercontent.com"],
      connectSrc: ["'self'", "ws:", "wss:", "raw.githubusercontent.com", "cdn.jsdelivr.net", "unpkg.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false  // Required for external resources
}));

app.use(bodyParser.json());
app.use(sessionParser);

// Apply general API rate limiting
app.use('/api', apiLimiter);

// Serve static files from public directory
app.use(express.static('public'));

// Serve reconnecting-websocket library from node_modules
app.use('/js/reconnecting-websocket.min.js', express.static('node_modules/reconnecting-websocket/dist/reconnecting-websocket-iife.min.js'));
app.get('/reconnecting-websocket', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'node_modules', 'reconnecting-websocket', 'dist', 'reconnecting-websocket-iife.min.js'));
});

// Mount routes with rate limiting
app.use('/login', loginLimiter, loginRouter);
app.use('/logout', logoutRouter);
app.use('/api/change-password', passwordChangeLimiter, requireAuth, changePasswordRouter);
app.use('/api/settings', settingsRouter);  // GET is public, PUT requires auth below
app.use('/api/logo', logoRouter);  // Logo upload/management
app.use('/api/threat-feed', threatFeedLimiter, threatFeedRouter);  // GET public, POST API key, DELETE session

// Public dashboard route (no authentication required)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// Auth status check endpoint (for client-side auth state detection)
app.get('/api/auth/status', (req, res) => {
  res.json({
    authenticated: !!(req.session && req.session.authenticated),
    userId: req.session?.userId || null
  });
});

// Admin login page (public - allows unauthenticated users to log in)
app.get('/login', (req, res) => {
  // If already authenticated, redirect to admin
  if (req.session && req.session.authenticated === true) {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// Protected admin panel route
app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// Root redirect to dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// Get settings for network binding
const { getSettings } = require('./routes/settings');
const networkSettings = getSettings();

// Create syslog receiver instance
// Environment variables override settings, settings default to localhost (127.0.0.1)
const syslogPort = parseInt(process.env.SYSLOG_PORT || networkSettings.syslogPort || '514', 10);
const syslogBindAddress = process.env.SYSLOG_BIND_ADDRESS || networkSettings.syslogBindAddress || '127.0.0.1';
const receiver = new SyslogReceiver({
  port: syslogPort,
  address: syslogBindAddress
});

// Create parser, dead letter queue, and enrichment pipeline
const parser = new PaloAltoParser();
const dlq = new DeadLetterQueue();
const enrichmentPipeline = new EnrichmentPipeline(eventBus);

// Metrics tracking
let totalReceived = 0;
let totalParsed = 0;
let totalFailed = 0;

// Wire receiver to event bus
// When receiver gets a message, forward it to the event bus
receiver.on('message', (data) => {
  eventBus.emit('message', data);
});

// Handle receiver errors
receiver.on('error', (err) => {
  console.error('Receiver error:', err);
  // Don't crash - continue operation
});

// Wire eventBus 'message' to parser
eventBus.on('message', (data) => {
  totalReceived++;
  parser.parse(data.raw);
});

// Handle parsed events
eventBus.on('parsed', (event) => {
  totalParsed++;
  console.log('PARSED:', JSON.stringify({
    timestamp: event.timestamp,
    sourceIP: event.sourceIP,
    destinationIP: event.destinationIP,
    threatType: event.threatType,
    action: event.action
  }));
});

// Handle enriched events (primary output)
eventBus.on('enriched', (event) => {
  const geoInfo = event.geo
    ? `${event.geo.city || 'Unknown'}, ${event.geo.country || 'Unknown'} (${event.geo.latitude}, ${event.geo.longitude})`
    : 'No geo data';

  console.log(`[ENRICHED] ${event.timestamp} | ${event.sourceIP} -> ${event.destinationIP} | ${event.threatType} | ${geoInfo} | Enrichment: ${event.enrichmentTime}ms`);
});

// Handle parse errors
eventBus.on('parse-error', (error) => {
  totalFailed++;
  dlq.add(error.rawMessage, new Error(error.error));
});

// Metrics reporting (every 10 seconds)
setInterval(() => {
  const successRate = totalReceived > 0 ? (totalParsed / totalReceived * 100).toFixed(2) : 0;
  console.log(`METRICS: Received=${totalReceived}, Parsed=${totalParsed}, Failed=${totalFailed}, Success Rate=${successRate}%`);
}, 10000);

// Async startup function
async function start() {
  try {
    // Initialize enrichment pipeline first
    await enrichmentPipeline.initialize();
    console.log('');

    // Start HTTP server
    // Environment variables override settings, settings default to localhost (127.0.0.1)
    const httpPort = parseInt(process.env.HTTP_PORT || networkSettings.httpPort || '3000', 10);
    const httpBindAddress = process.env.HTTP_BIND_ADDRESS || networkSettings.httpBindAddress || '127.0.0.1';
    server.listen(httpPort, httpBindAddress, () => {
      console.log(`HTTP server listening on ${httpBindAddress}:${httpPort}`);
    });

    // Setup WebSocket server
    const wss = setupWebSocketServer(server, sessionParser);

    // Wire broadcast to enriched events
    wireEventBroadcast(wss);

    // Wire threat feed broadcast function
    const { setBroadcastFn } = require('./routes/threat-feed');
    setBroadcastFn(broadcastThreatFeed);

    // Start the syslog receiver
    const addr = await receiver.listen();
    console.log('Receiver started successfully');
    console.log(`Listening on: ${addr.address}:${addr.port}`);
    console.log('');
    console.log('Waiting for syslog messages...');
    console.log('');
  } catch (err) {
    console.error('Failed to start application:', err);
    if (err.code === 'EACCES') {
      console.error('');
      console.error('Permission denied: Port 514 requires root privileges.');
      console.error('Please run with sudo or configure port capabilities.');
      console.error('');
    }
    process.exit(1);
  }
}

// Start the application
start();

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('');
  console.log('Shutting down...');

  // Log final metrics
  const successRate = totalReceived > 0 ? (totalParsed / totalReceived * 100).toFixed(2) : 0;
  console.log(`Final metrics: Received=${totalReceived}, Parsed=${totalParsed}, Failed=${totalFailed}, Success Rate=${successRate}%`);

  // Stop components
  server.close(() => {
    console.log('HTTP server closed');
  });
  receiver.stop();
  enrichmentPipeline.shutdown();

  // Exit cleanly
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('');
  console.log('Received SIGTERM, shutting down...');
  server.close();
  receiver.stop();
  enrichmentPipeline.shutdown();
  process.exit(0);
});

// Handle uncaught exceptions (last resort)
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  console.error('Stack:', err.stack);
  // Don't exit - try to continue
});