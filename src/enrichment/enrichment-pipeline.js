const { EventEmitter } = require('events');
const { CachedGeoLocator } = require('./cache.js');
const { isOCDETarget, parseOCDERanges } = require('../utils/ip-matcher.js');

/**
 * EnrichmentPipeline - Enriches parsed events with geolocation data
 * Listens for 'parsed' events, adds geo coordinates, emits 'enriched' events
 */
class EnrichmentPipeline extends EventEmitter {
  constructor(eventBus) {
    super();
    this.eventBus = eventBus;
    this.geoLocator = new CachedGeoLocator();
    this.latencyWarningThreshold = 5000; // 5 seconds per phase requirement

    // Parse OCDE IP ranges from environment
    this.ocdeRanges = parseOCDERanges(process.env.OCDE_IP_RANGES);
  }

  /**
   * Initialize the enrichment pipeline
   * Loads MaxMind database and starts listening for events
   */
  async initialize() {
    // Initialize geolocation with cache
    await this.geoLocator.initialize();

    // Start cache metrics logging (every 30 seconds)
    this.geoLocator.startMetricsLogging(30000);

    // Listen to parsed events from PaloAltoParser
    this.eventBus.on('parsed', (event) => {
      // Process immediately - enrichment is fast (cached geo lookup + IP matching)
      this.enrich(event);
    });

    console.log('EnrichmentPipeline initialized and listening for parsed events');
  }

  /**
   * Enrich a parsed event with geolocation data
   * @param {Object} event - Parsed event from PaloAltoParser
   */
  enrich(event) {
    const startTime = Date.now();

    try {
      // Get geolocation for source IP
      const geoData = this.geoLocator.get(event.sourceIP);

      // Check if destination IP targets OCDE infrastructure
      const targetingOCDE = isOCDETarget(event.destinationIP, this.ocdeRanges);

      // Build enriched event
      const enrichedEvent = {
        ...event,  // Include all original fields
        geo: geoData ? {
          latitude: geoData.latitude,
          longitude: geoData.longitude,
          city: geoData.city,
          country: geoData.country,
          countryName: geoData.countryName
        } : null,
        isOCDETarget: targetingOCDE,
        enrichmentTime: Date.now() - startTime
      };

      // Check latency against threshold
      if (enrichedEvent.enrichmentTime > this.latencyWarningThreshold) {
        console.warn(`[EnrichmentPipeline] WARNING: Enrichment took ${enrichedEvent.enrichmentTime}ms (threshold: ${this.latencyWarningThreshold}ms)`);
        this.emit('latency:exceeded', enrichedEvent.enrichmentTime);
      }

      // Emit enriched event
      this.eventBus.emit('enriched', enrichedEvent);

      // Also emit to local listeners (for metrics tracking)
      this.emit('enriched', enrichedEvent);

    } catch (err) {
      console.error('[EnrichmentPipeline] Enrichment error:', err.message);

      // Even on error, attempt to classify OCDE targeting
      const targetingOCDE = isOCDETarget(event.destinationIP, this.ocdeRanges);

      // Emit original event with error flag (graceful degradation)
      this.eventBus.emit('enriched', {
        ...event,
        geo: null,
        isOCDETarget: targetingOCDE,
        enrichmentError: err.message,
        enrichmentTime: Date.now() - startTime
      });

      this.emit('enrichment:error', { event, error: err });
    }
  }

  /**
   * Get cache metrics for monitoring
   * @returns {Object} - Cache performance metrics
   */
  getMetrics() {
    return this.geoLocator.getMetrics();
  }

  /**
   * Shutdown the enrichment pipeline
   */
  shutdown() {
    this.geoLocator.stopMetricsLogging();
    console.log('EnrichmentPipeline shutdown');
  }
}

module.exports = { EnrichmentPipeline };
