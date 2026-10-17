# Context & Repository Index

## Project Architect System Overview
Project Architect is a local-first AI-assisted system architecture design and specification generation platform.
Key Architectural Principles (AGENTS.md):
- Local file directory + two-phase State Commit (NO central databases like SQLite/PostgreSQL).
- B3 Adaptive Discovery Agent is the single production runtime (strict structured output, single turn budget).
- User authorization first: AI results are only candidate suggestions; only user actions lock/confirm states.
- Separation of prototype (`frontend/`) and production workspace (`apps/web/`, `apps/server/`, `packages/core/`, `packages/contracts/`, `packages/agent/`).

## Target Deliverable Requirements
- Master Deliverable: `docs/FRONTEND_UX_ALL_ROUND_AUDIT.md`
- Focus Areas:
  1. 6 Core Lifecycle End-to-End Workflow
  2. Responsive Viewports (1440px+, 768px-1280px, 375px)
  3. Boundary Resilience (Empty states, long text, massive DAG, batch inputs)
  4. Design System & Theme Consistency (WCAG 2.1 AA)
  5. Playwright Dynamic Testing & Code Penetration
  6. Grounded Problem Inventory with File & Line Anchors and 2D Matrix (Lifecycle × Severity)
