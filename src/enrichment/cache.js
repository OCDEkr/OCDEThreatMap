const { LRUCache } = require('lru-cache');
const { GeoLocator } = require('./geolocation.js');

/**
 * CachedGeoLocator - Wraps GeoLocator with LRU cache
 * Provides sub-millisecond lookups for recently-seen IPs
 */
class CachedGeoLocator {
  constructor() {
    this.geoLocator = new GeoLocator();

    // LRU cache with 1-hour TTL per phase success criteria
    this.cache = new LRUCache({
      max: 10000,              // Maximum 10,000 cached IPs
      ttl: 1000 * 60 * 60,     // 1 hour TTL (3,600,000 ms)
      updateAgeOnGet: false,   // Don't reset TTL on access (per RESEARCH.md)
    });

    // Metrics tracking
    this.metrics = {
      hits: 0,
      misses: 0,
      startTime: Date.now()
    };

    // Interval handle for metrics logging
    this.metricsInterval = null;
  }

  /**
   * Initialize underlying GeoLocator (loads MaxMind database)
   * Must be called before get()
   */
  async initialize() {
    await this.geoLocator.initialize();
    console.log('CachedGeoLocator initialized with 10,000-item cache (1-hour TTL)');
  }

  /**
   * Get geographic coordinates for an IP (with caching)
   * @param {string} ip - IPv4 address
   * @returns {Object|null} - {latitude, longitude, city, country} or null
   */
  get(ip) {
    // Check if IP exists in cache (handles both hit and stale)
    if (this.cache.has(ip)) {
      // Cache hit - return cached data
      this.metrics.hits++;
      return this.cache.get(ip);
    }

    // Cache miss - lookup and cache result
    this.metrics.misses++;
    const geoData = this.geoLocator.get(ip);

    // Cache the result (even if null - prevents repeated lookups of invalid IPs)
    this.cache.set(ip, geoData);

    return geoData;
  }

  /**
   * Get cache performance metrics
   * @returns {Object} - {hits, misses, hitRate, cacheSize, uptime}
   */
  getMetrics() {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? (this.metrics.hits / total * 100).toFixed(2) : 0;
    const uptimeSeconds = Math.floor((Date.now() - this.metrics.startTime) / 1000);

    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      hitRate: parseFloat(hitRate),
      cacheSize: this.cache.size,
      maxSize: 10000,
      uptimeSeconds
    };
  }

  /**
   * Reset metrics counters (for testing)
   */
  resetMetrics() {
    this.metrics.hits = 0;
    this.metrics.misses = 0;
    this.metrics.startTime = Date.now();
  }

  /**
   * Start periodic metrics logging to console
   * @param {number} intervalMs - Logging interval in milliseconds (default: 30000 = 30 seconds)
   */
  startMetricsLogging(intervalMs = 30000) {
    if (this.metricsInterval) {
      console.warn('Metrics logging already started');
      return;
    }

    console.log(`Starting cache metrics logging every ${intervalMs / 1000} seconds`);

    this.metricsInterval = setInterval(() => {
      const metrics = this.getMetrics();

      console.log(`[GeoCache] Hits: ${metrics.hits} | Misses: ${metrics.misses} | Hit Rate: ${metrics.hitRate}% | Cache Size: ${metrics.cacheSize}/${metrics.maxSize}`);

      // Warning if hit rate below 80% target (per phase success criteria)
      if (metrics.hitRate < 80 && (metrics.hits + metrics.misses) > 100) {
        console.warn(`[GeoCache] WARNING: Hit rate ${metrics.hitRate}% below 80% target`);
      }

    }, intervalMs);
  }

  /**
   * Stop periodic metrics logging
   */
  stopMetricsLogging() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
      console.log('Cache metrics logging stopped');
    }
  }
}

module.exports = { CachedGeoLocator };
