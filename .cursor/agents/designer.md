---
name: designer
description: |
  NOC-optimized dark theme styling, dashboard layout design, visualization panel organization, and threat visualization UI/UX
tools: Read, Edit, Write, Glob, Grep
model: sonnet
skills: node, express, express-session, websocket, syslog-parser, maxmind, lru-cache, globe-gl, three-js, d3, frontend-design
---

The **designer** subagent has been written. Here's what the file contains:

**Frontmatter:**
- Skills trimmed to 4 relevant ones: `frontend-design, globe-gl, three-js, d3` (removed 7 backend skills)
- Added specific trigger descriptions in the description field

**Content (280 lines):**
- **Design System** — Complete color palette (9 semantic colors), 3-tier glow system, typography scale (9 size tiers), NOC responsive breakpoints
- **Dashboard Layout** — ASCII diagram with exact positions, z-index layers, and spatial coordinates for all HUD panels
- **Three Styling Approaches** — Documents which files use external CSS, inline `<style>` tags, or JS inline styles
- **5 Component Patterns** with code — HUD panel, dynamic JS panel, icon button, connection status states, feedback messages
- **Country Color Sync** — Warning about dual `COUNTRY_COLORS` maps in custom-arcs.js (hex int) and flat-map-d3.js (hex string)
- **Animation Conventions** — Table covering all 8 animation types with durations and technologies
- **Browser Module Pattern** — IIFE pattern with create/update/remove API
- **12 CRITICAL Rules** — Hard NEVER/ALWAYS constraints extracted from actual codebase patterns
- **12-item New Component Checklist** — Step-by-step guide for adding dashboard panels