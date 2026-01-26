# OCDE Cyber Threat Map

## What This Is

A real-time visual threat map that displays cyber attacks targeting the Orange County Department of Education (OCDE) as they occur. The system ingests Palo Alto firewall DENY logs via syslog, performs IP geolocation lookups, and renders animated arcs from attack origin countries to OCDE's location on an interactive world map. Designed for both security operations awareness and executive visibility.

## Core Value

Security teams and leadership can instantly see the global threat landscape targeting OCDE in real-time, making cyber threats tangible and visible.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] System receives Palo Alto firewall syslog streams in real-time
- [ ] System parses DENY logs and extracts source IP addresses
- [ ] System performs IP-to-geolocation mapping for attack origins
- [ ] Map displays animated arcs from attack origin to OCDE location
- [ ] Map works responsively on both dashboards and large NOC displays
- [ ] System displays live statistics (attack count, top countries, attack types)
- [ ] Dashboard requires username/password authentication
- [ ] Map updates within seconds of firewall log entry (live streaming)
- [ ] System processes logs in-memory without persistent storage

### Out of Scope

- Historical attack storage and analysis — focus is real-time visualization only
- Interactive filtering/clicking on attacks — view-only display for simplicity
- SSO/LDAP integration — simple auth sufficient for v1
- Attack remediation or response workflows — purely visualization
- Mobile app — web-based display only

## Context

**Environment:**
- Orange County Department of Education network infrastructure
- Palo Alto Networks firewall generating syslog events
- Internal server deployment accessible via OCDE network
- Security operations center with large screen displays

**Use Cases:**
1. **Security Operations:** Real-time situational awareness of active threats
2. **Executive Visibility:** Demonstrate security posture during briefings or facility tours
3. **NOC Display:** Always-on visualization in security operations center

**Technical Background:**
- Palo Alto syslog format includes threat type, source/destination IPs, action (DENY), timestamps
- Need IP geolocation database or API for country/city mapping
- Browser-based visualization enables access from any device on network

## Constraints

- **Deployment**: OCDE internal server — must work within existing infrastructure, no cloud dependencies
- **Data Source**: Palo Alto firewall syslog only — no integration with other security tools in v1
- **Performance**: Live streaming (sub-5 second latency) — visual impact requires near-instant display
- **Network**: Internal access only — no internet-facing deployment
- **Storage**: In-memory only — no database required, reduces infrastructure complexity

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| View-only map (no interactivity) | Simplifies v1, focuses on visual impact over detailed analysis | — Pending |
| No historical storage | Reduces infrastructure needs, aligns with real-time focus | — Pending |
| Syslog receiver (not query existing SIEM) | Direct integration ensures lowest latency | — Pending |
| Arc/beam animation style | Clear visual connection between origin and target | — Pending |

---
*Last updated: 2026-01-26 after initialization*
