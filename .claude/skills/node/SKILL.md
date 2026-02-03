---
name: node
description: |
  Manages Node.js 22.x runtime, CommonJS modules, and package management.
  Use when: Configuring Node.js runtime, working with EventEmitter patterns, managing async operations, handling process signals, or structuring CommonJS modules.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Node Skill

Node.js 22.x runtime for a real-time event-driven pipeline. This codebase uses CommonJS modules (`require`/`module.exports`), not ES modules. The architecture relies heavily on EventEmitter for decoupled message flow between components.

## Quick Start

### Event-Driven Architecture

```javascript
// Central event bus (singleton pattern)
const { EventEmitter } = require('events');
const eventBus = new EventEmitter();
eventBus.setMaxListeners(20);
module.exports = eventBus;
```

### Async Initialization Pattern

```javascript
async function start() {
  try {
    await enrichmentPipeline.initialize();
    server.listen(3000);
    const addr = await receiver.listen();
  } catch (err) {
    if (err.code === 'EACCES') {
      console.error('Permission denied: Port requires root');
    }
    process.exit(1);
  }
}
start();
```

### Graceful Shutdown

```javascript
process.on('SIGINT', () => {
  server.close();
  receiver.stop();
  process.exit(0);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught:', err);
  // Don't exit - try to continue
});
```

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| EventEmitter | Decoupled message flow | `eventBus.emit('parsed', data)` |
| CommonJS | Module system | `module.exports = { MyClass }` |
| Process signals | Graceful shutdown | `process.on('SIGINT', handler)` |
| Async/await | Initialization | `await db.initialize()` |
| setInterval | Metrics logging | `setInterval(logMetrics, 30000)` |

## Common Patterns

### Class with EventEmitter

**When:** Creating components that emit events

```javascript
const { EventEmitter } = require('events');

class SyslogReceiver extends EventEmitter {
  constructor(options = {}) {
    super();
    this.port = options.port || 514;
  }
  
  listen() {
    return new Promise((resolve, reject) => {
      this.socket.on('message', (msg, rinfo) => {
        this.emit('message', { raw: msg.toString() });
      });
    });
  }
}
module.exports = { SyslogReceiver };
```

## See Also

- [patterns](references/patterns.md)
- [types](references/types.md)
- [modules](references/modules.md)
- [errors](references/errors.md)

## Related Skills

- See the **express** skill for HTTP routing and middleware
- See the **websocket** skill for real-time client connections
- See the **lru-cache** skill for caching patterns