# Memory: index.md
Updated: now

# Project Memory

## Core
FS Register — multi-tenant class register for children's performing arts schools.
Bloch/Capezio aesthetic: bg #F7F5F2, cards white, text charcoal #1A1A18, accent antique gold #B8975A, risk terracotta #C4725A. Playfair Display italic headings, Jost 200-300 body.
Sharp corners (2px radius). Bottom-border-only inputs. No orange, no bright red.
Multi-tenant: all data scoped by school_id with RLS. Roles in user_roles table (owner/teacher).
Mobile-first, one-handed use. Students created via webhook, not manual entry.

## Memories
- [Design tokens](mem://design/tokens) — Bloch/Capezio palette, HSL values, gold accent, terracotta risk, Playfair Display + Jost
- [Data model](mem://features/data-model) — Schools, students, classes, attendance, notes schema
- [Business logic](mem://features/business-logic) — 8-week attendance, 70% risk, 6-week star, 90-day note flag
- [V2 features](mem://features/v2-planned) — Webhooks, PWA, weekly email notifications, parent email on note
