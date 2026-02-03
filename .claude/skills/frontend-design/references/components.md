# Components Reference

## Contents
- Panel Components
- Button Components
- Status Indicators
- Data Display Components

## Panel Components

### Standard Stats Panel

```javascript
// stats-display.js - Create positioned overlay panel
const panel = document.createElement('div');
panel.style.cssText = `
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: #00ff00;
  font-family: 'Courier New', monospace;
  font-size: 16px;
  border: 2px solid #00ff00;
  padding: 12px 15px;
  min-width: 180px;
  z-index: 10;
  border-radius: 5px;
  box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
`;
```

### Scrollable Event Log

```css
/* dashboard.css - Event log with constrained dimensions */
#event-log {
  position: absolute;
  bottom: 20px;
  left: 20px;
  width: 40vw;
  max-width: 40vw;
  max-height: 25vh;
  background: rgba(0, 0, 0, 0.9);
  border: 2px solid #0f0;
  padding: 10px;
  z-index: 10;
  overflow-y: auto;
  backdrop-filter: blur(5px);
}
```

### Panel with Color-Coded Border

```javascript
// top-stats.js - Orange-themed panel
panel.style.cssText = `
  position: absolute;
  bottom: 20px;
  right: 220px;
  background: rgba(0, 0, 0, 0.8);
  color: #ff8c00;
  font-family: 'Courier New', monospace;
  border: 2px solid #ff8c00;
  padding: 10px 12px;
  min-width: 200px;
  z-index: 10;
  box-shadow: 0 0 20px rgba(255, 140, 0, 0.3);
`;
```

## Button Components

### Icon-Only Action Button

```css
/* dashboard.css - Square icon button */
.view-toggle-btn {
  position: absolute;
  top: 150px;
  left: 20px;
  width: 50px;
  height: 50px;
  padding: 0;
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid #00d9ff;
  color: #00d9ff;
  cursor: pointer;
  z-index: 10;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.view-toggle-btn:hover {
  background: rgba(0, 217, 255, 0.2);
  box-shadow: 0 0 15px rgba(0, 217, 255, 0.6);
  transform: scale(1.1);
}

.view-toggle-btn:active {
  transform: scale(0.95);
}
```

### Toggle Button with Active State

```css
/* Active state with glow animation */
.rotate-toggle-btn.active {
  background: rgba(0, 255, 0, 0.3);
  border-color: #00ff00;
  color: #00ff00;
  box-shadow: 0 0 20px rgba(0, 255, 0, 0.8);
  animation: rotate-pulse 2s infinite;
}

@keyframes rotate-pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 0, 0.8); }
  50% { box-shadow: 0 0 30px rgba(0, 255, 0, 1); }
}
```

### Button Variant Colors

| Variant | Border | Text | Hover BG |
|---------|--------|------|----------|
| Cyan (view) | `#00d9ff` | `#00d9ff` | `rgba(0, 217, 255, 0.2)` |
| Orange (filter) | `#ff8c00` | `#ff8c00` | `rgba(255, 140, 0, 0.2)` |
| Green (rotate) | `#00ff00` | `#00ff00` | `rgba(0, 255, 0, 0.2)` |
| Red (logout) | `#ff4444` | `#ffffff` | `#ff6666` |

## Status Indicators

### Connection Status Badge

```css
#connection-status {
  position: absolute;
  top: 90px;
  left: 20px;
  padding: 10px 20px;
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid #0f0;
  font-size: 20px;
  font-weight: bold;
  letter-spacing: 1px;
  z-index: 10;
  transition: all 0.3s ease;
}

/* State variations */
#connection-status.connected {
  color: #0f0;
  border-color: #0f0;
  box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
}

#connection-status.disconnected {
  color: #f00;
  border-color: #f00;
  box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
  animation: blink 1s infinite;
}
```

## Data Display Components

### Progress Bar (Inline)

```javascript
// top-stats.js - Horizontal bar chart
const barWidth = Math.max(5, (count / maxCount) * 100);

return `
  <div style="margin: 4px 0;">
    <div style="display: flex; justify-content: space-between;">
      <span style="font-weight: bold; color: #00ffff;">${label}</span>
      <span style="color: #ffa500;">${count}</span>
    </div>
    <div style="background: rgba(255, 140, 0, 0.2); height: 4px; margin-top: 2px;">
      <div style="background: #ff8c00; height: 100%; width: ${barWidth}%;"></div>
    </div>
  </div>
`;
```

### Custom Scrollbar

```css
#events-container::-webkit-scrollbar {
  width: 8px;
}

#events-container::-webkit-scrollbar-track {
  background: rgba(0, 255, 0, 0.1);
}

#events-container::-webkit-scrollbar-thumb {
  background: rgba(0, 255, 0, 0.3);
  border-radius: 4px;
}

#events-container::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 255, 0, 0.5);
}