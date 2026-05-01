# Task-based interview Q&A — Unified RAG Studio

> Internal reference: common questions and model answers tied to roadmap tasks.  
> Update this file when substantial design or implementation work ships.

---

## P3-2 · Zustand state stores (Designer, Autopilot, Projects)

### Why use a client state library at all for RAG Studio?

**Q:** The backend will eventually own projects and pipeline configs. Why add Zustand on the web app?  
**A:** The API is not the only source of truth during authoring. Users need fast, local drafts (Designer wizard), in-progress Autopilot runs, and a project list that survives refresh while we still build CRUD APIs. Zustand gives a small, predictable client layer that can later sync to the server without rewriting UI flows.

### Why Zustand specifically?

**Q:** Why pick Zustand instead of Redux Toolkit, MobX, Jotai, or React Context?  
**A:** Zustand has minimal boilerplate, excellent TypeScript ergonomics, supports middleware (including persistence), and avoids wiring providers for every subtree. For three focused domains (designer draft, autopilot session, projects), slice-shaped stores map cleanly to features without a global reducer ceremony.

### How are stores split across domains?

**Q:** Why three stores instead of one big store?  
**A:** Separation limits re-renders and persistence shapes: Designer drafts change frequently during wizard navigation; Autopilot mixes requirements, documents, and live build snapshots; Projects are relatively stable metadata. Isolated stores make partial persistence and future sync boundaries simpler (e.g., merge projects from `/projects` API without touching autopilot buffers).

### Persistence strategy

**Q:** Where is state persisted and under what keys?  
**A:** Browser `localStorage` via Zustand `persist` middleware with namespaced keys (`rag-studio-designer-v1`, `rag-studio-projects-v1`, `rag-studio-autopilot-v1`). Keys are versioned so we can migrate or invalidate layouts without clobbering unrelated data.

**Q:** What happens if `localStorage` is full or unavailable?  
**A:** Writes may throw; production apps often wrap storage adapters with try/catch and degrade to memory-only. For this codebase, persistence is best-effort for developer UX; APIs remain authoritative once wired.

### Next.js App Router and SSR

**Q:** How do you avoid hydration mismatches with persisted stores?  
**A:** `persist` uses `skipHydration: true`, then a client-only `StoreHydration` component calls `persist.rehydrate()` inside `useEffect` after mount. Server-rendered HTML matches the initial store defaults; after hydration, persisted JSON restores user state without flashing incorrect markup.

**Q:** Can these stores be read from Server Components?  
**A:** No. Hooks run only in Client Components. Server Components should receive props from client children or fetch server data directly—not read `localStorage`.

### Designer store semantics

**Q:** What does `draft` represent?  
**A:** A full `PipelineConfiguration` object—the working pipeline before save/export. It aligns with shared TypeScript contracts from Phase 1.

**Q:** What is `activeStageId` for?  
**A:** It mirrors `DESIGNER_STAGES` in `constants.ts` so the future multi-step UI can highlight the current wizard stage without coupling routing to store internals.

**Q:** What is the difference between `patchDraft`, `updateStages`, `loadPipeline`, and `resetDraft`?  
**A:**  
- `patchDraft`: shallow/top-level merge plus optional `stages`/`metadata` merge—good for renaming or swapping nested slices from templates.  
- `updateStages`: merges partial `PipelineStages` and bumps `metadata.updatedAt`.  
- `loadPipeline`: replaces the draft (e.g., template apply or backend fetch result).  
- `resetDraft`: new default pipeline with fresh id via `createDefaultPipelineConfiguration()`.

### Autopilot store semantics

**Q:** What is persisted for builds?  
**A:** `builds` is a map keyed by build id containing trimmed `AutopilotBuild` objects—activity `messages` arrays are truncated before persistence to avoid unbounded growth while preserving recent agent output.

**Q:** Why separate `resetSession` and `clearBuildHistory`?  
**A:** `resetSession` clears wizard inputs (requirements, documents, handoff config, active pointer) but retains historical builds for comparison or auditing during a session. `clearBuildHistory` wipes stored builds when users explicitly discard history.

**Q:** What is `baseConfig` / `startFromDesigner`?  
**A:** Optional Designer → Autopilot handoff baseline (`PipelineConfiguration`). `startFromDesigner` loads that baseline and resets autopilot inputs per Phase 8 expectations.

### Projects store semantics

**Q:** Why store projects locally before the Projects API ships?  
**A:** It unlocks UI flows (project switcher, naming drafts, linkage placeholders) and mirrors eventual CRUD. Records carry timestamps for sorting until P4-1 replaces persistence.

### Testing & observability

**Q:** How would you unit-test components using these stores?  
**A:** Reset store state in `beforeEach` (`setState` helpers or dedicated reset actions), render under React Testing Library, dispatch actions, assert DOM. For persistence integration tests, mock `localStorage` or use Vitest/Jest `jest-environment-jsdom`.

**Q:** How would you debug rogue re-renders?  
**A:** Narrow selectors (`useDesignerStore((s) => s.draft.name)`), React Profiler, and ensuring derived props aren’t recreated each render. Avoid subscribing entire store objects in leaf components.

### Security & privacy

**Q:** Any concerns storing pipeline configs in `localStorage`?  
**A:** Yes—configs may imply proprietary stack choices or endpoints (later phases). For sensitive deployments, encrypt-at-rest in storage, shorten TTL, or gate persistence behind consent—production policies belong with auth (Phase 12).

### Comparison prompts

**Q:** When would you move state from Zustand into TanStack Query?  
**A:** When data is server-owned (canonical lists, ACL-sensitive documents). Query caches fetch results; Zustand holds UI/session overlays (wizard stage, optimistic merges). They complement each other.

**Q:** Can Immer help here?  
**A:** Optional—nested merges like `patchRequirements` are manageable with spreads today. Immer is justified if immutable updates become verbose or bug-prone.

---

## Cross-cutting / roadmap adjacent

### Phase alignment

**Q:** How does P3-2 relate to Phase 4 APIs?  
**A:** Client stores act as a staging layer: once Projects and Designer Config APIs exist, stores orchestrate optimistic updates and reconcile server responses without rewriting wizard UI.

---

## Prompt maintenance

**Q:** Why pair implementation tasks with interview Q&A updates?  
**A:** It preserves rationale for future reviewers and onboarding—design intent stays adjacent to code history instead of living only in ephemeral chats.
