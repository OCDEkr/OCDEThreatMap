/**
 * Top Statistics Tracking Module
 * Tracks top attacking countries and attack types since server start
 */

(function() {
  'use strict';

  // Track statistics since page load
  const countryStats = new Map(); // country_code -> count
  const attackStats = new Map();  // threat_type -> count

  let countriesPanel = null;
  let attacksPanel = null;

  /**
   * Create the Top Countries panel
   */
  window.createTopCountriesPanel = function() {
    if (countriesPanel) {
      console.warn('Top Countries panel already exists');
      return countriesPanel;
    }

    countriesPanel = document.createElement('div');
    countriesPanel.id = 'top-countries-panel';
    countriesPanel.style.cssText = `
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: #ff8c00;
      font-family: 'Courier New', monospace;
      font-size: 22px;
      border: 2px solid #ff8c00;
      padding: 10px 12px;
      min-width: 200px;
      max-width: 250px;
      z-index: 10;
      border-radius: 5px;
      box-shadow: 0 0 20px rgba(255, 140, 0, 0.3);
    `;

    countriesPanel.innerHTML = `
      <div style="font-size: 28px; font-weight: bold; margin-bottom: 8px; text-shadow: 0 0 10px #ff8c00; border-bottom: 1px solid #ff8c00; padding-bottom: 5px;">
        TOP 10 COUNTRIES
      </div>
      <div id="countries-list" style="font-size: 20px; line-height: 1.5;">
        <div style="color: #888;">No data yet...</div>
      </div>
    `;

    document.body.appendChild(countriesPanel);
    console.log('Top Countries panel created');
    return countriesPanel;
  };

  /**
   * Create the Top Attacks panel
   */
  window.createTopAttacksPanel = function() {
    if (attacksPanel) {
      console.warn('Top Attacks panel already exists');
      return attacksPanel;
    }

    attacksPanel = document.createElement('div');
    attacksPanel.id = 'top-attacks-panel';
    attacksPanel.style.cssText = `
      position: absolute;
      bottom: 20px;
      right: 280px;
      background: rgba(0, 0, 0, 0.8);
      color: #ff0000;
      font-family: 'Courier New', monospace;
      font-size: 22px;
      border: 2px solid #ff0000;
      padding: 10px 12px;
      min-width: 200px;
      max-width: 250px;
      z-index: 10;
      border-radius: 5px;
      box-shadow: 0 0 20px rgba(255, 0, 0, 0.3);
    `;

    attacksPanel.innerHTML = `
      <div style="font-size: 28px; font-weight: bold; margin-bottom: 8px; text-shadow: 0 0 10px #ff0000; border-bottom: 1px solid #ff0000; padding-bottom: 5px;">
        TOP 10 ATTACKS
      </div>
      <div id="attacks-list" style="font-size: 20px; line-height: 1.5;">
        <div style="color: #888;">No data yet...</div>
      </div>
    `;

    document.body.appendChild(attacksPanel);
    console.log('Top Attacks panel created');
    return attacksPanel;
  };

  /**
   * Update statistics with new attack data
   * @param {Object} data - Enriched attack data
   */
  window.updateTopStats = function(data) {
    // Update country statistics - store both name and code
    const countryCode = data.geo?.country_code || data.geo?.country || 'XX';
    const countryName = data.geo?.countryName || countryCode;

    // Use country code as key to track both name and count
    const existing = countryStats.get(countryCode) || { name: countryName, count: 0 };
    existing.count++;
    // Update name if we get a better one (actual name vs code)
    if (countryName.length > 2) {
      existing.name = countryName;
    }
    countryStats.set(countryCode, existing);

    // Update attack type statistics
    const threatType = data.attack?.threat_type || data.threatType || 'unknown';
    attackStats.set(threatType, (attackStats.get(threatType) || 0) + 1);

    // Refresh displays
    updateCountriesDisplay();
    updateAttacksDisplay();
  };

  /**
   * Update the countries display
   */
  function updateCountriesDisplay() {
    const listElement = document.getElementById('countries-list');
    if (!listElement) return;

    // Sort countries by count (descending) and take top 10
    // countryStats now stores { name, count } objects keyed by country code
    const sortedCountries = Array.from(countryStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    if (sortedCountries.length === 0) {
      listElement.innerHTML = '<div style="color: #888;">No data yet...</div>';
      return;
    }

    const topCount = sortedCountries[0][1].count;

    // Build the list HTML with country-specific colors matching arc colors
    const html = sortedCountries.map(([countryCode, data], index) => {
      const barWidth = Math.max(5, (data.count / topCount) * 100);

      // Get the country's arc color (falls back to orange if not mapped)
      const textColor = window.getCountryColorHex ? window.getCountryColorHex(countryCode) : '#ffa500';

      // Convert hex to rgba for bar background
      const r = parseInt(textColor.slice(1, 3), 16);
      const g = parseInt(textColor.slice(3, 5), 16);
      const b = parseInt(textColor.slice(5, 7), 16);
      const barBg = `rgba(${r}, ${g}, ${b}, 0.2)`;

      return `
        <div style="margin: 4px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: bold; color: ${textColor}; text-shadow: 0 0 8px ${textColor};">${index + 1}. ${data.name}</span>
            <span style="color: ${textColor};">${data.count}</span>
          </div>
          <div style="background: ${barBg}; height: 4px; margin-top: 2px;">
            <div style="background: ${textColor}; height: 100%; width: ${barWidth}%;"></div>
          </div>
        </div>
      `;
    }).join('');

    listElement.innerHTML = html;
  }

  /**
   * Update the attacks display
   */
  function updateAttacksDisplay() {
    const listElement = document.getElementById('attacks-list');
    if (!listElement) return;

    // Sort attack types by count (descending) and take top 10
    const sortedAttacks = Array.from(attackStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (sortedAttacks.length === 0) {
      listElement.innerHTML = '<div style="color: #888;">No data yet...</div>';
      return;
    }

    // Build the list HTML
    const html = sortedAttacks.map(([type, count], index) => {
      const barWidth = Math.max(5, (count / sortedAttacks[0][1]) * 100);
      const displayType = type.charAt(0).toUpperCase() + type.slice(1);

      // Map threat type to colors (matching arc colors)
      const colorMap = {
        malware: '#ff0000',      // Red
        intrusion: '#ff8c00',    // Orange
        ddos: '#8a2be2',         // Purple
        default: '#ff0000'       // Red (default)
      };
      const textColor = colorMap[type] || colorMap.default;
      const barColor = textColor;
      const barBgColor = textColor.replace(')', ', 0.2)').replace('rgb', 'rgba').replace('#', 'rgba(');

      // Convert hex to rgba for background
      let barBg;
      if (textColor.startsWith('#')) {
        const r = parseInt(textColor.slice(1, 3), 16);
        const g = parseInt(textColor.slice(3, 5), 16);
        const b = parseInt(textColor.slice(5, 7), 16);
        barBg = `rgba(${r}, ${g}, ${b}, 0.2)`;
      } else {
        barBg = `rgba(255, 0, 0, 0.2)`;
      }

      return `
        <div style="margin: 4px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: bold; color: ${textColor};">${index + 1}. ${displayType}</span>
            <span style="color: ${textColor};">${count}</span>
          </div>
          <div style="background: ${barBg}; height: 4px; margin-top: 2px;">
            <div style="background: ${barColor}; height: 100%; width: ${barWidth}%;"></div>
          </div>
        </div>
      `;
    }).join('');

    listElement.innerHTML = html;
  }

  /**
   * Reset all statistics
   */
  window.resetTopStats = function() {
    countryStats.clear();
    attackStats.clear();
    updateCountriesDisplay();
    updateAttacksDisplay();
    console.log('Top statistics reset');
  };

  console.log('Top Stats module initialized');
})();
