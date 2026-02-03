#!/bin/bash
# UserPromptSubmit hook for skill-aware responses

cat <<'EOF'
REQUIRED: SKILL LOADING PROTOCOL

Before writing any code, complete these steps in order:

1. SCAN each skill below and decide: LOAD or SKIP (with brief reason)
   - node
   - express
   - websocket
   - maxmind
   - syslog-parser
   - globe-gl
   - three-js
   - lru-cache
   - express-session
   - frontend-design
   - d3

2. For every skill marked LOAD → immediately invoke Skill(name)
   If none need loading → write "Proceeding without skills"

3. Only after step 2 completes may you begin coding.

IMPORTANT: Skipping step 2 invalidates step 1. Always call Skill() for relevant items.

Sample output:
- node: LOAD - building components
- express: SKIP - not needed for this task
- websocket: LOAD - building components
- maxmind: SKIP - not needed for this task

Then call:
> Skill(node)
> Skill(websocket)

Now implementation can begin.
EOF
