# DailyKit Product Brain

## Product Positioning

DailyKit is an offline-first Personal Life OS for daily personal data management.

It should stay:

- small
- fast
- private by default
- modular
- useful every day

## Core Experience

DailyKit should feel command-first.

The search bar is not only for finding items. It is the main input layer for actions like:

- `coffee 50`
- `borrow ram 200`
- `note startup idea`
- `habit gym`
- `subscription netflix 499`
- `task call bank`
- `journal Today felt focused`

The supporting UX layers are:

- quick add
- dashboard shortcuts
- empty-state guidance
- recent activity
- weekly summary

## Current Core Tools

- Expenses
- Borrowed
- Grocery
- Habits
- Notes
- Tasks
- Journal
- Subscriptions
- Dashboard

## Product Principles

- Offline first
- Local ownership of data
- No required account
- Expandable tool system
- Fast startup
- PWA installable on supported platforms

## Architecture Direction

DailyKit should continue using:

- lifecycle-aware tools
- shared storage layer
- search engine + command parser
- event bus for decoupling
- storage versioning and migrations
- tool manifest metadata

## Platform Guidance

- Android should keep the prompt-based install flow when `beforeinstallprompt` is available.
- iPhone and iPad should show manual Safari install guidance: open in Safari, tap Share, choose Add to Home Screen.
- Apple web app meta tags and manifest metadata should remain in place.

## UX Priorities

- Command-first discoverability
- Fast capture from search and quick add
- Helpful empty states
- Clean dashboard insights
- Trust cues around backup, diagnostics, and updates

## What To Avoid For Now

- AI assistant
- social or collaboration features
- multi-user complexity
- heavy analytics
- too many random tools

## Current Phase Status

DailyKit has now moved beyond the original six-tool MVP into a stronger daily engagement phase.

The most recent release focus added:

- Tasks / Today List
- Daily Journal
- search and command support for both
- CSV backup/import coverage for both
- diagnostics and activity-feed coverage for both

## Best Next Product Moves

- richer daily dashboard snapshot
- dark mode
- settings toggles for onboarding, reminders, and command behavior
- task and journal insights on the dashboard
- recurring reminder polish and optional cloud sync later
