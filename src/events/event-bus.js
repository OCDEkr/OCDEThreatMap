/**
 * Central event bus for syslog message flow
 * Singleton EventEmitter instance that decouples transport from processing
 */

const { EventEmitter } = require('events');

// Create singleton EventEmitter instance
const eventBus = new EventEmitter();

// Set maxListeners to 20 to avoid warning with multiple handlers
eventBus.setMaxListeners(20);

// Export the singleton instance
module.exports = eventBus;