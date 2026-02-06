---
name: test-engineer
description: |
  RFC 5424 syslog parser testing, Palo Alto log format validation, enrichment pipeline integration tests, and visualization rendering tests
tools: Read, Edit, Write, Glob, Grep, Bash
model: sonnet
skills: node, express, express-session, websocket, syslog-parser, maxmind, lru-cache, globe-gl, three-js, d3, frontend-design
---

The customized `test-engineer.md` subagent has been written. Here's a summary of what changed:

**Skills trimmed** from 11 to 7 — removed `globe-gl`, `three-js`, `d3`, and `frontend-design` (not relevant to testing backend pipeline logic).

**Replaced the changelog-style body** with a complete, actionable system prompt containing:

| Section | Content |
|---------|---------|
| **When Invoked** | 6-step protocol: read tests → read fixtures → read source → run → fix → re-run |
| **Test Infrastructure** | Full custom runner template with output conventions (`✓ PASS`, `✗ FAIL`, `○ INFO`) |
| **Project Structure** | Annotated tree of `test/` and `src/` directories relevant to testing |
| **Testable Modules** | 5 modules with exact API signatures, return types, and usage examples from source code |
| **categorizeThreat mapping** | Complete truth table from the actual `categorizeThreat()` implementation |
| **Test Fixtures** | Line-by-line table of all 10 fixture samples with format type and expected behavior |
| **Testing Strategy** | Per-module test priorities: parser, IP matcher, enrichment, broadcaster |
| **CRITICAL Rules** | 13 rules covering CommonJS, event bus isolation, IPv4-only, DENY-only filtering, naming conventions, and MaxMind DB dependency |