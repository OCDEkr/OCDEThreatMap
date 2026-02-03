# Layouts Reference

## Contents
- Dashboard Layout Structure
- Panel Positioning System
- Responsive Breakpoints
- Z-Index Management

## Dashboard Layout Structure

### Full-Screen Visualization Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER (z:15) - Logo + Title, centered, 80px height             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Status]   [Btn][Btn][Btn]                    [Top Stats Panels] │
│  (top-left) (150px down)                       (bottom-right)   │
│                                                                 │
│                     GLOBE (z:1)                                 │
│                   Full viewport                                 │
│                                                                 │
│  [Event Log]                            [Stats] [Countries]     │
│  (bottom-left, 40vw)                    (bottom-right, stacked) │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Header Bar

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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  backdrop-filter: blur(5px);
  box-shadow: 0 2px 20px rgba(0, 217, 255, 0.3);
}
```

### Globe Container (Background Layer)

```css
#globe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  background: #000000;
}
```

## Panel Positioning System

### Bottom-Right Stack (Stats Panels)

```javascript
// Panels stack from right edge, moving left
// Each panel offset by previous panel width + gap

// Stats panel (rightmost)
right: 20px;
min-width: 180px;

// Top Countries panel (middle)
right: 220px;  // 20px + 180px + 20px gap
min-width: 200px;

// Top Attacks panel (leftmost)
right: 480px;  // 220px + 200px + 60px gap
min-width: 200px;
```

### Top-Left Control Buttons

```css
/* Horizontal button row */
.view-toggle-btn    { top: 150px; left: 20px; }   /* First */
.ocde-filter-btn    { top: 150px; left: 80px; }   /* Second (20 + 50 + 10) */
.rotate-toggle-btn  { top: 150px; left: 140px; }  /* Third (80 + 50 + 10) */
```

### Event Log (Bottom-Left)

```css
#event-log {
  position: absolute;
  bottom: 20px;
  left: 20px;
  width: 40vw;       /* 40% viewport width */
  max-width: 40vw;   /* Never exceed 40% */
  max-height: 25vh;  /* Never exceed 25% viewport height */
}
```

## Responsive Breakpoints

### HD Displays (1920px+)

```css
@media (min-width: 1920px) {
  #connection-status {
    font-size: 28px;
    padding: 15px 25px;
  }
  
  #event-log {
    width: 450px;  /* Fixed width on large screens */
  }
  
  #event-header { font-size: 18px; }
  #events-container { font-size: 14px; }
}
```

### 4K Displays (3840px+)

```css
@media (min-width: 3840px) {
  #connection-status {
    font-size: 36px;
    padding: 20px 35px;
  }
  
  #event-log {
    width: 600px;
    padding: 15px;
  }
  
  #event-header { font-size: 20px; }
  #events-container { font-size: 16px; }
  
  .event-item {
    margin: 6px 0;
    padding: 4px 6px;
  }
}
```

## Z-Index Management

### Layer Stack

| Z-Index | Layer | Elements |
|---------|-------|----------|
| 1 | Background | `#globe`, `#flat-map` |
| 10 | UI Controls | Buttons, panels, status badges |
| 15 | Header | `#header` (always above UI) |
| 20+ | Reserved | Future modals, tooltips |

### WARNING: Z-Index Conflicts

```css
/* BAD - Panel hidden behind globe */
#my-panel { z-index: 1; }  /* Same as globe */

/* GOOD - Panel visible above globe */
#my-panel { z-index: 10; }
```

### Fullscreen Element Pattern

```css
/* Elements that fill viewport */
.fullscreen-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
```

### Preventing Body Scroll

```css
body {
  overflow: hidden;  /* No scrollbars on NOC display */
  height: 100vh;
}