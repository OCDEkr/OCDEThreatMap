#!/bin/bash
# UserPromptSubmit hook for skill-aware responses

cat <<'EOF'
REQUIRED: SKILL LOADING PROTOCOL

Before writing any code, complete these steps in order:

1. SCAN each skill below and decide: LOAD or SKIP (with brief reason)
   - node
   - express
   - express-session
   - websocket
   - syslog-parser
   - maxmind
   - lru-cache
   - globe-gl
   - three-js
   - d3
   - frontend-design

2. For every skill marked LOAD → immediately invoke Skill(name)
   If none need loading → write "Proceeding without skills"

3. Only after step 2 completes may you begin coding.

IMPORTANT: Skipping step 2 invalidates step 1. Always call Skill() for relevant items.

Sample output:
- node: LOAD - building components
- express: SKIP - not needed for this task
- express-session: LOAD - building components
- websocket: SKIP - not needed for this task

Then call:
> Skill(node)
> Skill(express-session)

Now implementation can begin.
EOF
