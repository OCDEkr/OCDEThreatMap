#!/bin/bash
export SYSLOG_PORT=5140
timeout 15 npm start 2>&1 &
sleep 4
echo '<134>1 2024-01-15T10:30:45Z firewall.ocde.us TRAFFIC - - - src=203.0.113.5 dst=192.168.1.100 action=DENY threat=malware' | nc -u 127.0.0.1 5140
sleep 3
killall node 2>/dev/null || true
