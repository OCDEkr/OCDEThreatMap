/**
 * UDP Syslog Receiver Module
 * Listens on UDP port 514 for incoming syslog messages
 * Emits 'message' events for processing by other modules
 */

const dgram = require('dgram');
const { EventEmitter } = require('events');

class SyslogReceiver extends EventEmitter {
  /**
   * Create a new SyslogReceiver instance
   * @param {Object} options - Configuration options
   * @param {number} options.port - UDP port to listen on (default: 514)
   * @param {string} options.address - IP address to bind to (default: '0.0.0.0')
   */
  constructor(options = {}) {
    super();

    this.port = options.port || 514;
    this.address = options.address || '0.0.0.0';
    this.socket = null;
  }

  /**
   * Start listening for UDP syslog messages
   * @returns {Promise} Resolves when socket is listening
   */
  listen() {
    return new Promise((resolve, reject) => {
      // Create UDP4 socket with configuration
      this.socket = dgram.createSocket({
        type: 'udp4',
        reuseAddr: true,
        recvBufferSize: 33554432  // 32MB buffer for high-volume traffic
      });

      // Handle incoming messages
      this.socket.on('message', (msg, rinfo) => {
        // Process immediately - message parsing is fast (string conversion + emit)
        const messageData = {
          raw: msg.toString('utf8'),
          remoteAddress: rinfo.address,
          remotePort: rinfo.port,
          timestamp: new Date().toISOString()
        };

        // Emit message event for downstream processing
        this.emit('message', messageData);
      });

      // CRITICAL: Handle socket errors to prevent crash
      // Missing error handler causes Node.js process termination
      this.socket.on('error', (err) => {
        console.error('Socket error:', err.message);
        console.error('Error details:', err);

        // Emit error event for upstream handling
        this.emit('error', err);

        // Do NOT crash - graceful degradation
        // Socket remains operational unless error is fatal
      });

      // Handle socket close
      this.socket.on('close', () => {
        console.log('Syslog receiver socket closed');
        this.emit('close');
      });

      // Start listening
      this.socket.on('listening', () => {
        const addr = this.socket.address();
        console.log(`Syslog receiver listening on ${addr.address}:${addr.port}`);

        // Check if running on privileged port
        if (this.port < 1024 && process.getuid && process.getuid() !== 0) {
          console.warn('WARNING: Port 514 requires root privileges.');
          console.warn('Run with sudo or use: sudo setcap cap_net_bind_service=+ep $(which node)');
        }

        resolve(addr);
      });

      // Bind to specified address and port
      this.socket.bind(this.port, this.address, (err) => {
        if (err) {
          console.error(`Failed to bind to ${this.address}:${this.port}`, err);
          reject(err);
        }
      });
    });
  }

  /**
   * Stop the receiver and close the socket
   */
  stop() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

module.exports = { SyslogReceiver };