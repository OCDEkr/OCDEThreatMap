# Motion Reference

## Contents
- Animation Technology Stack
- Arc Animation (3D Globe)
- Arc Animation (2D Flat Map)
- Country Flash Effect
- UI Micro-interactions
- Keyframe Definitions
- Performance Guidelines

## Animation Technology Stack

Three distinct animation systems, each tied to a view mode:

| System | Technology | Files | Used When |
|--------|-----------|-------|-----------|
| 3D Arcs | Three.js `requestAnimationFrame` | `public/js/custom-arcs.js` | Globe view active |
| 2D Arcs | D3.js transitions + `requestAnimationFrame` | `public/js/flat-map-d3.js` | Flat map view active |
| UI Effects | CSS `@keyframes` + `transition` | `public/css/dashboard.css` | Always |

See the **three-js** skill for 3D geometry details. See the **d3** skill for SVG animation details.

## Arc Animation (3D Globe)

Three-phase animation per attack in `public/js/custom-arcs.js`:

### Phase 1: Country Flash (0-400ms)

Source country gets a pulsing sphere on the globe surface:

```javascript
// From custom-arcs.js - flash parameters
const COUNTRY_FLASH_DURATION = 400;
// Pulsing effect via sine wave (4 pulses during flash)
const pulse = Math.sin(flashProgress * Math.PI * 4);
const scale = 1 + pulse * 0.5;   // Scale between 0.5x and 1.5x
const opacity = 0.9 - (flashProgress * 0.3);  // Fade 0.9 -> 0.6
```

### Phase 2: Flash Fade + Arc Reveal (400-600ms)

Flash fades out while arc becomes visible:

```javascript
const COUNTRY_FLASH_DELAY = 200;
// Flash fades from 0.6 to 0 opacity
// Arc and arrow become visible
arcAnim.line.visible = true;
arcAnim.arrowHead.visible = true;
```

### Phase 3: Traveling Arc (600-2600ms)

Arc tube travels from source to OCDE with arrow head:

```javascript
const ARC_ANIMATION_DURATION = 2000;
const VISIBLE_SEGMENT_RATIO = 0.5;  // 50% of arc visible at once

// Draw range slides along TubeGeometry
const segmentStart = Math.max(0, progress - VISIBLE_SEGMENT_RATIO);
const segmentEnd = progress;
arcAnim.geometry.setDrawRange(drawStart, drawCount);

// Arrow head follows and orients to curve tangent
arcAnim.arrowHead.position.copy(arcAnim.curve.getPoint(progress));
arcAnim.arrowHead.quaternion.setFromUnitVectors(
  new THREE.Vector3(0, 1, 0),
  arcAnim.curve.getTangent(progress).normalize()
);
```

### Phase 4: Fade Out (2600-3100ms)

Arc and arrow fade to transparent over 500ms:

```javascript
const fadeProgress = Math.min((arcElapsed - arcAnim.duration) / 500, 1);
arcAnim.material.opacity = (1 - fadeProgress) * 0.9;
```

## Arc Animation (2D Flat Map)

Similar three-phase animation in `public/js/flat-map-d3.js` using SVG:

### Phase 1: Source Flash (0-500ms)

```javascript
// D3 circle at source coordinates - pulsing radius
flash.transition()
  .duration(125).attr('r', 10).attr('opacity', 0.7)
  .transition()
  .duration(125).attr('r', 7).attr('opacity', 0.9)
  .transition()
  .duration(125).attr('r', 12).attr('opacity', 0.6)
  .transition()
  .duration(125).attr('r', 8).attr('opacity', 0.5);
```

### Phase 2: Traveling Arc (800-3300ms)

```javascript
const arcDuration = 2500;
const tailLength = 0.35;  // Trail is 35% of path length

// Path built from sampled points along quadratic bezier
// Arrow polygon follows head position and rotates to tangent
const angle = Math.atan2(
  nextPoint.y - headPoint.y,
  nextPoint.x - headPoint.x
) * 180 / Math.PI + 90;
arrow.attr('transform',
  `translate(${headPoint.x},${headPoint.y}) rotate(${angle})`);
```

### Phase 3: Impact + Fade (3300-4000ms)

```javascript
// Expanding circle at destination
impact.transition()
  .duration(300).attr('r', 15).attr('opacity', 0.6)
  .transition()
  .duration(400).attr('r', 25).attr('opacity', 0).remove();
```

## Country Flash Effect

The flash at source location serves a critical NOC purpose: it draws attention to WHERE the attack originates before the arc begins traveling. Without it, fast-moving arcs are hard to trace back to their source.

**Color:** Matches the country's assigned color from `COUNTRY_COLORS` map.

## UI Micro-interactions

### Button Hover (CSS transitions)

```css
/* All buttons use the same transition timing */
transition: all 0.3s ease;

/* Hover: enlarge + glow */
:hover {
  transform: scale(1.1);
  box-shadow: 0 0 15px rgba(COLOR, 0.6);
}

/* Click: press down */
:active {
  transform: scale(0.95);
}
```

### New Event Item (CSS animation)

```css
/* From dashboard.css - new event slides in with cyan highlight */
@keyframes pulse {
  0% {
    opacity: 1;
    background: rgba(0, 217, 255, 0.25);
    transform: translateX(0);
  }
  50% { transform: translateX(3px); }
  100% {
    opacity: 0.9;
    background: transparent;
    transform: translateX(0);
  }
}

.event-item.new {
  animation: pulse 0.5s;
  border-left: 3px solid #00d9ff;
}
```

### Stats Counter Pulse

```css
/* From stats-display.js - count updates flash brighter */
@keyframes pulse {
  0%   { text-shadow: 0 0 10px #00ff00; transform: scale(1); }
  50%  { text-shadow: 0 0 20px #00ff00; transform: scale(1.05); }
  100% { text-shadow: 0 0 10px #00ff00; transform: scale(1); }
}
```

### Rotation Active Pulse

```css
/* From dashboard.css - pulsing glow when globe rotation is active */
@keyframes rotate-pulse {
  0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 0, 0.8); }
  50%      { box-shadow: 0 0 30px rgba(0, 255, 0, 1); }
}
```

## Keyframe Definitions

All keyframes in the project:

| Name | Duration | Location | Purpose |
|------|----------|----------|---------|
| `blink` | 1s infinite | `dashboard.css` | Disconnected status flashing |
| `pulse` | 0.5s once | `dashboard.css` | New event item entrance |
| `pulse` | 0.3s once | `stats-display.js` | Counter update flash |
| `rotate-pulse` | 2s infinite | `dashboard.css` | Active rotation indicator |

### WARNING: Duplicate `pulse` Keyframe Name

Both `dashboard.css` and `stats-display.js` define `@keyframes pulse` with different animations. The JS-injected version wins for elements targeted by `stats-display.js`. Rename one if adding new pulse animations to avoid conflicts.

## Performance Guidelines

### 3D Arc Limits (from `custom-arcs.js`)

```javascript
const MAX_ARCS = 150;                    // Hard cap on concurrent arcs
const HIGH_VOLUME_THRESHOLD = 100;       // Arcs/sec before sampling
const SAMPLE_RATE_HIGH_VOLUME = 10;      // Show 1 in 10 when over threshold
const ARC_SEGMENTS = 64;                 // Tube geometry segments
const ARC_RADIAL_SEGMENTS = 6;           // Tube cross-section segments
```

### Animation Performance Checklist

Copy this checklist when adding animations:
- [ ] Use `requestAnimationFrame` (NEVER `setInterval`) for render loops
- [ ] Dispose Three.js geometries and materials when arc completes
- [ ] Cancel animation frame when no arcs are active
- [ ] Set hard cap on concurrent animated elements
- [ ] Use `transition` for simple state changes (hover, active)
- [ ] Use `@keyframes` only for repeating or complex multi-step animations
- [ ] Test at 100+ arcs/second with `test/send-random-attacks.js`
