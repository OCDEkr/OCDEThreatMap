# Components Reference

## Contents
- HUD Overlay Panels
- Icon Buttons
- Connection Status Indicator
- Stats Panels
- Top Countries Panel
- Event Log
- Form Controls
- Feedback Messages

## HUD Overlay Panels

All dashboard panels float above the globe/map using absolute positioning. They share a consistent visual treatment:

```css
/* Base panel pattern (from stats-display.js and top-stats.js) */
.hud-panel {
  position: absolute;
  background: rgba(0, 0, 0, 0.8);
  font-family: 'Courier New', monospace;
  border: 2px solid;                    /* Color varies by panel role */
  padding: 10px 12px;
  z-index: 10;
  border-radius: 5px;
  box-shadow: 0 0 20px;                /* Color matches border */
}
```

Panel border colors by role:
- **Green** (`#00ff00`) -- data panels (stats, APM)
- **Cyan** (`#00d9ff`) -- informational panels (event log header)
- **Orange** (`#ff8c00`) -- filtered/highlighted panels (top countries)
- **Red** (`#ff0000`) -- alert panels (top attacks)

### WARNING: Panel Opacity Below 0.7

NEVER set panel background opacity below 0.7. At lower values, globe textures and arc animations bleed through, making text unreadable. The standard is `rgba(0, 0, 0, 0.8)`.

## Icon Buttons

Dashboard control buttons use a 50x50px square format with emoji icons. Defined in `public/css/dashboard.css`:

```css
/* Button base (view-toggle-btn, ocde-filter-btn, rotate-toggle-btn, admin-panel-btn) */
.control-btn {
  width: 50px;
  height: 50px;
  padding: 0;
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid;                   /* Color sets button identity */
  cursor: pointer;
  z-index: 10;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;                     /* Emoji icon size */
}
```

Button color assignments:
- **Cyan** (`#00d9ff`) -- view toggle, admin panel (navigation actions)
- **Orange** (`#ff8c00`) -- OCDE filter (filtering action)
- **Green** (`#00ff00`) -- rotation toggle (state toggle)

### Active State Pattern

Toggle buttons use an `.active` class with intensified glow:

```css
/* From .ocde-filter-btn.active and .rotate-toggle-btn.active */
.control-btn.active {
  background: rgba(COLOR, 0.3);        /* Tinted background */
  box-shadow: 0 0 20px rgba(COLOR, 0.8);
}
```

### Hover/Active Interaction

```css
.control-btn:hover {
  background: rgba(COLOR, 0.2);
  box-shadow: 0 0 15px rgba(COLOR, 0.6);
  transform: scale(1.1);               /* Enlarge on hover */
}

.control-btn:active {
  transform: scale(0.95);              /* Press-down feedback */
}
```

## Connection Status Indicator

Positioned top-left below the header. Three states with color-coded borders and glow. Defined in `public/css/dashboard.css`:

```css
#connection-status {
  position: absolute;
  top: 90px;
  left: 20px;
  padding: 10px 20px;
  background: rgba(0, 0, 0, 0.8);
  font-size: 20px;
  font-weight: bold;
  letter-spacing: 1px;
  z-index: 10;
  transition: all 0.3s ease;
}
```

State classes use both `color` and `border-color` together -- NEVER set one without the other:

```css
.connected    { color: #0f0; border-color: #0f0; box-shadow: 0 0 10px rgba(0, 255, 0, 0.5); }
.connecting   { color: #ff0; border-color: #ff0; box-shadow: 0 0 10px rgba(255, 255, 0, 0.5); }
.disconnected { color: #f00; border-color: #f00; box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
                animation: blink 1s infinite; }
```

## Stats Panel

Created dynamically by `public/js/stats-display.js`. Positioned top-right via inline styles:

```javascript
// From stats-display.js - panel creation pattern
statsPanel.style.cssText = `
  position: absolute;
  top: 90px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: #00ff00;
  font-family: 'Courier New', monospace;
  border: 2px solid #00ff00;
  padding: 12px 15px;
  min-width: 180px;
  z-index: 10;
  border-radius: 5px;
  box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
`;
```

Internal hierarchy: large count (28px bold) > label (14px) > APM (18px) > timestamp (11px).

## Top Countries Panel

Created by `public/js/top-stats.js`. Uses orange theme for country data:

```javascript
// From top-stats.js - orange border/text for country data
countriesPanel.style.cssText = `
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: #ff8c00;
  font-family: 'Courier New', monospace;
  border: 2px solid #ff8c00;
  padding: 10px 12px;
  min-width: 200px;
  max-width: 250px;
  z-index: 10;
  border-radius: 5px;
  box-shadow: 0 0 20px rgba(255, 140, 0, 0.3);
`;
```

Country entries use per-country colors from `window.getCountryColorHex()` with progress bars:

```html
<div style="display: flex; justify-content: space-between;">
  <span style="font-weight: bold; color: ${textColor}; text-shadow: 0 0 8px ${textColor};">
    1. China
  </span>
  <span style="color: ${textColor};">1234</span>
</div>
<div style="background: rgba(R, G, B, 0.2); height: 4px;">
  <div style="background: ${textColor}; height: 100%; width: ${barWidth}%;"></div>
</div>
```

## Event Log

Fixed-position bottom-left overlay defined in `public/css/dashboard.css`:

```css
#event-log {
  position: absolute;
  bottom: 20px;
  left: 20px;
  width: 40vw;
  max-height: 25vh;
  background: rgba(0, 0, 0, 0.9);     /* Slightly more opaque for readability */
  border: 2px solid #00d9ff;
  padding: 10px;
  z-index: 10;
  overflow-y: auto;
  backdrop-filter: blur(5px);
}
```

New events animate with `pulse` keyframes and a cyan left border accent:

```css
.event-item.new {
  animation: pulse 0.5s;
  background: rgba(0, 217, 255, 0.15);
  border-left: 3px solid #00d9ff;
}
```

## Form Controls (Admin Panel)

Admin forms in `public/admin.html` use inline styles. Input pattern:

```css
input[type="text"], input[type="password"] {
  width: 100%;
  max-width: 300px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid #00d9ff;
  border-radius: 4px;
  color: #00ff00;
  font-family: 'Courier New', monospace;
}

input:focus {
  outline: none;
  border-color: #00ff00;
  box-shadow: 0 0 10px rgba(0, 255, 0, 0.3);
}
```

## Feedback Messages

Success/error messages use color-coded borders with tinted backgrounds:

```css
.message.success {
  background: rgba(0, 255, 0, 0.1);
  border: 1px solid #00ff00;
  color: #00ff00;
}

.message.error {
  background: rgba(255, 68, 68, 0.1);
  border: 1px solid #ff4444;
  color: #ff4444;
}
```

### New Component Checklist

Copy this checklist when adding a new dashboard component:
- [ ] Background: `rgba(0, 0, 0, 0.8)` (or 0.9 for text-heavy)
- [ ] Font: `'Courier New', monospace`
- [ ] Border: `2px solid` with role-appropriate color
- [ ] Glow: `box-shadow` matching border color at 0.3 opacity
- [ ] z-index: 10 (same layer as other HUD elements)
- [ ] Position: absolute with explicit top/bottom + left/right
- [ ] Responsive: media queries for 1920px and 3840px breakpoints
