const maxmind = require('maxmind');
const path = require('path');

/**
 * GeoLocator - IP address geolocation using MaxMind GeoLite2-City database
 *
 * Converts IP addresses to geographic coordinates for threat visualization.
 * Uses in-memory database lookup for high performance.
 */
class GeoLocator {
  constructor() {
    this.lookup = null;
  }

  /**
   * Initialize MaxMind database reader
   * Must be called before get() - loads database into memory for fast lookups
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    const dbPath = path.join(__dirname, '../../data/GeoLite2-City.mmdb');

    this.lookup = await maxmind.open(dbPath, {
      cache: {
        max: 10000  // Internal maxmind cache for frequently queried IPs
      },
      watchForUpdates: false  // Disable for MVP (enable in production)
    });

    console.log('GeoLocator initialized with MaxMind GeoLite2-City database');
  }

  /**
   * Get geographic coordinates for an IP address
   *
   * @param {string} ip - IPv4 address to lookup
   * @returns {Object|null} Geographic data: {latitude, longitude, city, country, countryName} or null if not found
   */
  get(ip) {
    if (!this.lookup) {
      throw new Error('GeoLocator not initialized - call initialize() first');
    }

    // Validate IP format (basic check)
    if (!this.isValidIPv4(ip)) {
      return null;
    }

    try {
      const result = this.lookup.get(ip);

      if (!result) {
        return null;  // IP not found in database (private/invalid)
      }

      // Extract coordinates and location data from MaxMind response
      return {
        latitude: result?.location?.latitude || null,
        longitude: result?.location?.longitude || null,
        city: result?.city?.names?.en || null,
        country: result?.country?.iso_code || null,
        countryName: result?.country?.names?.en || null
      };

    } catch (err) {
      console.error(`GeoLocator error for IP ${ip}:`, err.message);
      return null;
    }
  }

  /**
   * Validate IPv4 address format
   *
   * @param {string} ip - IP address string to validate
   * @returns {boolean} True if valid IPv4 format
   */
  isValidIPv4(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ip);
  }
}

module.exports = { GeoLocator };
