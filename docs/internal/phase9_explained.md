# Phase 9 explained — for interviews (non-technical audience)

This note explains **Phase 9** in **plain language**. You can read it aloud or hand it out when some panel members are not engineers. Technical names appear only where they help; the ideas are what matter.

---

## What Phase 9 adds (one sentence)

Phase 9 makes **automatic “Autopilot” pipeline builds** leave a **structured record** in a dedicated **experiment tracking** tool (MLflow), so teams can **see what was tried**, **compare runs**, and **revisit decisions** later—without changing whether a customer’s build **succeeds or fails**.

---

## The analogy most people grasp

Imagine a **lab notebook** for an automated researcher:

- Each time Autopilot finishes (or crashes) **one** optimization job, we **start a fresh notebook entry**.
- That entry lists **what we aimed for** (goals and constraints), **what the system chose** at key steps, **scores** where we measured quality, and a **compact snapshot** of the whole story.

The actual product still stores the authoritative build history in our **database**. MLflow is the **notebook** alongside it: built for **browsing, comparing, and explaining** batches of experiments to managers, auditors, or new engineers—not for replacing core product data.

---

## What problem existed before Phase 9?

Through Phase 8, Autopilot builds already **completed** and we stored **results and messages** inside the platform. That is enough for **one build at a time** in the app.

Phase 9 addresses **operational** and **story-telling** needs:

| Need | Plain-language ask |
|------|---------------------|
| **Comparison** | “Run A versus Run B—which settings scored better?” |
| **Audit trail** | “What targets and constraints were in place when we produced this configuration?” |
| **Onboarding** | “Show me a timeline of automated improvements without opening raw database tables.” |

Phase 9 does **not** replace the UI or the database. It **adds** a standard industry tool many ML teams already know.

---

## How it works — high level

1. A user starts an Autopilot **build** in the product (upload documents, set goals).

2. The **main application** queues **background work**. The heavy **multi-agent pipeline** runs in a **worker** process—not in the interactive web server—so the app stays responsive.

3. When that work **finishes** or **errors out**, the worker **contacts MLflow** and creates **one experiment run** labeled with identifiers that match our build record.

4. If MLflow is **busy** or **unreachable**, the build outcome is **unchanged**. We **do not** fail the customer’s job because a reporting system hiccuped.

5. Optional: when tracking succeeds, the build record may also store pointers (like **run identifiers** and **server address**) so linking from internal tools into MLflow stays easy.

Think of MLflow here as **downstream telemetry**: important for observability and narrative, **not** on the critical path of “did the pipeline run?”

---

## What gets recorded (in everyday words)

**Labels (tags)**

- Which **build** and **project**, whether the outcome was **successful** or **failed**, where the signal came from (our Autopilot automation).

**“Settings written down” (parameters)**

- Goals the user cared about—for example optimizing for quality, cost, or speed, numeric **targets** where we measured quality.

- Highlights from intermediate decisions—things like chunking strategy, embedding choice, retrieval mode—surfaced in a flattened, human-scanable form with limits so we avoid flooding MLflow.

**Scores (metrics)**

- Quality-style numbers when the evaluation step produced them (for example fidelity to sources, relevance, precision).

- How many passes or iterations tied to optimization.

**Attachment (artifact)**

- A **JSON snapshot** summarizing structured outputs from stages; useful for auditors or debugging without piecing fragments by hand.

---

## Who benefits when you describe this to non-technical leaders

- **Program / delivery leads**: clearer story for “what did automation try this week?”  
- **Risk / governance**: clearer path to “show your work” alongside product logs.  
- **Hiring narratives**: proves the platform aligns with common **ML operations** maturity (experiment tracking is a standard pillar).

---

## How to summarize Phase 9 in under thirty seconds (interview opener)

“Our Autopilot builds already produced results internally. Phase 9 connects each automated build to MLflow—a standard experiment-tracking layer—capturing goals, highlights, scores, and a tidy snapshot **after each run**. Tracking is optional and non-blocking so production builds never depend on MLflow uptime. Teams get **comparison and audit readiness** beyond the bare database row.”

---

## Optional follow-up questions (answers in simple terms)

**Q: Did we build MLflow ourselves?**

**A:** No. MLflow is a **widely adopted open toolkit**. We integrate it via configuration and lightweight services; we did not reinvent experiment tracking.

**Q: Did Phase 9 change customer-facing workflows?**

**A:** Customers still start builds the **same way**. Behind the curtain, Phase 9 **adds accountability and comparison** tooling for operators and stewards.

**Q: Is every evaluation in the platform mirrored to MLflow?**

**A:** Phase 9 focuses on **whole Autopilot build jobs**. Standalone evaluations executed elsewhere remain a possible future enhancement.

---

If you combine this explanation with Phase 9’s checklist item **“experiment tracking for Autopilot runs—metrics, parameters, artifacts,”** you convey both **purpose** (“why”) and **substance** (“what”), without insisting that every listener parse code.
