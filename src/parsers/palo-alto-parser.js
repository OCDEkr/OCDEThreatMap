const parser = require('nsyslog-parser-2');
const { EventEmitter } = require('events');
const eventBus = require('../events/event-bus');

/**
 * PaloAltoParser - Parses RFC 5424 syslog messages from Palo Alto firewalls
 * Extracts source IP, destination IP, threat type, timestamp, and action
 * Handles malformed messages gracefully without crashing
 */
class PaloAltoParser extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Parse a raw syslog message and extract Palo Alto specific fields
   * @param {string} rawMessage - The raw syslog message
   * @returns {Object|null} - Parsed event object or null on failure
   */
  parse(rawMessage) {
    try {
      // Pre-process: Strip newline escape sequences (#012, \n)
      // This handles RESEARCH.md Pitfall 3 - escape sequences in messages
      const cleanedMessage = rawMessage.replace(/#012/g, ' ').replace(/\n/g, ' ').trim();

      // Parse with nsyslog-parser-2
      const parsed = parser(cleanedMessage, {
        cef: true,          // Enable CEF format support for Palo Alto
        fields: true,       // Parse structured data
        pid: true,          // Extract PID from app[pid] format
        generateTimestamp: false  // Don't auto-generate if missing
      });

      if (!parsed) {
        throw new Error('Parser returned empty result');
      }

      // Extract action first to filter for DENY logs only
      const action = this.extractAction(parsed);
      if (!action || action.toLowerCase() !== 'deny') {
        // Not a DENY log, skip processing
        return null;
      }

      // Extract fields from parsed message
      const sourceIP = this.extractSourceIP(parsed);
      const destinationIP = this.extractDestinationIP(parsed);
      const threatType = this.extractThreatType(parsed);
      const timestamp = parsed.timestamp || new Date().toISOString();

      // Build event object
      const event = {
        timestamp,
        sourceIP,
        destinationIP,
        threatType,
        action,
        raw: rawMessage
      };

      // Emit parsed event
      eventBus.emit('parsed', event);

      return event;

    } catch (err) {
      // Graceful degradation - emit parse error but don't crash
      console.error('Parse error:', err.message);

      eventBus.emit('parse-error', {
        error: err.message,
        rawMessage: rawMessage,
        timestamp: new Date()
      });

      return null;
    }
  }

  /**
   * Extract source IP address from parsed message
   * @param {Object} parsed - Parsed syslog message object
   * @returns {string|null} - Source IP or null if not found
   */
  extractSourceIP(parsed) {
    // Try structured data first
    if (parsed.structuredData && parsed.structuredData.src) {
      return this.validateIPv4(parsed.structuredData.src) ? parsed.structuredData.src : null;
    }

    // Fallback to message regex
    if (parsed.message) {
      const match = parsed.message.match(/src=([0-9.]+)/i);
      if (match && match[1]) {
        return this.validateIPv4(match[1]) ? match[1] : null;
      }
    }

    return null;
  }

  /**
   * Extract destination IP address from parsed message
   * @param {Object} parsed - Parsed syslog message object
   * @returns {string|null} - Destination IP or null if not found
   */
  extractDestinationIP(parsed) {
    // Try structured data first
    if (parsed.structuredData && parsed.structuredData.dst) {
      return this.validateIPv4(parsed.structuredData.dst) ? parsed.structuredData.dst : null;
    }

    // Fallback to message regex
    if (parsed.message) {
      const match = parsed.message.match(/dst=([0-9.]+)/i);
      if (match && match[1]) {
        return this.validateIPv4(match[1]) ? match[1] : null;
      }
    }

    return null;
  }

  /**
   * Extract threat type from parsed message
   * @param {Object} parsed - Parsed syslog message object
   * @returns {string} - Threat type category
   */
  extractThreatType(parsed) {
    // Try structured data first
    if (parsed.structuredData) {
      const threatType = parsed.structuredData.threat_type ||
                        parsed.structuredData.threatType ||
                        parsed.structuredData.subtype;
      if (threatType) {
        return this.categorizeThreat(threatType);
      }
    }

    // Fallback to message parsing
    if (parsed.message) {
      const match = parsed.message.match(/threat[_-]?type[=:]\s*(\w+)/i);
      if (match && match[1]) {
        return this.categorizeThreat(match[1]);
      }
    }

    return 'unknown';
  }

  /**
   * Extract action from parsed message (looking for DENY actions)
   * @param {Object} parsed - Parsed syslog message object
   * @returns {string|null} - Action or null if not found
   */
  extractAction(parsed) {
    // Try structured data first
    if (parsed.structuredData && parsed.structuredData.action) {
      return parsed.structuredData.action.toLowerCase();
    }

    // Fallback to message regex
    if (parsed.message) {
      const match = parsed.message.match(/action[=:]\s*(\w+)/i);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    }

    return null;
  }

  /**
   * Categorize threat type into standard categories
   * @param {string} threat - Raw threat type string
   * @returns {string} - Standardized threat category
   */
  categorizeThreat(threat) {
    const threatLower = threat.toLowerCase();

    if (threatLower.includes('malware') || threatLower.includes('virus') ||
        threatLower.includes('trojan') || threatLower.includes('worm')) {
      return 'malware';
    }

    if (threatLower.includes('intrusion') || threatLower.includes('exploit') ||
        threatLower.includes('vulnerability') || threatLower.includes('attack')) {
      return 'intrusion';
    }

    if (threatLower.includes('ddos') || threatLower.includes('dos') ||
        threatLower.includes('flood')) {
      return 'ddos';
    }

    return 'unknown';
  }

  /**
   * Validate IPv4 address format
   * @param {string} ip - IP address string
   * @returns {boolean} - True if valid IPv4
   */
  validateIPv4(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ip);
  }
}

module.exports = { PaloAltoParser };