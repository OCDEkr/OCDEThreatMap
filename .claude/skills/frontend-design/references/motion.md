# Motion Reference

## Contents
- Arc Animations
- Pulse and Glow Effects
- State Transitions
- Performance Considerations

## Arc Animations

### Arc Configuration Constants

```javascript
// custom-arcs.js - Animation timing
const ARC_ANIMATION_DURATION = 3000;  // 3 seconds travel time
const VISIBLE_SEGMENT_RATIO = 0.5;    // 50% of arc visible
const ARC_SEGMENTS = 128;             // Curve smoothness

// Flash effect before arc starts
const COUNTRY_FLASH_DURATION = 500;   // 500ms pulse at source
const COUNTRY_FLASH_DELAY = 300;      // Delay before arc begins
```

### Three-Phase Arc Animation

```javascript
// Phase 1: Country Flash (0-500ms)
if (elapsed < flashDuration) {
  const flashProgress = elapsed / flashDuration;
  const pulse = Math.sin(flashProgress * Math.PI * 4);  // 4 pulses
  const scale = 1 + pulse * 0.5;                        // 0.5x to 1.5x
  const opacity = 0.9 - (flashProgress * 0.3);          // Fade from 0.9 to 0.6
  
  countryFlash.scale.set(scale, scale, scale);
  flashMaterial.opacity = opacity;
}

// Phase 2: Arc Delay (500-800ms) - fade out flash
if (elapsed >= flashDuration && elapsed < flashDuration + arcDelay) {
  const fadeProgress = (elapsed - flashDuration) / arcDelay;
  flashMaterial.opacity = 0.6 * (1 - fadeProgress);
  arcLine.visible = true;
  arrowHead.visible = true;
}

// Phase 3: Arc Travel (800-3800ms)
const progress = Math.min(arcElapsed / duration, 1);
const segmentStart = Math.max(0, progress - VISIBLE_SEGMENT_RATIO);
const segmentEnd = progress;
geometry.setDrawRange(drawStart, drawCount);
```

### Arc Material Configuration

```javascript
// Fully opaque for NOC visibility
const material = new THREE.MeshBasicMaterial({
  color: THREAT_COLORS[threatType],
  transparent: true,
  opacity: 1.0  // Full opacity during travel
});
```

## Pulse and Glow Effects

### Stats Counter Pulse

```css
/* stats-display.js - Injected keyframes */
@keyframes pulse {
  0% {
    opacity: 1;
    text-shadow: 0 0 10px #00ff00;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    text-shadow: 0 0 20px #00ff00;
    transform: scale(1.05);
  }
  100% {
    opacity: 1;
    text-shadow: 0 0 10px #00ff00;
    transform: scale(1);
  }
}
```

### Triggering Pulse on Update

```javascript
// stats-display.js - Re-trigger animation on each update
totalElement.style.animation = 'none';
setTimeout(() => {
  totalElement.style.animation = 'pulse 0.3s';
}, 10);  // Small delay forces animation restart
```

### Button Active State Glow

```css
@keyframes rotate-pulse {
  0%, 100% {
    box-shadow: 0 0 20px rgba(0, 255, 0, 0.8);
  }
  50% {
    box-shadow: 0 0 30px rgba(0, 255, 0, 1);
  }
}

.rotate-toggle-btn.active {
  animation: rotate-pulse 2s infinite;
}
```

### Disconnected Status Blink

```css
@keyframes blink {
  50% { opacity: 0.5; }
}

#connection-status.disconnected {
  animation: blink 1s infinite;
}
```

## State Transitions

### Button Hover/Active States

```css
.action-btn {
  transition: all 0.3s ease;  /* Smooth property transitions */
}

.action-btn:hover {
  background: rgba(0, 217, 255, 0.2);
  box-shadow: 0 0 15px rgba(0, 217, 255, 0.6);
  transform: scale(1.1);      /* Slight enlargement */
}

.action-btn:active {
  transform: scale(0.95);     /* Press feedback */
}
```

### Event Item Entry Animation

```css
.event-item.new {
  animation: pulse 0.5s;
  background: rgba(255, 165, 0, 0.2);
  border-left: 3px solid #ffa500;
}

@keyframes pulse {
  0% {
    opacity: 1;
    background: rgba(255, 165, 0, 0.3);
    transform: translateX(0);
  }
  50% {
    transform: translateX(3px);  /* Subtle slide-in */
  }
  100% {
    opacity: 0.9;
    background: transparent;
    transform: translateX(0);
  }
}
```

### Connection Status Transitions

```css
#connection-status {
  transition: all 0.3s ease;  /* Smooth color/border changes */
}
```

## Performance Considerations

### requestAnimationFrame for Arc Animation

```javascript
// custom-arcs.js - Proper animation loop
function animateArcs() {
  // Update all arcs
  animatingArcs.forEach(arcAnim => { /* ... */ });
  
  // Continue loop only if arcs exist
  if (animatingArcs.length > 0) {
    animationFrameId = requestAnimationFrame(animateArcs);
  } else {
    animationFrameId = null;  // Stop when no arcs
  }
}
```

### Memory Cleanup on Arc Completion

```javascript
// Dispose Three.js objects to prevent memory leaks
arcAnim.geometry.dispose();
arcAnim.material.dispose();
arcAnim.arrowMaterial.dispose();
arcAnim.countryFlash.geometry.dispose();
arcAnim.flashMaterial.dispose();

// Remove from scene
scene.remove(arcAnim.line);
scene.remove(arcAnim.arrowHead);
```

### Globe Rotation Animation

```javascript
// 360° in 30 seconds at 60fps = 0.2° per frame
const rotationSpeed = 0.2;

function animate() {
  if (!isRotating) return;
  
  const currentView = globeInstance.pointOfView();
  const newLng = (currentView.lng + rotationSpeed) % 360;
  
  globeInstance.pointOfView({
    lat: currentView.lat,
    lng: newLng,
    altitude: currentView.altitude
  }, 0);  // No transition delay for smooth rotation
  
  rotationAnimationId = requestAnimationFrame(animate);
}