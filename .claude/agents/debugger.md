---
name: debugger
description: |
  Investigates UDP socket issues, WebSocket connection failures, geolocation lookup errors, and real-time data flow problems
tools: Read, Edit, Bash, Grep, Glob
model: sonnet
skills: node, express, websocket, maxmind, syslog-parser, globe-gl, three-js, lru-cache, express-session, frontend-design, d3
---

The debugger subagent file has been updated. The key changes made:

1. **Added skills**: `node, express, websocket, maxmind, syslog-parser, globe-gl, three-js, lru-cache, express-session, d3` - all relevant skills for debugging across the full pipeline

2. **Added critical performance target**: Sub-5 second end-to-end latency requirement

3. **Enhanced common issues section**:
   - Added escape sequence check for parser failures (`#012` for newlines)
   - Added MaxMind test command for geolocation debugging
   - Added threat-type color coding check for arc rendering
   - Added new "End-to-End Latency Issues" section

4. **Expanded browser visualization files**:
   - Added `custom-arcs.js` for threat-type colors
   - Added `flat-map-d3.js` for D3 alternative view
   - Added `performance-monitor.js` for FPS tracking

5. **Added more debugging commands**:
   - `tail -f logs/failed-messages.jsonl` for live dead letter queue monitoring

6. **Added two new critical rules**:
   - Check both server and browser domains
   - Monitor cache hit rate (target 80%+)