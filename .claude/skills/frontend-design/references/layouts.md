# Layouts Reference

## Contents
- Dashboard Layout Architecture
- Z-Index Layering
- Panel Positioning Map
- Header Bar
- Admin Panel Layout
- Responsive Scaling
- Spatial Rules

## Dashboard Layout Architecture

The dashboard (`public/dashboard.html`) uses a full-viewport overlay architecture. The globe/map fills the entire screen as z-index 1, and all UI elements float above it using absolute positioning.

```
+--------------------------------------------------------------+
|  HEADER BAR (z:15, full width, h:80px)                       |
+--------------------------------------------------------------+
| [Status] (z:10)              [Stats Panel] (z:10)            |
| top:90px, left:20px          top:90px, right:20px             |
|                                                               |
| [View][Filter][Rotate][Admin]                                 |
| top:158px, left:20-200px                                      |
|                                                               |
|        +------------------------------------------+           |
|        |                                          |           |
|  LOGO  |        GLOBE / FLAT MAP (z:1)            |           |
| (z:10) |        Full viewport background          |           |
|  left  |                                          |           |
|  20px  |                                          |           |
|        +------------------------------------------+           |
|                                                               |
| [Event Log]                  [Top Countries]                  |
| bottom:20px, left:20px       bottom:20px, right:20px          |
| width:40vw, max-h:25vh       min-w:200, max-w:250px          |
+--------------------------------------------------------------+
```

### WARNING: No Flexbox/Grid for Dashboard Panels

The dashboard uses absolute positioning exclusively for HUD panels. Do NOT convert to flexbox or CSS grid. Absolute positioning allows panels to float independently over the globe/map without affecting each other's layout. Grid/flex would require a wrapper that blocks mouse interaction with the globe beneath.

## Z-Index Layering

| Z-Index | Elements | Purpose |
|---------|----------|---------|
| 1 | Globe container, flat map | Background visualization |
| 10 | All HUD panels, buttons, logo | Floating UI elements |
| 15 | Header bar | Always above everything |

All HUD elements share z-index 10. They don't overlap in practice because they're anchored to different corners. If overlap is needed, use z-index 11-14 (reserve 15 for the header).

## Panel Positioning Map

### Top-Left Zone (Status + Controls)

```css
/* Connection status */
#connection-status { top: 90px; left: 20px; }

/* Control buttons - horizontal row */
.view-toggle-btn    { top: 158px; left: 20px; }
.ocde-filter-btn    { top: 158px; left: 80px; }   /* 20 + 50 + 10 gap */
.rotate-toggle-btn  { top: 158px; left: 140px; }  /* 80 + 50 + 10 gap */
.admin-panel-btn    { top: 158px; left: 200px; }  /* 140 + 50 + 10 gap */
```

Button spacing formula: each button is 50px wide with 10px gaps. Next button left = previous left + 60px.

### Top-Right Zone (Metrics)

```css
/* Stats panel */
#stats-panel { top: 90px; right: 20px; }
```

### Bottom-Left Zone (Event Feed)

```css
#event-log {
  bottom: 20px;
  left: 20px;
  width: 40vw;
  max-width: 40vw;
  max-height: 25vh;
}
```

### Bottom-Right Zone (Rankings)

```css
#top-countries-panel {
  bottom: 20px;
  right: 20px;
  min-width: 200px;
  max-width: 250px;
}
```

### Center-Left Zone (Logo)

```css
#side-logo {
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  height: 480px;
}
```

## Header Bar

Full-width fixed header with blur backdrop:

```css
#header {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 80px;
  background: rgba(0, 0, 0, 0.85);
  border-bottom: 2px solid #00d9ff;
  z-index: 15;
  display: flex;                       /* Only flexbox usage in dashboard */
  align-items: center;
  justify-content: center;
  gap: 20px;
  backdrop-filter: blur(5px);
  box-shadow: 0 2px 20px rgba(0, 217, 255, 0.3);
}
```

The header is the ONE exception to "no flexbox" -- it centers the logo and title horizontally using `display: flex`.

## Admin Panel Layout

The admin page (`public/admin.html`) uses a different layout model: scrollable page with a centered container.

```css
body {
  padding: 20px;
  min-height: 100vh;      /* Scrollable, not overflow:hidden */
}

.container {
  max-width: 1400px;
  margin: 0 auto;
}
```

### Admin Grid: Stats Cards

```css
.stats-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}
```

Admin uses CSS grid for stat cards because it's a scrollable page, not an overlay layout.

### Collapsible Sections

Admin settings use manual toggle sections (no details/summary):

```css
.section-toggle {
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid #00d9ff;
  border-radius: 8px;
}

.section-content { display: none; }
.section-content.expanded { display: block; }
```

## Responsive Scaling

Three breakpoints for NOC display sizes in `public/css/dashboard.css`:

```css
/* Default: standard monitors */

/* Full HD NOC displays */
@media (min-width: 1920px) {
  #connection-status { font-size: 28px; padding: 15px 25px; }
  #event-header { font-size: 26px; }
  #events-container { font-size: 18px; }
  #event-log { width: 450px; font-size: 18px; }
}

/* 4K NOC displays */
@media (min-width: 3840px) {
  #connection-status { font-size: 36px; padding: 20px 35px; }
  #event-header { font-size: 30px; }
  #events-container { font-size: 20px; }
  #event-log { width: 600px; padding: 15px; font-size: 20px; }
  .event-item { margin: 6px 0; padding: 4px 6px; }
}
```

### WARNING: Missing Responsive Rules on Dynamic Panels

The JS-created panels (`stats-display.js`, `top-stats.js`) use inline styles and have NO responsive breakpoints. When adding new JS-created panels, either add responsive CSS classes to `dashboard.css` or use `window.matchMedia()` to adjust inline styles.

## Spatial Rules

1. **20px margin** from all viewport edges (consistent padding on every panel)
2. **10px gap** between adjacent buttons
3. **80px** header height clears all content below
4. **90px** top offset for first row of panels (80px header + 10px gap)
5. **Panels NEVER exceed 40% viewport width** for event log, 250px max for stat panels
6. **25vh maximum height** for scrollable panels to preserve globe visibility
7. **No panel should cover the globe center** -- keep panels at edges and corners
