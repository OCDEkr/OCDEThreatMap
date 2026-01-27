/**
 * Country Coordinate Mapping Module
 * Maps country codes to latitude/longitude coordinates
 * Pattern: IIFE exposing window.getCountryCoordinates
 */

(function() {
  'use strict';

  /**
   * Country code to coordinate mapping
   * Coordinates represent capital cities or geographic centroids
   * Format: [latitude, longitude]
   */
  const countryCoords = {
    // Top 10 most common attack source countries
    'CN': [39.9042, 116.4074],   // China - Beijing
    'RU': [55.7558, 37.6173],    // Russia - Moscow
    'US': [37.751, -97.822],     // USA - Geographic centroid
    'KR': [37.5665, 126.9780],   // South Korea - Seoul
    'IN': [28.6139, 77.2090],    // India - New Delhi
    'BR': [-15.7942, -47.8825],  // Brazil - Brasilia
    'DE': [52.5200, 13.4050],    // Germany - Berlin
    'GB': [51.5074, -0.1278],    // UK - London
    'FR': [48.8566, 2.3522],     // France - Paris
    'JP': [35.6762, 139.6503],   // Japan - Tokyo

    // Additional common sources
    'VN': [21.0285, 105.8542],   // Vietnam - Hanoi
    'NL': [52.3676, 4.9041],     // Netherlands - Amsterdam
    'TH': [13.7563, 100.5018],   // Thailand - Bangkok
    'ID': [-6.2088, 106.8456],   // Indonesia - Jakarta
    'TR': [39.9334, 32.8597],    // Turkey - Ankara
    'UA': [50.4501, 30.5234],    // Ukraine - Kyiv
    'PL': [52.2297, 21.0122],    // Poland - Warsaw
    'AR': [-34.6037, -58.3816],  // Argentina - Buenos Aires
    'CA': [45.4215, -75.6972],   // Canada - Ottawa
    'AU': [-35.2809, 149.1300],  // Australia - Canberra

    // Regional threats
    'IR': [35.6892, 51.3890],    // Iran - Tehran
    'KP': [39.0392, 125.7625],   // North Korea - Pyongyang
    'SY': [33.5138, 36.2765],    // Syria - Damascus
    'IQ': [33.3152, 44.3661],    // Iraq - Baghdad
    'PK': [33.6844, 73.0479],    // Pakistan - Islamabad

    // Europe
    'IT': [41.9028, 12.4964],    // Italy - Rome
    'ES': [40.4168, -3.7038],    // Spain - Madrid
    'SE': [59.3293, 18.0686],    // Sweden - Stockholm
    'RO': [44.4268, 26.1025],    // Romania - Bucharest
    'CH': [46.9481, 7.4474],     // Switzerland - Bern

    // Asia-Pacific
    'SG': [1.3521, 103.8198],    // Singapore
    'HK': [22.3193, 114.1694],   // Hong Kong
    'MY': [3.1390, 101.6869],    // Malaysia - Kuala Lumpur
    'PH': [14.5995, 120.9842],   // Philippines - Manila
    'BD': [23.8103, 90.4125],    // Bangladesh - Dhaka

    // Middle East
    'IL': [31.7683, 35.2137],    // Israel - Jerusalem
    'SA': [24.7136, 46.6753],    // Saudi Arabia - Riyadh
    'AE': [24.4539, 54.3773],    // UAE - Abu Dhabi
    'EG': [30.0444, 31.2357]     // Egypt - Cairo
  };

  /**
   * Get coordinates for a country code
   * @param {string} countryCode - ISO 3166-1 alpha-2 country code (e.g., 'CN', 'US')
   * @returns {Array|null} [latitude, longitude] or null if not found
   */
  window.getCountryCoordinates = function(countryCode) {
    if (!countryCode || typeof countryCode !== 'string') {
      return null;
    }

    // Normalize to uppercase
    const code = countryCode.trim().toUpperCase();

    return countryCoords[code] || null;
  };

  /**
   * Check if a country code is supported
   * @param {string} countryCode - ISO 3166-1 alpha-2 country code
   * @returns {boolean} True if country has coordinates
   */
  window.hasCountryCoordinates = function(countryCode) {
    if (!countryCode || typeof countryCode !== 'string') {
      return false;
    }

    const code = countryCode.trim().toUpperCase();
    return code in countryCoords;
  };

  /**
   * Get all supported country codes
   * @returns {Array} Array of country codes
   */
  window.getSupportedCountries = function() {
    return Object.keys(countryCoords);
  };

  console.log('Country coordinates module loaded:', Object.keys(countryCoords).length, 'countries');

})();
