/**
 * IP Range Matcher
 * Checks if IP addresses fall within configured CIDR ranges
 */

const ipRangeCheck = require('ip-range-check');

/**
 * Check if an IP address matches any of the OCDE IP ranges
 * @param {string} ip - IP address to check (e.g., "192.168.1.100")
 * @param {string[]} ranges - Array of CIDR ranges (e.g., ["192.168.1.0/24"])
 * @returns {boolean} True if IP is in any of the ranges
 */
function isOCDETarget(ip, ranges) {
  // Handle missing or invalid inputs
  if (!ip || !ranges || ranges.length === 0) {
    return false;
  }

  // Check if IP matches any range
  return ipRangeCheck(ip, ranges);
}

/**
 * Parse OCDE IP ranges from environment variable
 * @param {string} envVar - Comma-separated CIDR ranges from environment
 * @returns {string[]} Array of CIDR ranges
 */
function parseOCDERanges(envVar) {
  if (!envVar) {
    console.warn('[IP Matcher] No OCDE_IP_RANGES configured - all attacks will be marked as non-OCDE');
    return [];
  }

  // Split by comma and trim whitespace
  const ranges = envVar.split(',').map(r => r.trim()).filter(r => r.length > 0);

  if (ranges.length === 0) {
    console.warn('[IP Matcher] OCDE_IP_RANGES is empty - all attacks will be marked as non-OCDE');
  } else {
    console.log(`[IP Matcher] Loaded ${ranges.length} OCDE IP ranges:`, ranges);
  }

  return ranges;
}

module.exports = {
  isOCDETarget,
  parseOCDERanges
};
