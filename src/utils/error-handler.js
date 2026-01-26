const fs = require('fs');
const path = require('path');

/**
 * DeadLetterQueue - Tracks and persists failed parse attempts
 * Stores failed messages to disk for later analysis and potential retry
 */
class DeadLetterQueue {
  constructor() {
    // Initialize in-memory failed message array
    this.failedMessages = [];

    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      try {
        fs.mkdirSync(logsDir, { recursive: true });
      } catch (err) {
        console.error('Failed to create logs directory:', err.message);
      }
    }

    // Path to failed messages file
    this.failedMessagesFile = path.join(logsDir, 'failed-messages.jsonl');
  }

  /**
   * Add a failed message to the dead letter queue
   * @param {string} rawMessage - The raw message that failed to parse
   * @param {Error} error - The error that occurred during parsing
   */
  add(rawMessage, error) {
    try {
      // Create entry with truncated message (max 500 chars)
      const entry = {
        timestamp: new Date().toISOString(),
        error: error.message || 'Unknown error',
        rawMessage: rawMessage.substring(0, 500),
        retryCount: 0
      };

      // Add to in-memory array
      this.failedMessages.push(entry);

      // Append to file immediately (JSONL format - one JSON per line)
      // Using sync write to ensure durability even on crash
      try {
        fs.appendFileSync(
          this.failedMessagesFile,
          JSON.stringify(entry) + '\n',
          'utf8'
        );
        console.log('DLQ: Failed message logged');
      } catch (writeErr) {
        // If file write fails, log but don't crash
        console.error('DLQ: Failed to write to file:', writeErr.message);
      }

    } catch (err) {
      // Prioritize application stability over DLQ durability
      console.error('DLQ error:', err.message);
    }
  }

  /**
   * Get count of failed messages in current session
   * @returns {number} - Number of failed messages
   */
  getFailedCount() {
    return this.failedMessages.length;
  }

  /**
   * Calculate failure rate as percentage
   * @param {number} totalProcessed - Total number of messages processed
   * @returns {number} - Failure rate as percentage
   */
  getFailureRate(totalProcessed) {
    if (totalProcessed === 0) {
      return 0;
    }
    return (this.failedMessages.length / totalProcessed) * 100;
  }

  /**
   * Get recent failed messages (for debugging)
   * @param {number} limit - Maximum number of messages to return
   * @returns {Array} - Recent failed messages
   */
  getRecentFailures(limit = 10) {
    return this.failedMessages.slice(-limit);
  }

  /**
   * Clear in-memory failed messages (file persists)
   */
  clearMemory() {
    this.failedMessages = [];
  }

  /**
   * Load failed messages from file (for recovery/analysis)
   * @returns {Array} - Array of failed message entries
   */
  loadFromFile() {
    const messages = [];

    if (!fs.existsSync(this.failedMessagesFile)) {
      return messages;
    }

    try {
      const content = fs.readFileSync(this.failedMessagesFile, 'utf8');
      const lines = content.trim().split('\n');

      for (const line of lines) {
        if (line) {
          try {
            messages.push(JSON.parse(line));
          } catch (parseErr) {
            console.error('DLQ: Failed to parse line:', parseErr.message);
          }
        }
      }
    } catch (err) {
      console.error('DLQ: Failed to read file:', err.message);
    }

    return messages;
  }
}

module.exports = { DeadLetterQueue };