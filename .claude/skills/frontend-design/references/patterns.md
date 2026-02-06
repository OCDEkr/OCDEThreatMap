# Patterns Reference

## Contents
- Styling Architecture
- DO/DON'T Pairs
- Anti-Patterns
- Dynamic Panel Creation Pattern
- Color Consistency Rules
- NOC Display Considerations
- New Feature Workflow

## Styling Architecture

This project uses **three styling approaches** that MUST NOT be mixed within a single file:

| Approach | Where Used | Files |
|----------|-----------|-------|
| External CSS | Dashboard overlay layout | `public/css/dashboard.css` |
| Inline `<style>` | Login, Admin pages | `public/login.html`, `public/admin.html` |
| JS inline styles | Dynamically created panels | `public/js/stats-display.js`, `public/js/top-stats.js` |

**Why three approaches:** Dashboard panels created by JS need inline styles because they don't exist in the DOM at page load. The admin and login pages are self-contained HTML files that don't load `dashboard.css`. The dashboard CSS file handles only the persistent overlay elements.

## DO/DON'T Pairs

### Panel Backgrounds

```css
/* DO - semi-transparent black over globe */
background: rgba(0, 0, 0, 0.8);

/* DON'T - opaque gray kills the immersive feel */
background: #1a1a1a;
background: #222222;
background: rgb(30, 30, 30);
```

**Why:** The globe/map must remain partially visible through panels. Opaque backgrounds create dead zones that break the heads-up display aesthetic.

### Border Width

```css
/* DO - 2px borders for visibility at distance */
border: 2px solid #00d9ff;

/* DON'T - thin borders disappear on NOC displays */
border: 1px solid #00d9ff;
border: none;
```

**Why:** NOC operators view from 20+ feet. 1px borders are invisible at that distance. Every panel needs a visible 2px border.

### Glow Color Matching

```css
/* DO - glow matches the element's border/text color */
border: 2px solid #00ff00;
box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);

/* DON'T - mismatched glow creates visual noise */
border: 2px solid #00ff00;
box-shadow: 0 0 20px rgba(0, 217, 255, 0.3);
```

**Why:** Mismatched glows look like rendering artifacts. The glow should feel like light bleeding from the border, not a separate effect.

### Font Declaration

```css
/* DO - always include monospace fallback */
font-family: 'Courier New', monospace;

/* DON'T - any of these break the terminal aesthetic */
font-family: Arial, sans-serif;
font-family: 'Courier New';  /* Missing fallback */
font-family: 'Inter', sans-serif;
```

### Text Colors

```css
/* DO - use semantic green/cyan roles */
color: #00ff00;  /* Data values */
color: #00d9ff;  /* Headers, chrome */

/* DON'T - use white text */
color: #ffffff;
color: white;
color: #ccc;
```

**Why:** White text breaks the terminal color scheme. Every text element has a semantic color: green for data, cyan for structure, orange for warnings, red for errors.

### Button Sizing

```css
/* DO - consistent 50x50 icon buttons */
width: 50px;
height: 50px;

/* DON'T - varied button sizes break the toolbar */
width: auto;
padding: 10px 20px;
```

**Why:** The control toolbar at top:158px is a horizontal row of identically-sized squares. Mixed sizes break the visual rhythm.

## Anti-Patterns

### WARNING: White or Light Backgrounds

**The Problem:**

```css
/* BAD - destroys NOC readability */
.panel { background: white; color: #333; }
.panel { background: #f5f5f5; }
```

**Why This Breaks:**
1. White panels create painful glare on NOC wall displays in dimmed rooms
2. Destroys contrast with the black globe background
3. Makes colored arcs invisible when they pass behind panels
4. Operators get eye strain watching white panels for 8+ hour shifts

**The Fix:**

```css
.panel { background: rgba(0, 0, 0, 0.8); color: #00ff00; }
```

### WARNING: CSS Frameworks or Preprocessors

**The Problem:** Adding Tailwind, Bootstrap, or Sass.

**Why This Breaks:**
1. The project serves CSS directly via Express static files -- no build pipeline exists
2. Framework utility classes conflict with the established inline style patterns in JS
3. Framework color systems override the carefully tuned NOC palette
4. Adds unnecessary weight to a performance-sensitive real-time dashboard

**The Fix:** Use vanilla CSS in `dashboard.css` or inline styles in JS panel creators.

### WARNING: Dynamic Font Size with Viewport Units

```css
/* BAD - unpredictable on NOC displays */
font-size: 2vw;
font-size: clamp(14px, 1.5vw, 28px);
```

**Why This Breaks:** NOC displays range from 1080p to 4K. Viewport units create wildly different sizes. The project uses fixed pixel values with media query breakpoints at 1920px and 3840px for predictable scaling.

### WARNING: Unsynchronized Country Color Maps

The `COUNTRY_COLORS` object exists in BOTH `public/js/custom-arcs.js` (Three.js hex integers) and `public/js/flat-map-d3.js` (CSS hex strings). Adding a country to one file without the other creates inconsistent colors between globe and flat map views.

**The Fix:** When adding/changing country colors, update both files. Search for `COUNTRY_COLORS` to find both maps.

## Dynamic Panel Creation Pattern

JS-created panels follow this template from `stats-display.js` and `top-stats.js`:

```javascript
(function() {
  'use strict';

  let panel = null;

  window.createMyPanel = function() {
    if (panel) return panel;                    // Prevent duplicates

    panel = document.createElement('div');
    panel.id = 'my-panel';
    panel.style.cssText = `
      position: absolute;
      /* ... all styles inline ... */
    `;

    panel.innerHTML = `/* ... template ... */`;
    document.body.appendChild(panel);
    return panel;
  };

  window.updateMyPanel = function(data) {
    if (!panel) return;                         // Guard against missing panel
    // Update DOM elements
  };

  window.removeMyPanel = function() {
    if (panel) { panel.remove(); panel = null; }
  };
})();
```

Key rules:
1. IIFE wrapper for encapsulation
2. Singleton guard (check if panel already exists)
3. All styles inline (no CSS class dependency)
4. Expose create/update/remove to `window`
5. Null check before updates

## NOC Display Considerations

1. **Minimum font size: 16px** -- anything smaller is unreadable at 20+ feet
2. **No tooltips** -- mouse interaction is rare on wall displays
3. **No scrolling required** -- panels cap at 25vh to show content without scrolling
4. **High contrast always** -- minimum contrast ratio is not WCAG-based but "visible from across the room"
5. **No hover-dependent information** -- critical data must be visible without interaction
6. **Auto-updating displays** -- data refreshes via WebSocket, no manual refresh needed

## New Feature Workflow

Copy this checklist when adding a new UI feature:

1. Design
- [ ] Determine which corner/zone the element belongs in (see layouts.md)
- [ ] Choose border color by semantic role (green=data, cyan=chrome, orange=filtered)
- [ ] Will it be CSS-positioned or JS-created? (static = CSS, dynamic = JS)

2. Implement
- [ ] Use the panel/button template from this file
- [ ] Match existing glow intensity (0.3 rest, 0.6 hover)
- [ ] Add responsive rules at 1920px and 3840px breakpoints
- [ ] Test with globe view AND flat map view active

3. Validate
- [ ] Start test traffic: `node test/send-random-attacks.js`
- [ ] Verify no overlap with existing panels
- [ ] Check element doesn't block globe interaction (drag, zoom)
- [ ] If panel scrolls, verify max-height caps at 25vh
- [ ] Verify colors match the rest of the design system

4. Performance
- [ ] If JS-created: add singleton guard and cleanup function
- [ ] If animated: use requestAnimationFrame, not setInterval
- [ ] If updating frequently: batch DOM writes
