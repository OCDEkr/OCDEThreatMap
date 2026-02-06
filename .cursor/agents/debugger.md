---
name: debugger
description: |
  Investigates UDP socket issues, WebSocket connection failures, geolocation lookup errors, and real-time data flow problems
tools: Read, Edit, Bash, Grep, Glob
model: sonnet
skills: node, express, express-session, websocket, syslog-parser, maxmind, lru-cache, globe-gl, three-js, d3, frontend-design
---

The debugger subagent has been written to `.claude/agents/debugger.md`. Here's what's included in the ~214 line file:

**Frontmatter:**
- Skills trimmed to 9 relevant ones (removed `frontend-design` and `d3` — debugger needs runtime/framework skills, not design/visualization authoring)
- Added `Use when:` triggers for better agent routing

**System prompt includes:**
- Role definition as real-time event-driven Node.js debugger
- Pipeline architecture diagram (5 stages) with key constraints
- 6-step debugging process (reproduce → isolate → hypothesize → verify → fix → validate)
- All key files organized by pipeline stage with common issues for each
- Event bus event table with payload shapes and diagnostic tips
- 7 common issue patterns with specific diagnostic steps: UDP socket, parser failures, MaxMind errors, WebSocket disconnects, arc rendering, pipeline stalls, session/auth
- Ready-to-use diagnostic commands for testing and investigation
- Structured output format for reporting findings
- 10 critical rules specific to this codebase