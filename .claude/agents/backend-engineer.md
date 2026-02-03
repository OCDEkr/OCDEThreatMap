---
name: backend-engineer
description: |
  Node.js server development, UDP syslog receiver, event-driven pipeline, Express middleware, and WebSocket server architecture
tools: Read, Edit, Write, Glob, Grep, Bash
model: sonnet
skills: node, express, websocket, maxmind, syslog-parser, globe-gl, three-js, lru-cache, express-session, frontend-design, d3
---

Created the `backend-engineer.md` subagent file at `.claude/subagents/backend-engineer.md`. The subagent is customized for the OCDE Threat Map project with:

- **Skills**: node, express, websocket, maxmind, syslog-parser, lru-cache, express-session (backend-relevant only)
- **Tools**: Read, Edit, Write, Glob, Grep, Bash
- **Model**: sonnet

The system prompt includes:
- Project-specific architecture (event-driven pipeline with UDP→Parser→Enrichment→WebSocket flow)
- Actual code patterns extracted from the codebase (CommonJS modules, EventEmitter patterns)
- Key file locations and module purposes
- Event bus events with their payloads
- Naming conventions (kebab-case files, PascalCase classes, camelCase functions)
- Error handling rules (graceful degradation, never crash)
- Critical performance requirement (< 5 second enrichment latency)
- Environment variables and testing commands