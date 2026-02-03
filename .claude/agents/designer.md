---
name: designer
description: |
  NOC-optimized dark theme styling, dashboard layout design, visualization panel organization, and threat visualization UI/UX
tools: Read, Edit, Write, Glob, Grep
model: sonnet
skills: node, express, websocket, maxmind, syslog-parser, globe-gl, three-js, lru-cache, express-session, frontend-design, d3
---

The designer subagent file has been created and customized for the OCDE Cyber Threat Map project. The file includes:

**Key customizations:**
- **Skills:** Added `frontend-design`, `globe-gl`, `three-js`, and `d3` - the relevant visualization and styling skills
- **Project context:** Detailed description of the OCDE threat map dashboard and its components
- **Tech stack:** Globe.GL, Three.js, D3.js, pure CSS with IIFE pattern
- **Key files table:** Mapped specific files like `dashboard.css`, `custom-arcs.js`, `stats-display.js`
- **NOC Design System:** Complete color palette matching existing CSS, typography scale, z-index layering
- **Established patterns:** Panel, button, status indicator, and glow effect patterns extracted from actual code
- **Critical rules:** Project-specific constraints like monospace-only fonts, no light mode, arc color coordination
- **Accessibility guidelines:** NOC-specific requirements for 20+ foot viewing distance
- **Common tasks:** Step-by-step guidance for adding panels, modifying colors, adding buttons
- **DO/DON'T section:** Clear guidelines based on existing codebase patterns