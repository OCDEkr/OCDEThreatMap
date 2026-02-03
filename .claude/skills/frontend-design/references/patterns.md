# Patterns Reference

## Contents
- DO/DON'T Design Patterns
- Common Anti-Patterns
- Browser IIFE Pattern
- Dynamic Panel Creation

## DO/DON'T Design Patterns

### Color Application

```css
/* DO - Match border and text color */
.panel-success {
  border: 2px solid #00ff00;
  color: #00ff00;
  box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
}

/* DON'T - Mix incompatible colors */
.panel-confused {
  border: 2px solid #00ff00;
  color: #ff8c00;  /* Clashing with border */
  box-shadow: 0 0 20px rgba(255, 0, 0, 0.3);  /* Third color! */
}
```

### Transparency Usage

```css
/* DO - Consistent overlay opacity */
.overlay-panel {
  background: rgba(0, 0, 0, 0.8);  /* 80% standard */
}

.overlay-panel-dark {
  background: rgba(0, 0, 0, 0.9);  /* 90% for text-heavy areas */
}

/* DON'T - Inconsistent opacity values */
.panel-1 { background: rgba(0, 0, 0, 0.75); }
.panel-2 { background: rgba(0, 0, 0, 0.82); }
.panel-3 { background: rgba(0, 0, 0, 0.78); }
```

### Font Sizing

```css
/* DO - Use the established scale */
.metric-large  { font-size: 28px; }  /* Primary metrics */
.metric-medium { font-size: 18px; }  /* Secondary metrics */
.metric-small  { font-size: 12px; }  /* Log entries */

/* DON'T - Arbitrary sizes */
.metric-random { font-size: 23px; }  /* Not in scale */
```

## WARNING: Common Anti-Patterns

### Anti-Pattern: Sans-Serif Fonts

**The Problem:**

```css
/* BAD - Breaks terminal aesthetic */
body {
  font-family: 'Segoe UI', Tahoma, sans-serif;
}
```

**Why This Breaks:**
1. Destroys NOC/terminal visual identity
2. Inconsistent with all other dashboard elements
3. Sans-serif reads worse at distance on dark backgrounds

**The Fix:**

```css
/* GOOD - Consistent monospace */
body {
  font-family: 'Courier New', monospace;
}
```

### Anti-Pattern: Inline CSS Without Pattern

**The Problem:**

```javascript
// BAD - Inconsistent styling, hard to maintain
element.style.cssText = `
  background: rgba(0, 0, 0, 0.75);  /* Different opacity */
  color: #00ee00;                    /* Different green */
  border: 1px solid #00ff00;         /* Different border width */
`;
```

**Why This Breaks:**
1. Creates visual inconsistencies
2. Duplicates values that should be centralized
3. Makes theme updates impossible

**The Fix:**

```javascript
// GOOD - Use established patterns
element.style.cssText = `
  background: rgba(0, 0, 0, 0.8);   /* Standard overlay */
  color: #00ff00;                    /* Standard green */
  border: 2px solid #00ff00;         /* Standard border */
`;
```

### Anti-Pattern: Z-Index Wars

**The Problem:**

```css
/* BAD - Escalating z-index values */
.modal { z-index: 9999; }
.tooltip { z-index: 99999; }
.header { z-index: 999999; }
```

**Why This Breaks:**
1. Impossible to maintain ordering
2. New elements can't fit in the stack
3. Indicates layout architecture problems

**The Fix:**

```css
/* GOOD - Defined layer system */
:root {
  --z-background: 1;
  --z-ui: 10;
  --z-header: 15;
  --z-modal: 20;
}

.modal { z-index: var(--z-modal); }
```

## Browser IIFE Pattern

### Standard Module Structure

```javascript
/**
 * Module description
 * Pattern: IIFE exposing window.functionName
 */
(function() {
  'use strict';
  
  // Private state
  let privateVar = null;
  
  // Private functions
  function privateHelper() { /* ... */ }
  
  // Public API - expose to window
  window.publicFunction = function(arg) {
    // Use private state and helpers
    return privateHelper(arg);
  };
  
  window.anotherPublic = function() { /* ... */ };
  
  console.log('Module initialized');
})();
```

### Module Initialization Check

```javascript
// Prevent duplicate initialization
window.createStatsPanel = function() {
  if (statsPanel) {
    console.warn('Stats panel already exists');
    return statsPanel;  // Return existing instance
  }
  
  // Create new panel
  statsPanel = document.createElement('div');
  // ...
  return statsPanel;
};
```

## Dynamic Panel Creation

### Creating Panels in JavaScript

```javascript
// Standard panel creation pattern
function createPanel(config) {
  const panel = document.createElement('div');
  panel.id = config.id;
  panel.style.cssText = `
    position: absolute;
    ${config.position};
    background: rgba(0, 0, 0, 0.8);
    color: ${config.color};
    font-family: 'Courier New', monospace;
    border: 2px solid ${config.color};
    padding: ${config.padding || '10px 12px'};
    min-width: ${config.minWidth || '180px'};
    z-index: 10;
    box-shadow: 0 0 20px ${config.glowColor};
  `;
  
  panel.innerHTML = config.content;
  document.body.appendChild(panel);
  return panel;
}

// Usage
createPanel({
  id: 'my-panel',
  position: 'bottom: 20px; right: 20px;',
  color: '#00ff00',
  glowColor: 'rgba(0, 255, 0, 0.3)',
  content: '<div>Content</div>'
});
```

### Cleanup Pattern

```javascript
window.removePanel = function(panelRef) {
  if (panelRef) {
    panelRef.remove();
    panelRef = null;
    console.log('Panel removed');
  }
};
```

## Workflow Checklist: New Panel

Copy this checklist when adding a new dashboard panel:

- [ ] Choose color from threat palette or cyan accent
- [ ] Use `rgba(0, 0, 0, 0.8)` background
- [ ] Use `'Courier New', monospace` font
- [ ] Add 2px solid border matching text color
- [ ] Add matching box-shadow glow
- [ ] Set z-index: 10
- [ ] Position with absolute + bottom/right or top/left
- [ ] Add to module with IIFE pattern
- [ ] Include initialization guard (prevent duplicates)
- [ ] Add cleanup/remove function