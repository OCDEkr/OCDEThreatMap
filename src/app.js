/**
 * Application Entry Point
 * Wires UDP syslog receiver to event bus for message processing
 */

const { SyslogReceiver } = require('./receivers/udp-receiver');
const eventBus = require('./events/event-bus');

// Note about privileged ports
console.log('========================================');
console.log('OCDE Threat Map - Real-time Syslog Processor');
console.log('========================================');
console.log('');
console.log('Note: Port 514 requires root privileges.');
console.log('Run with sudo or use \'sudo setcap cap_net_bind_service=+ep $(which node)\' for non-root binding.');
console.log('');

// Create syslog receiver instance
const receiver = new SyslogReceiver({
  port: 514,
  address: '0.0.0.0'
});

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

// Log messages received via event bus (first 100 chars for visibility)
eventBus.on('message', (data) => {
  const preview = data.raw.substring(0, 100);
  const truncated = data.raw.length > 100 ? '...' : '';
  console.log(`Received syslog message from ${data.remoteAddress}:${data.remotePort}`);
  console.log(`  Timestamp: ${data.timestamp}`);
  console.log(`  Preview: ${preview}${truncated}`);
  console.log('');
});

// Start the receiver
receiver.listen()
  .then((addr) => {
    console.log('Receiver started successfully');
    console.log(`Listening on: ${addr.address}:${addr.port}`);
    console.log('');
    console.log('Waiting for syslog messages...');
    console.log('');
  })
  .catch((err) => {
    console.error('Failed to start receiver:', err);
    if (err.code === 'EACCES') {
      console.error('');
      console.error('Permission denied: Port 514 requires root privileges.');
      console.error('Please run with sudo or configure port capabilities.');
      console.error('');
    }
    process.exit(1);
  });

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('');
  console.log('Shutting down...');

  // Stop the receiver
  receiver.stop();

  // Exit cleanly
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('');
  console.log('Received SIGTERM, shutting down...');
  receiver.stop();
  process.exit(0);
});

// Handle uncaught exceptions (last resort)
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  console.error('Stack:', err.stack);
  // Don't exit - try to continue
});