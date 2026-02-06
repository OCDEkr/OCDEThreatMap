# Aesthetics Reference

## Contents
- Typography
- Color Palette
- Glow and Shadow System
- Country Color Mapping
- Dark Theme Rationale

## Typography

Single font throughout the entire application: `'Courier New', monospace`. No font imports, no web fonts, no fallback stacks beyond the generic `monospace`.

**Why Courier New:** Fixed-width characters align data columns naturally. Every character occupies the same horizontal space, making IP addresses, timestamps, and country codes scan cleanly on NOC displays. The monospace aesthetic reinforces the security/terminal identity.

### Font Size Scale

| Context | Size | Where Used |
|---------|------|-----------|
| Header title | `36px` | `#header-title` in `public/css/dashboard.css` |
| Panel headers | `28px` | Stats panel, top countries header |
| Large values | `28px` | Attack count in stats panel |
| Section headers | `22px` | Event log header, admin h2 |
| Body text | `16px` | Base body size, event items, form inputs |
| Panel data | `20px` | Top countries list items |
| APM display | `18px` | Attacks per minute |
| Metadata | `11-14px` | Timestamps, labels, last-update |

### Text Properties

```css
/* Headers - always uppercase with letter-spacing */
#header-title {
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 3px;
  text-shadow: 0 0 20px rgba(0, 217, 255, 0.8);
}

/* Data values - bold with glow */
.stat-value {
  font-weight: bold;
  text-shadow: 0 0 10px #00ff00;
}

/* Labels - lighter green variant */
.stat-label {
  color: #00cc00;
}
```

### WARNING: Non-Monospace Fonts

NEVER add sans-serif or serif fonts to this project. The entire visual identity depends on the terminal aesthetic. Adding Inter, Roboto, or Arial would destroy the NOC command-center feel and break column alignment in data displays.

## Color Palette

### Core Colors (from `public/css/dashboard.css`)

```css
/* Background - absolute black, not "near-black" */
background: #000000;

/* Terminal green - primary data color */
color: #00ff00;          /* Full brightness */
color: #00cc00;          /* Labels, secondary text */
color: #00aa00;          /* Metadata, timestamps */

/* Cyan accent - chrome and interactive elements */
color: #00d9ff;          /* Headers, borders, buttons */
border: 2px solid #00d9ff;

/* Error/danger red */
color: #ff4444;          /* Error messages, logout button */
border-color: #ff4444;

/* Warning orange */
color: #ff8c00;          /* OCDE filter, warning boxes */

/* Status yellow */
color: #ff0;             /* Connecting state */
```

### Semantic Color Usage

| Meaning | Color | Context |
|---------|-------|---------|
| Data/OK | `#00ff00` | Attack counts, connected status, event text |
| Chrome | `#00d9ff` | Panel borders, headers, primary buttons |
| Alert | `#ff4444` | Errors, disconnected, danger actions |
| Caution | `#ff8c00` | Warnings, OCDE filter active state |
| Waiting | `#ffff00` | Connecting state |
| Subdued | `#888` | Empty states, timestamps |

### WARNING: Gray Backgrounds

NEVER use gray backgrounds (`#1a1a1a`, `#222`, `#333`) for panels. This project uses `rgba(0, 0, 0, 0.8)` -- semi-transparent pure black. Gray backgrounds reduce contrast against the black page and make the globe/map visible through panels.

## Glow and Shadow System

Every interactive and status element uses matching-color glow effects via `box-shadow` and `text-shadow`. The glow color MUST match the element's border/text color.

```css
/* Green glow (status panels) */
box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);

/* Cyan glow (interactive elements, headers) */
box-shadow: 0 0 20px rgba(0, 217, 255, 0.3);
text-shadow: 0 0 20px rgba(0, 217, 255, 0.8);

/* Orange glow (OCDE filter, countries) */
box-shadow: 0 0 20px rgba(255, 140, 0, 0.3);
text-shadow: 0 0 10px rgba(255, 140, 0, 0.8);

/* Hover intensification - increase spread */
box-shadow: 0 0 15px rgba(0, 217, 255, 0.6);
```

**Glow intensity tiers:**
- Resting: `0.3` opacity spread
- Hover: `0.6` opacity spread
- Active/pulsing: `0.8-1.0` opacity spread

## Country Color Mapping

Defined in both `public/js/custom-arcs.js` (Three.js hex integers) and `public/js/flat-map-d3.js` (CSS hex strings). These maps MUST stay synchronized. Access via `window.getCountryColorHex(countryCode)`.

Regional grouping rationale:
- **Warm colors for Asia** -- high attack volume countries are visually "hot"
- **Cool colors for Europe** -- contrasts against warm Asian traffic
- **Greens for Americas** -- distinct from both warm and cool
- **Purple/magenta for Africa/ME** -- unique spectral range, high visibility
- **Yellow/lime for Oceania** -- bright and distinct for small volume
- **Orange fallback** for unmapped countries

## Dark Theme Rationale

This is not a "dark mode toggle" -- the entire application is dark-only by design:
1. **NOC wall displays** run 24/7 in dimmed rooms; black backgrounds minimize light bleed
2. **WebGL performance** -- black backgrounds hide globe rendering artifacts at edges
3. **Eye strain reduction** -- operators watch these screens for entire shifts
4. **Contrast maximization** -- colored arcs and glows pop against pure black
