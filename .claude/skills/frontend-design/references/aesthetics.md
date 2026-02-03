# Aesthetics Reference

## Contents
- Color System
- Typography
- Glow and Shadow Effects
- Visual Hierarchy

## Color System

### Primary Palette

```css
/* NOC-optimized dark theme */
--bg-primary: #000000;           /* Pure black background */
--bg-overlay: rgba(0, 0, 0, 0.8); /* 80% opacity panels */
--bg-overlay-heavy: rgba(0, 0, 0, 0.9); /* 90% for event logs */

/* Terminal green - primary status color */
--text-primary: #0f0;            /* Shorthand green */
--text-primary-full: #00ff00;    /* Full hex green */
--text-secondary: #00cc00;       /* Muted green for labels */
--text-tertiary: #00aa00;        /* Dim green for timestamps */

/* Cyan accent - headers and interactive elements */
--accent-cyan: #00d9ff;
--accent-cyan-focus: #00ffaa;    /* Focus/hover state */
```

### Threat Type Colors

```javascript
// arcs.js - Consistent across arc visualization and stats panels
const THREAT_COLORS = {
  malware: '#ff0000',      // Red - highest severity
  intrusion: '#ff8c00',    // Dark orange - unauthorized access
  ddos: '#8a2be2',         // Purple - volumetric attacks
  deny: '#ffa500'          // Orange - firewall denials (default)
};
```

### Connection Status Colors

```css
/* Semantic status colors */
.connected    { color: #0f0; border-color: #0f0; }  /* Green - healthy */
.connecting   { color: #ff0; border-color: #ff0; }  /* Yellow - pending */
.disconnected { color: #f00; border-color: #f00; }  /* Red - error */
```

## Typography

### Font Stack

```css
/* Terminal monospace - NOC readability */
font-family: 'Courier New', monospace;
```

**WARNING: Never use sans-serif fonts**

This dashboard uses monospace exclusively. Sans-serif fonts (Segoe UI, Arial) break the terminal aesthetic and reduce readability on NOC displays.

```css
/* BAD - breaks visual consistency */
font-family: 'Segoe UI', Tahoma, sans-serif;

/* GOOD - maintains terminal aesthetic */
font-family: 'Courier New', monospace;
```

### Size Scale (NOC Optimized)

| Element | Size | Use Case |
|---------|------|----------|
| Header Title | 36px | Main dashboard title |
| Attack Counter | 28px | Large metrics visible at distance |
| Connection Status | 20px | Status readable from 15+ feet |
| Panel Headers | 16px | Section titles |
| Panel Content | 14px | Statistics, lists |
| Event Log | 12px | Compact log entries |
| Timestamps | 11px | Secondary metadata |

### Media Query Scaling

```css
/* HD displays (1920px+) */
@media (min-width: 1920px) {
  #connection-status { font-size: 28px; }
  #event-header { font-size: 18px; }
  #events-container { font-size: 14px; }
}

/* 4K displays (3840px+) */
@media (min-width: 3840px) {
  #connection-status { font-size: 36px; }
  #event-header { font-size: 20px; }
  #events-container { font-size: 16px; }
}
```

## Glow and Shadow Effects

### Text Glow

```css
/* Primary text glow */
text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);

/* Header title glow (stronger) */
text-shadow: 0 0 20px rgba(0, 217, 255, 0.8);
```

### Box Glow

```css
/* Standard panel glow */
box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);

/* Cyan accent panels (header) */
box-shadow: 0 2px 20px rgba(0, 217, 255, 0.3);

/* Active state glow (stronger) */
box-shadow: 0 0 20px rgba(0, 255, 0, 0.8);
```

### Logo Drop Shadow

```css
#header-logo {
  filter: drop-shadow(0 0 10px rgba(0, 217, 255, 0.5));
}
```

## Visual Hierarchy

### Z-Index Layering

| Layer | Z-Index | Elements |
|-------|---------|----------|
| Globe/Map | 1 | #globe, #flat-map |
| UI Panels | 10 | Stats, event log, buttons |
| Header | 15 | Top header bar |
| Modals | 20+ | Reserved for overlays |

### DO/DON'T: Color Application

```css
/* DO - Use semantic colors consistently */
.panel-green { border-color: #00ff00; color: #00ff00; }
.panel-orange { border-color: #ff8c00; color: #ff8c00; }
.panel-red { border-color: #ff0000; color: #ff0000; }

/* DON'T - Mix incompatible colors */
.panel-mixed { border-color: #00ff00; color: #ff8c00; } /* Clashing */