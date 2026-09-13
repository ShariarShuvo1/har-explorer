# Changelog

All notable changes to HAR Explorer are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-14

A complete redesign and rebuild of HAR Explorer. Every view has a new interface built to feel familiar from browser DevTools, works on screens from phones to ultrawide monitors, and sits on a reworked, bug-fixed core.

### Highlights

- **New interface:** a sidebar layout with a DevTools-style request list and a resizable details pane.
- **Compare view:** compare two HAR files, such as before and after a deploy.
- **Command palette:** press <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd> to run actions and jump to requests.
- **Editing with undo:** edit any request, and undo any change.
- **Works on every screen size:** fully responsive, down to phone screens.
- **Accurate numbers:** timings and sizes are now correct across every view.

### Added

- **App shell**
  - Collapsible sidebar with view navigation, request and issue counts, bookmarks and a file menu (open another file, download the edited HAR, close).
  - Top bar with a search button, undo, full screen and a light/dark/system theme menu.
  - Command palette (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>K</kbd>) to switch views, run actions, change the theme and find any request by URL.
  - Keyboard shortcuts dialog (<kbd>?</kbd>) and new shortcuts: <kbd>1</kbd>–<kbd>6</kbd> views, <kbd>/</kbd> search, <kbd>F</kbd> filters, <kbd>R</kbd> clear filters, <kbd>T</kbd> waterfall overview, <kbd>J</kbd>/<kbd>K</kbd> next/previous request, <kbd>B</kbd> bookmark, <kbd>Shift</kbd>+<kbd>B</kbd> bookmarked only, <kbd>Delete</kbd>, <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>A</kbd> and <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Z</kbd>.
  - Toast notifications with an Undo action.
  - Undo history (up to 30 steps) for edits, deletes and bookmark changes.
- **Loading files**
  - Landing page with drag and drop, a file picker, paste-to-load (<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>V</kbd>) and a "Try a sample" HAR.
  - Step-by-step guides for exporting a HAR from Chrome, Edge, Firefox and Safari.
  - Clear error messages for invalid, empty or oversized files (limit: 500 MB).
  - Confirmation before a dropped file replaces unsaved edits or bookmarks.
- **Requests view**
  - Virtualized request table with sortable, configurable columns and a waterfall column.
  - Card layout on narrow screens.
  - Waterfall hover card with a phase-by-phase breakdown, resource size and MIME type.
  - DOMContentLoaded and Load markers.
  - Overview strip: drag to zoom into a time range, then pan with the arrow keys.
  - Grouping by domain or resource type, with collapsible groups.
  - Filters popover (a drawer on phones) with removable filter chips. New filters for HTTP version and status class, and `/regex/` support for domain and path.
  - Right-click menu on every request: copy URL, response body, cURL, fetch or PowerShell; bookmark; compare timing; delete.
  - Bulk action bar for selected requests: bookmark, export, compare timing, select all, invert, delete.
  - DevTools-style status bar: request count, transferred and resource sizes, finish time, average duration, page-load markers and a timing colour legend.
  - Side-by-side timing comparison of any two requests.
- **Request details**
  - Resizable split pane on desktop, a sheet on smaller screens, and a maximize option.
  - Previous/next navigation and a position counter.
  - Eight tabs: Overview, Headers, Payload, Response, Timing, Cache, Security and Code.
  - Code editor (CodeMirror) with syntax highlighting, folding and formatting for bodies.
  - Response previews for JSON, HTML, images, fonts, audio and video.
  - Edit dialog for method, URL, status, HTTP version, server IP, start time (with a date-time picker) and response MIME type.
  - Inline editors for headers, query parameters and bodies. You're warned before unsaved edits are discarded.
- **Analytics:** redesigned dashboard with headline cards, resource type and domain charts, timing phases, slowest requests, bandwidth timeline, protocol comparison, third-party impact and image optimization.
- **Patterns:** severity summary cards, severity and type filters, and a sheet listing affected requests with a one-click jump to each.
- **Statistics:** content types, methods and status codes, domains, connections, initiators, priorities, transfer and compression, servers and CDNs, and loading sequence, with an "On this page" outline.
- **Compare:** load a second HAR to see added, removed, slower, faster and status-changed requests.
  - Matching by URL, with URL-pattern matching for hashed file names.
  - Summary deltas and a resource type breakdown.
  - Unified and side-by-side layouts, with row details in a sheet.
- **Export**
  - Choose all, filtered, selected or bookmarked requests.
  - Export as Markdown, plain text, OpenAPI 3.0.3 or HAR.
  - Rendered and source preview, copy and download.
  - Secrets are redacted by default.
- **Bookmarks:** labels, colours and notes, a searchable Bookmarks panel, "show only bookmarked" and export.
- **Design and accessibility**
  - New logo and icon set (SVG favicon that adapts to dark mode, PNG, ICO and Apple touch icon).
  - Refined light and dark themes.
  - Custom inputs, selects, number fields and date picker instead of browser defaults.
  - Accessible labels throughout.
  - Respects the reduced-motion setting.
- **Site and SEO**
  - Generated 1200×630 social preview image.
  - Web app manifest.
  - Single schema.org graph describing the site, the app and its author.
  - Security headers.
- **Project**
  - MIT `LICENSE` file.
  - Rewritten README with new light/dark screenshots.
  - This changelog.
  - `typecheck` script.
  - Prettier formatting (`format` and `format:check` scripts) with automatic Tailwind class sorting; the codebase uses one consistent style.

### Changed

- **Navigation:** replaced the top tab bar with a sidebar, and inline expanding panels with popovers, dialogs, sheets and drawers.
- **Details tabs:** the separate Performance tab is merged into Timing, and the "Focus" mode is replaced by maximizing the details pane.
- **Keyboard:** <kbd>B</kbd> now bookmarks the open request. The Bookmarks panel lives in the sidebar and the command palette.
- **Default sort:** the request list now sorts by start time (oldest first), matching DevTools. The Size column sorts by the transfer size it displays.
- **Screen sizes:** the "larger screen required" notice is gone; the app is fully responsive.
- **Dependencies**
  - Upgraded Next.js 16.1 → 16.3, React 19.2 → 19.3, TypeScript 5 → 6, Tailwind CSS 4.3, Recharts 3.10, Zustand 5.0.15, TanStack Virtual 3.14 and lucide-react 1.x.
  - Replaced `framer-motion` with `motion`.
  - Added shadcn/ui on Radix UI, cmdk, Sonner, Vaul, react-resizable-panels, react-day-picker, next-themes and CodeMirror 6.
- **Theme:** preference is now handled by next-themes. Your previously saved theme carries over.
- **SEO**
  - Shorter title and description.
  - Large-image social cards.
  - Simplified `robots.txt` and sitemap.
  - Browser theme colours match the new design.
  - The browser guides on the landing page are now in the server-rendered HTML.

### Fixed

- **Numbers and timing**
  - TLS time was counted twice in the waterfall, analytics and statistics.
  - HAR's `-1` "unknown" values leaked into totals and produced `NaN`.
  - The timeline ignored the advanced filters, so it disagreed with the list.
  - Editing a request's start time corrupted the timestamp.
- **Exports**
  - OpenAPI export: path parameters never appeared (`{id}` was URL-encoded) and some schema types were invalid.
  - Copy as cURL, fetch and PowerShell didn't escape quotes and included HTTP/2 pseudo-headers.
- **Bookmarks and undo**
  - Bookmarks pointed at the wrong requests after a delete, and carried over into the next file.
  - Undoing a delete discarded bookmark changes made after it.
  - An older toast's Undo button undid a newer change.
  - Saving an unchanged edit created an undo step and could rewrite the URL.
- **Crashes and loading**
  - A single malformed URL could crash a whole view.
  - Dropping a file outside a drop zone made the browser navigate away from the app.
  - Files opened in a background tab didn't finish loading until the tab was focused.
- **Patterns:** same-origin requests were flagged as CORS issues, URLs with query strings were never checked for caching, and Chrome's VeryHigh/VeryLow priorities weren't recognised.
- **Keyboard:** <kbd>5</kbd> pointed at a view that didn't exist, and <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>A</kbd> could never deselect.
- **Styling**
  - Delete buttons and error messages had no red colour.
  - A saved light theme flashed dark on load.
  - Menus and popovers could be see-through.

### Removed

- **Old interface:** the original viewer UI (tabs, inline panels, focus mode and custom menus and tooltips), replaced by the new interface above.
- **Unused dependencies:** `react-hook-form`, `@hookform/resolvers`, `zod`, `date-fns`, `fuse.js` and `browser-fs-access`.
- **Outdated SEO:** the meta keywords list and the FAQ structured data.

### Security

- Upgraded Next.js to 16.3.5, which includes a fix for a known security issue.
- `pnpm audit` now reports no known vulnerabilities (72 before).
- Added security headers: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, a `frame-ancestors` CSP and `Permissions-Policy`.
- Exports redact credentials, cookies and token-like values by default.

## [0.1.0] - 2026-01-03

Initial release.

### Added

- HAR file viewer with a request list, waterfall timeline and request details (headers, request, response, timings, security, cache and performance).
- Analytics, Patterns and Statistics views.
- Export to Markdown, plain text, HAR and OpenAPI.
- Bookmarks, advanced filtering, keyboard shortcuts, and dark and light themes.
- SEO metadata and Google Analytics.

[1.0.0]: https://github.com/ShariarShuvo1/har-explorer/releases/tag/v1.0.0
[0.1.0]: https://github.com/ShariarShuvo1/har-explorer/tree/bcdf366
