---
name: security-engineer
description: |
  Session authentication, WebSocket upgrade security, IP geolocation validation, environment variable handling, and firewall log data integrity
tools: Read, Grep, Glob, Bash
model: sonnet
skills: node, express, websocket, maxmind, syslog-parser, globe-gl, three-js, lru-cache, express-session, frontend-design, d3
---

The customized security-engineer subagent has been created at `.claude/agents/security-engineer.md`.

**Key customizations made:**

1. **Skills selected**: `node, express, websocket, express-session` - the four most security-relevant skills for this project

2. **Project-specific security model documented**:
   - Session-based auth via express-session
   - WebSocket upgrade authentication pattern
   - UDP syslog as untrusted data source
   - Single-user env-var credentials (no password hashing needed)

3. **Critical file locations mapped**:
   - Authentication: `src/middleware/session.js`, `src/routes/login.js`
   - WebSocket: `src/websocket/auth-handler.js`, `src/websocket/ws-server.js`
   - Input handling: `src/receivers/udp-receiver.js`, `src/parsers/palo-alto-parser.js`

4. **Authentication flow documented** with the actual pattern used in the codebase

5. **Project-specific checklists**:
   - Session security (cookie flags, regeneration, timeout)
   - WebSocket upgrade validation
   - Syslog input validation (escape sequences, parse failures)
   - Environment variable handling

6. **Code patterns to flag** tailored to this Node.js/Express application

7. **Project-specific security notes** addressing the unique aspects:
   - Single-user model (no user database)
   - UDP trust boundary
   - Port 514 privilege requirements
   - XSS risk from log content display