All three WebSocket skill files have been written:

**SKILL.md** (~95 lines) - Concise overview covering:
- noServer mode setup with manual HTTP upgrade and session auth
- ReconnectingWebSocket client config with exponential backoff
- Batched broadcasting (100ms interval, 50-event cap)
- Key concepts table and critical wiring order
- Cross-references to 6 related skills (express-session, express, node, frontend-design, globe-gl, d3)

**references/patterns.md** (~150 lines) - Deep patterns covering:
- Server setup with `noServer: true` and `clientTracking: true` (with explanation of why)
- Dual authentication model (`authenticateUpgrade` vs `requireAuthUpgrade`)
- Heartbeat ping/pong with 30s interval
- Batched broadcasting with `flushBatch` mechanics
- Event bus integration wiring
- Client reconnection with ReconnectingWebSocket fallback
- 4 anti-patterns with WARNING headers (unguarded send, stringify-per-client, close vs terminate, hardcoded URLs)

**references/workflows.md** (~145 lines) - Operational workflows covering:
- 8-step server setup checklist
- Adding new message types (server + client + validation loop)
- Debugging guide with browser console commands and common issues table
- Testing with wscat, test traffic, and e2e validation
- Graceful shutdown with `stopBatching()`
- Production considerations (connection limits, heartbeat tuning, security checklist)
- WARNING about missing per-client rate limiting

**Code blocks:** 22 total across all files (exceeds the 15 minimum).