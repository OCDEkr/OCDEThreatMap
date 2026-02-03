---
name: frontend-design
description: |
  Applies NOC-optimized dark theme styling and dashboard layout design for real-time threat visualization.
  Use when: Creating/modifying dashboard UI, adding visualization panels, styling control buttons, or building NOC display components.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Frontend Design Skill

NOC-optimized design system for the OCDE Cyber Threat Map. Dark background (#000000), green terminal aesthetics (#0f0), cyan accents (#00d9ff), and threat-type color coding. Designed for readability at 20+ feet on wall displays.

## Quick Start

### Panel Styling Pattern

```css
#my-panel {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: #00ff00;
  font-family: 'Courier New', monospace;
  border: 2px solid #00ff00;
  padding: 12px 15px;
  z-index: 10;
  box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
}
```

### Icon Button Pattern

```css
.action-btn {
  width: 50px;
  height: 50px;
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid #00d9ff;
  color: #00d9ff;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-btn:hover {
  background: rgba(0, 217, 255, 0.2);
  box-shadow: 0 0 15px rgba(0, 217, 255, 0.6);
  transform: scale(1.1);
}
```

## Key Concepts

| Concept | Value | Usage |
|---------|-------|-------|
| Background | `#000000` | Pure black for NOC contrast |
| Primary Text | `#0f0` / `#00ff00` | Terminal green for status |
| Accent | `#00d9ff` | Cyan for headers, borders |
| Overlay BG | `rgba(0, 0, 0, 0.8)` | 80% opacity panels |
| Font | `'Courier New', monospace` | Terminal aesthetic |

## Threat Type Colors

| Threat | Color | Hex |
|--------|-------|-----|
| Malware | Red | `#ff0000` |
| Intrusion | Dark Orange | `#ff8c00` |
| DDoS | Purple | `#8a2be2` |
| Deny (default) | Orange | `#ffa500` |

## Common Patterns

### Glow Effects

```css
text-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
```

### State Classes

```css
.connected { color: #0f0; border-color: #0f0; }
.connecting { color: #ff0; border-color: #ff0; }
.disconnected { color: #f00; border-color: #f00; animation: blink 1s infinite; }
```

## See Also

- [aesthetics](references/aesthetics.md) - Color system, typography, glow effects
- [components](references/components.md) - Panel, button, status indicator patterns
- [layouts](references/layouts.md) - Dashboard positioning, z-index layering
- [motion](references/motion.md) - Arc animations, pulse effects, transitions
- [patterns](references/patterns.md) - DO/DON'T pairs, anti-patterns

## Related Skills

- See the **globe-gl** skill for 3D visualization configuration
- See the **three-js** skill for custom arc rendering
- See the **d3** skill for flat map alternative view