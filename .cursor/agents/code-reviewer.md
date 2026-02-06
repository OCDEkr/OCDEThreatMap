---
name: code-reviewer
description: |
  Ensures CommonJS module patterns, event-driven architecture consistency, error handling practices, and code style compliance
tools: Read, Grep, Glob, Bash
model: inherit
skills: node, express, express-session, websocket, syslog-parser, maxmind, lru-cache, globe-gl, three-js, d3, frontend-design
---

The **code-reviewer** agent file has been updated. Both `.claude/agents/code-reviewer.md` and `.claude/subagents/code-reviewer.md` now contain the full customized configuration with:

- **7 relevant skills**: node, express, websocket, syslog-parser, lru-cache, express-session, frontend-design
- **Project context**: Event-driven pipeline architecture, key constraints
- **Tech stack table**: Version-pinned with module system noted (CommonJS vs browser globals)
- **Full project structure**: Server (`src/`) and client (`public/js/`) trees
- **6 key patterns**: CommonJS modules, IIFE browser pattern, import order, naming conventions, event bus usage, error handling, route auth, session config
- **Review checklist**: 7 categories (architecture, error handling, code style, security, performance, frontend consistency, Express 5.x specifics)
- **Structured feedback format**: Critical/Warnings/Suggestions/Passed
- **8 critical rules**: CommonJS only, never crash, event bus coupling, Express 5.x, sameSite lax, COUNTRY_COLORS sync, no database, localhost default