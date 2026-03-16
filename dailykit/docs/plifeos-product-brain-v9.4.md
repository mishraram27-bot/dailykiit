# PlifeOS Product Brain v9.4

## Product Positioning

PlifeOS is an offline-first Personal PlifeOS: a lightweight PWA for daily money, notes, habits, subscriptions, borrowed money, and shopping.

Core principles:

- Offline first
- Local data ownership
- Fast startup
- No required account
- Modular tools
- Expandable architecture

## Current Core Tools

- Expenses
- Borrowed
- Grocery
- Habits
- Notes
- Subscriptions

## Current Product Strengths

- Strong offline-first architecture
- Fast vanilla JS runtime
- Command-based quick capture
- Modular tool registry
- CSV backup and restore
- Dashboard insights and reports
- Reminder engine for habits and subscriptions
- Installable PWA

## Product Review Priorities

### UX and Discoverability

- Treat search as the command center
- Make command suggestions feel more obvious than plain search
- Keep keyboard-first speed
- Add better empty states and onboarding cues
- Add a global quick-add path

### Product Flow

- Show recent activity on the dashboard
- Surface budget alerts earlier
- Remind users to export backups occasionally
- Keep the app focused on daily personal data capture

### Technical Architecture

- Continue separating tool lifecycle and shared systems
- Add event-bus style decoupling later
- Add storage versioning and migrations later
- Improve service worker update strategy later

### Reliability and Trust

- Keep CSV as the default portable backup format
- Maintain strong input sanitization
- Prefer simple local-first behavior before cloud sync

## High-Impact UX Upgrades Added In This Cycle

- Debounced global search
- Auto-focus search when returning Home
- Command-first styling in search results
- Global quick-add modal for one-line commands
- Dashboard trust summary for budget/backup state
- Dashboard recent activity feed
- Expanded English and Hindi translation coverage

## Recommended Next Steps

### Near term

- Add storage schema versioning and migration helpers
- Add a lightweight event bus for cross-module updates
- Add tool lifecycle hooks beyond `renderTool()`
- Improve service worker strategy to network-first HTML + cache-first assets

### Product polish

- Smarter category learning
- Daily feed filtering
- Budget threshold notifications
- Tool manifest metadata for categories, permissions, and commands

### Later, not now

- Optional cloud sync adapter
- Encrypted backups
- Push-based background reminders
- Plugin-style tool installation
