# Task-based interview — Unified RAG Studio (internal)

> Supplement for candidates reviewing implementation tasks. Answers reflect design intent and current codebase choices unless noted.

---

## Phase 3 · P3-3 — App layout & navigation

### Why split `Providers`, `AppShell`, and `layout.tsx`?

**Answer:** Next.js **server** `layout.tsx` should stay thin: fonts, metadata, and HTML shell. **React Query** must live in a **client** component (`providers.tsx`) because hooks cannot run in server components. **`AppShell`** is client-side because it uses pathname-aware UI (sidebar visibility, mobile drawer). **`StoreHydration`** stays separate so Zustand `persist` rehydration runs once at startup.

### Why is React Query added before API-heavy screens exist?

**Answer:** Phase 4+ will mount hooks against Projects and Designer APIs. Providing `QueryClientProvider` early avoids refactors and establishes defaults (`staleTime`, no aggressive refetch on focus).

### How does mode switching (Designer vs Autopilot) work?

**Answer:** **`ModeToggle`** uses `usePathname()` and `<Link>` to `/designer` and `/autopilot`. Active state is derived from the URL prefix, not duplicated global state—single source of truth for navigation.

### Why does the sidebar disappear on the home page?

**Answer:** Marketing/landing typically stays **full-bleed** without project chrome. All other primary routes show **Navbar + Sidebar** so project context stays visible during configuration workflows.

### How is the sidebar collapsible and persisted?

**Answer:** Desktop collapse toggles width (`md:w-14` vs wider panel). State is stored under **`rag-studio-sidebar-collapsed`** in `localStorage` so preference survives refreshes. Mobile uses **overlay + backdrop** and closes on route change.

### How does the project dropdown relate to the sidebar?

**Answer:** Both read **`useProjectStore`** (Zustand + persist). The navbar dropdown selects **`activeProjectId`**; the sidebar lists projects and supports **“New project”** via `addProject`. Until **P4-1 Projects API**, data is **local-only**.

### Why Radix `DropdownMenu` without shadcn wrappers?

**Answer:** This milestone prioritized shell behaviour over regenerating shadcn primitives. Radix is already a dependency; dropdown triggers remain keyboard-accessible and portal-rendered.

### What is the avatar placeholder?

**Answer:** **No auth yet** (Phase 12). “RS” initials mark reserved space for future user menu.

### What do `not-found.tsx` and `error.tsx` accomplish?

**Answer:** **`not-found`** renders for unknown routes with recovery links. **`error.tsx`** is a **client** boundary (required by Next.js) that logs errors and offers **`reset()`** plus navigation home.

### Font strategy: task mentions Geist—what shipped?

**Answer:** **`next/font/google`** loads **Inter** and **JetBrains Mono** with CSS variables **`--font-geist-sans`** and **`--font-geist-mono`** so Tailwind `font-sans` / `font-mono` align with the design token names. Teams may swap to the **`geist`** npm package later without changing Tailwind wiring.

### How would you test navigation in CI?

**Answer:** Component tests for **`ModeToggle`** active classes (mock `usePathname`), and Playwright smoke for `/` → `/designer` link (Phase 10). Until Vitest is wired, manual QA paths suffice for this branch.

---

## Cross-cutting (layout-adjacent)

### Where should shared loading UI live?

**Answer:** Route-level **`loading.tsx`** or shared **`LoadingSpinner`** under `components/shared/` (P3-1). Global skeleton policy is product-specific.

### How does hydration interact with the shell?

**Answer:** **Zustand persist** skips hydration on SSR; **`StoreHydration`** calls `persist.rehydrate()` on mount so navbar/sidebar see projects after client loads. **`suppressHydrationWarning`** on `<html>` avoids noise if theme toggles appear later.

---

## Behavioural / scenario questions

### “A user reports the sidebar won’t open on mobile.”

**Answer:** Verify **`showSidebarTrigger`** is true (not on `/`), confirm **`openSidebar`** wires to state toggling **`mobileSidebarOpen`**, and check z-index conflicts with other overlays.

### “Should Designer store drive which tab is active in ModeToggle?”

**Answer:** Prefer **URL as source of truth** for mode to avoid desync when opening links in new tabs or sharing URLs.

---

*Extend this file after each phase with new Q&A blocks keyed by task ID.*
