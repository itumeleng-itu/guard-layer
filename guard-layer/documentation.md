# GuardLayer — Middleware Team Documentation
> **Roles P1 – P4 | Africa Ignite Hackathon**
> Nokia Network as Code • CAMARA APIs • Claude AI

---

## Project Overview

GuardLayer is an agentic AI fraud detection middleware that sits between a fintech payment app and the Nokia Network as Code telecom layer. Before any mobile money transaction is approved, GuardLayer fires six CAMARA API checks, feeds all results into a Claude AI decision engine, and returns an Approve, Challenge, or Block decision in under two seconds — with a plain-language explanation the user can understand.

This document defines the responsibilities of the four middleware engineers (P1 – P4), what each person builds, and exactly how their work connects.

### System Architecture at a Glance

| Layer | What it does |
|---|---|
| Nokia CAMARA APIs | Six network intelligence signals queried per transaction |
| AI Decision Engine | Claude agent evaluates all 6 signals and raw risk score |
| Biometric Escalation | Device-native biometrics (expo-local-authentication) on CHALLENGE |
| Payment Simulator | Internal mock fulfillment — no real M-Pesa needed for demo |
| Real-time Dashboard | SSE stream shows every API firing live to judges |
| USSD Subsystem | Feature phone parity — same protection, no smartphone needed |

> **Important:** The middleware is the product. The SendCash mobile app (P5, built separately) and the real-time dashboard are demo vehicles that consume the middleware. All four middleware roles (P1–P4) must be complete before P5 begins.

---

## Monorepo Structure

All four engineers work inside the same repository. The structure below shows who owns which files. No engineer should edit files owned by another engineer without a sync first.

```
GuardLayer-monorepo/
├── package.json                              # P1
├── turbo.json                                # P1
├── .env.example                              # P1
├── packages/
│   └── shared/
│       └── types.js                          # P1 — everyone reads this
└── apps/
    ├── middleware/
    │   ├── server.js                         # P2 (P3 adds /confirm route)
    │   └── src/
    │       ├── camara/
    │       │   ├── simSwap.js                # P1
    │       │   ├── deviceSwap.js             # P1
    │       │   ├── numberVerify.js           # P1
    │       │   ├── locationVerify.js         # P1
    │       │   ├── kycMatch.js               # P1
    │       │   └── congestionInsights.js     # P1
    │       ├── agent/
    │       │   ├── decisionEngine.js         # P2
    │       │   └── signalFusion.js           # P2
    │       ├── biometric/
    │       │   └── deviceNative.js           # P3
    │       ├── payment/
    │       │   └── paymentSimulator.js       # P3
    │       └── ussd/
    │           └── ussdHandler.js            # P3
    └── dashboard/
        ├── index.html                        # P4
        ├── style.css                         # P4
        ├── app.js                            # P4
        └── mock-server.js                    # P4
```

### Shared Types Contract

On Day 1, P1 writes `packages/shared/types.js` and commits it before anyone else writes a line of code. This file defines the signal response schema, SSE event format, and decision outcome constants that all four engineers build against. Without this, everyone will build incompatible interfaces.

The shared types must define:

- Signal response shape for each of the 6 CAMARA APIs
- SSE event types: `stage`, `signal`, `raw_score`, `decision`, `complete`, `error`
- Decision constants: `APPROVE`, `CHALLENGE`, `BLOCK`
- Stage constants: `interrogation`, `ai_decision`, `complete`
- Transaction request payload shape: `phoneNumber`, `amount`, `recipientNumber`, `deviceId`, `location`, `scenario`

---

## P1 — Monorepo Architect + Nokia CAMARA Integration

**Sets up the repo skeleton and wires all six real Nokia Network as Code SDK calls.**

You are the foundation everyone else builds on. Your two jobs are: (1) set up the monorepo so all four engineers can work without conflicts, and (2) replace every mock CAMARA module with real Nokia Network as Code SDK calls. Until your modules are working, everyone else uses mock data. Once yours are done, the system is real.

### Monorepo Setup

- Initialise Turborepo with npm workspaces at the root
- Create the `apps/middleware`, `apps/dashboard`, `packages/shared` folder structure
- Write `packages/shared/types.js` with all shared schemas and constants
- Configure `turbo.json` with build, dev, and test pipelines
- Set up root `.env.example` with all required keys documented
- Write a single `npm run dev` command at root that starts all apps

### Nokia Developer Portal

- Register at `developer.networkascode.nokia.io` with your email
- Create an application and copy the API key into `.env`
- Document the exact Nokia sandbox test phone numbers in `packages/shared/types.js` — these are the only numbers that work in sandbox mode
- Write a test script `scripts/test-nokia.js` that fires all 6 APIs against the sandbox and logs results — run this before handing off to P2

### Six CAMARA Modules — `apps/middleware/src/camara/`

Each module must follow this exact pattern so P2 can call them without knowing which mode is active:

```js
export async function checkSimSwap(phoneNumber, scenario) {
  // if MOCK_MODE=true → return mock data based on scenario
  // if MOCK_MODE=false → call Nokia SDK
  // always return the same shape defined in shared/types.js
}
```

| Module | What it checks | Weight |
|---|---|---|
| `simSwap.js` | Was this SIM card recently replaced? Primary fraud signal | 35 |
| `deviceSwap.js` | Is this the same device that owns this number? IMEI match | 25 |
| `numberVerify.js` | Is the calling number genuine or is caller ID being spoofed? | 20 |
| `locationVerify.js` | Is the user in their usual location or geographically anomalous? | 15 |
| `kycMatch.js` | Does the account holder identity match the SIM registrant records? | 10 |
| `congestionInsights.js` | Is the cell tower experiencing unusual congestion? | 8 (elevated) or 15 (critical) |

### Nokia SDK Integration Pattern

For each module, the real integration follows this pattern:

```js
// ⚠️ Note: Verify this import pattern against the actual Nokia `network-as-code` npm package documentation.
import NetworkAsCode from 'network-as-code'

const client = new NetworkAsCode.NetworkAsCodeClient(process.env.NOKIA_API_KEY)
const device = client.devices.get({ phoneNumber })
const wasSwapped = await device.verifySimSwap({ maxAge: 6 })
```

> Use Nokia test device numbers in sandbox. Real +27 South African numbers will fail without carrier agreements. Document which test numbers map to which scenarios in `shared/types.js`.

### P1 Deliverables Checklist

| Deliverable | Done when... |
|---|---|
| Monorepo scaffolded | `npm run dev` starts at root without errors |
| `shared/types.js` committed | P2, P3, P4 can all import from it |
| Nokia API key working | Test script returns real sandbox responses |
| All 6 modules built | Each exports `checkXxx()` in mock and real mode |
| Test script passing | All 6 Nokia sandbox calls return valid responses |
| `.env.example` documented | Any engineer can onboard with just the README |

---

## P2 — AI Decision Engine + Pipeline

**Owns the Claude AI integration, orchestration, SSE streaming, and all three decision outcomes.**

You are the brain of GuardLayer. You take the signals P1 produces, run them through a Claude AI pipeline, and stream the results to the frontend in real time. The quality of your work determines whether GuardLayer feels like a real intelligent system or just a rule-based checker.

### Signal Fusion Scoring — `computeRawRiskScore()`

This runs before Claude and gives a deterministic baseline score. Judges reading the code must see real engineering here, not just an AI prompt.

| Signal | Weight |
|---|---|
| SIM Swap detected | 35 points |
| Device swap detected | 25 points |
| Number spoofed | 20 points |
| Location mismatch | 15 points |
| KYC match failed | 10 points |
| Network congestion anomaly (high) | 8 points |
| Network congestion anomaly (critical) | 15 points |
| 3+ signals triggered simultaneously | ×1.2 combination multiplier |
| Maximum score (clamped) | 100 points |

| Score range | Decision zone |
|---|---|
| 0 – 30 | APPROVE territory |
| 31 – 60 | CHALLENGE territory (biometric challenge) |
| 61 – 100 | BLOCK territory |

### AI Risk Evaluation Pipeline

This is the core differentiator. The system interrogates all 6 APIs to build a complete profile before making a decision, ensuring all signals are correlated together.

**Phase 1 — Parallel Interrogation:**

- Call all 6 CAMARA APIs (simSwap, deviceSwap, numberVerify, locationVerify, kycMatch, congestionInsights) in parallel.
- Stream each signal result to frontend as it arrives.
- Run `computeRawRiskScore()` on all collected signals.

**Phase 2 — AI Decision:**

- Send all signals + raw score to Claude for final decision.
- Claude returns: `{ decision: 'APPROVE'|'CHALLENGE'|'BLOCK', riskScore, explanation, reasoning, recommendedAction }`
- Stream the decision event, then the complete event.

### Claude System Prompt

**Risk Evaluation prompt:**

> You are GuardLayer, an agentic fraud detection engine for mobile money in Sub-Saharan Africa. You receive signals from Nokia CAMARA APIs and a pre-computed weighted risk score. Correlate all signals together — a SIM swap alone might be legitimate (new phone), but SIM swap + device change + location mismatch + KYC failure together is almost certainly fraud. Return ONLY valid JSON: `{ decision: 'APPROVE'|'CHALLENGE'|'BLOCK', riskScore: 0-100, explanation: string in plain English a user can understand, reasoning: string explaining which signals triggered the decision, recommendedAction: string }`

### SSE Streaming Endpoint — `POST /api/transaction/check/stream`

This is the primary endpoint. It uses Server-Sent Events so the dashboard sees results in real time as each API fires.

- Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- Use a helper `emit(res, eventType, data)` that writes the SSE format correctly
- Stream `stage` events when the pipeline enters a new phase
- Stream `signal` events as each CAMARA API returns
- Stream `raw_score` after `computeRawRiskScore()` runs
- Stream `decision` after Claude call
- Stream `complete` to close the pipeline
- Also keep `POST /api/transaction/check` as a legacy single-pass endpoint for the USSD handler

### Three Outcome Scenarios

| Scenario | Trigger + Response |
|---|---|
| Scenario B — APPROVE | All signals clear. Frictionless. Stream decision APPROVE. P3's simulator fires immediately. |
| Scenario A — CHALLENGE | Ambiguous signals (e.g. location mismatch only). Stream decision CHALLENGE. Middleware sends 401 with `challengeAction: 'DEVICE_BIOMETRIC'`. P3 handles the biometric confirm flow. |
| Scenario C — BLOCK | Critical signals fired (SIM swap + others). Stream decision BLOCK. Middleware sends 403 with human explanation. No payment proceeds. |

### Fallback Engine

If Claude API is unreachable, the system must never fail open. Build `fallbackDecision()` that uses `computeRawRiskScore()` directly: score > 61 → BLOCK, score 31–60 → CHALLENGE, score 0–30 → APPROVE. Log that fallback was used.

### P2 Deliverables Checklist

| Deliverable | Done when... |
|---|---|
| `computeRawRiskScore()` | Returns correct scores for all test cases in `shared/types.js` |
| `decisionEngine.js` | Claude call returns valid decision JSON |
| SSE stream endpoint | Dashboard receives events in correct order with correct timing |
| Legacy endpoint | `POST /api/transaction/check` returns single JSON response |
| Fallback engine | System returns BLOCK when Claude API key is missing |
| All 3 scenarios working | Full Attack → BLOCK, Location only → CHALLENGE, All Clear → APPROVE |

---

## P3 — Biometric Escalation + Payment Simulator + USSD

**Owns the CHALLENGE flow, device-native biometric confirm, payment simulation, and USSD subsystem.**

You handle everything that happens after P2 makes a decision. When the decision is CHALLENGE, you own the biometric challenge flow. When the decision is APPROVE or biometric passes, you trigger the payment simulator. You also own the USSD subsystem that makes GuardLayer work on feature phones — which is one of the key differentiators for the hackathon.

### Biometric Escalation — Device-Native

GuardLayer uses device-native biometrics (Face ID on iPhone, fingerprint on Android) via `expo-local-authentication`. No external API, no business email, no API key needed. This is architecturally correct and more elegant than a third-party service for a hackathon.

Your backend responsibilities for biometrics:

- When P2 streams a CHALLENGE decision, P2's code sends a 401 response with `{ challengeAction: 'DEVICE_BIOMETRIC', reason: string }`
- The mobile app (P5) calls `LocalAuthentication.authenticateAsync()` natively on the device
- On result, the app POSTs to your `/confirm` route
- Build `POST /api/confirm` that accepts: `{ biometric: 'local_pass'|'local_fail', platform: 'ios'|'android', transactionRef: string }`
- On `local_pass`: call `paymentSimulator.execute()` and return 200 with outcome
- On `local_fail`: return 403 with `{ human_msg: 'Identity not confirmed. Transaction blocked.' }`

> For the web dashboard (P4), the biometric is simulated with two buttons: Simulate Pass and Simulate Fail. These POST to the same `/confirm` route with the same payload shape. Your route does not need to know whether it came from a real device or a dashboard button.

### Payment Simulator — `paymentSimulator.js`

This replaces M-Pesa Daraja for the demo. It must feel real — realistic delays, transaction IDs, and success/fail states.

- `execute({ amount, recipient, transactionRef })` → returns `{ result: 'success'|'fail', txnId, timestamp, amount, recipient }`
- Success path: 800ms delay (simulates STK push round trip), returns `txnId` in format `SIM-XXXXX`
- Fail path: 400ms delay, returns `{ result: 'fail', reason: 'Insufficient funds' }`
- Log every simulated transaction to an in-memory array for the dashboard impact counter
- Expose `GET /api/simulator/log` for the dashboard to retrieve session transaction history

### USSD Subsystem — `ussdHandler.js`

This is what makes GuardLayer work for the 40% of mobile money users in Sub-Saharan Africa who use feature phones. The USSD flow must call the same fraud detection engine — it is not a visual fake.

| Step | User input → Response |
|---|---|
| Start | `*384#` → `CON GuardLayer Security Check` menu (2 options) |
| Option 1 | `1` → `CON Enter recipient phone number` |
| Recipient entered | Any number → `CON Enter amount (ZAR)` |
| Amount entered | Any number → `CON Confirm: Send ZAR X to Y? (1=Yes 2=No)` |
| Confirmed | `1` → calls `POST /api/transaction/check` → `END GuardLayer Result: [DECISION] Risk: X/100` |
| Option 2 | `2` → calls `simSwap.js` only → `END SIM status result` |
| Cancel | `2` at confirm step → `END Transaction cancelled` |
| Invalid input | Any invalid → `CON Invalid input. Try again.` |

- Store session state in an in-memory object keyed by `phoneNumber`
- `CON` prefix = session continues, `END` prefix = session closes
- Expose `POST /api/ussd/simulate` accepting `{ phoneNumber, input }`
- For the final decision step, call `POST /api/transaction/check` from P2's engine — the legacy single-pass endpoint, not the SSE stream, because USSD cannot use SSE

### P3 Deliverables Checklist

| Deliverable | Done when... |
|---|---|
| `POST /api/confirm` | Accepts biometric result, triggers simulator, returns correct outcome |
| `paymentSimulator.js` | Returns `txnId` with realistic delay on success |
| `GET /api/simulator/log` | Dashboard can retrieve session transaction history |
| `ussdHandler.js` | Full 5-step flow works end-to-end with real fraud check on confirm |
| `POST /api/ussd/simulate` | Returns CON/END responses correctly for all inputs |
| Biometric fail path | Returns 403 with human message, does not trigger simulator |
| USSD fraud check | A Full Attack scenario via USSD returns `END BLOCK` result |

---

## P4 — Real-Time API Monitor Dashboard

**Builds the live visualisation showpiece — the thing judges watch during the demo.**

You build what judges actually see and remember. The middleware could be perfect, but if the demo is hard to follow, the team loses points. Your dashboard makes the invisible visible — judges watch six API cards illuminate in real time, the pipeline animate, and the AI decision render with its explanation. This is the showpiece.

You build entirely independently from P1, P2, and P3 by connecting to your own mock SSE server that you also build. When the real middleware is ready, switching is one environment variable change.

### Mock SSE Server — `mock-server.js`

Build a standalone Express server on port 3001 that streams realistic SSE events with realistic timing so your dashboard looks and feels exactly like the real middleware.

- `POST /api/transaction/check/stream` — streams scenario-appropriate SSE events
- `POST /api/ussd/simulate` — returns mock USSD session text
- `POST /api/confirm` — returns mock biometric result
- `GET /api/health` — returns `{ status: 'mock', mode: 'dashboard-dev' }`

**Timing for `full_attack` scenario (what judges will see during the demo):**

| Delay | Event |
|---|---|
| 200ms | `stage`: interrogation initiated |
| 400ms × 6 | `signal`: each API fires in parallel |
| 300ms | `raw_score`: 100, 6 signals, multiplier applied |
| 500ms | `stage`: Claude AI correlating... |
| 1200ms | `decision`: BLOCK, riskScore 98, full explanation |
| 200ms | `complete`: pipeline finished |

### Dashboard Layout — Seven Panels

Build in vanilla HTML + CSS + JavaScript. No framework, no build step. `npm install && node mock-server.js` should be the only command needed.

| Panel | What it shows |
|---|---|
| 1 — Header | GuardLayer logo, Nokia Network as Code badge, connection status dot (mock vs live), environment toggle |
| 2 — Impact Counter | 4 stat tiles: Transactions Checked, Fraud Blocked, Value Protected (ZAR), Uptime. Numbers animate on change. |
| 3 — Transaction Form | Phone number, amount, recipient, scenario dropdown (6 options), Run Security Check button |
| 4 — Pipeline Visualiser | Stage status bar + 6 signal cards in 3×2 grid + dual score bars (pre-AI fusion + AI final) |
| 5 — Decision Output | APPROVE/CHALLENGE/BLOCK badge + plain-language explanation + recommended action + biometric panel on CHALLENGE |
| 6 — USSD Simulator | Nokia phone mockup, text input, session display |
| 7 — Activity Log | Scrollable terminal-style log of every SSE event with colour coding and pipeline duration |

### The Six Signal Cards

This is the centrepiece. Each card starts grey (pending). When the SSE `signal` event arrives, the card illuminates with the result and correct status colour.

| Card | Icon | Status colours |
|---|---|---|
| SIM Swap Detection | 📱 | green=clear, amber=recent, red=critical |
| Device Swap Detection | 💻 | green=safe, amber=warning, red=new device |
| Number Verification | 📞 | green=verified, red=spoofed |
| Location Verification | 📍 | green=match, amber=partial, red=mismatch |
| KYC Match | 🪪 | green=match, red=mismatch |
| Network Congestion | 📡 | green=normal, amber=elevated, red=critical |

### Environment Detection

On page load, ping both servers and connect to whichever responds first:

```js
// Try GET http://localhost:3000/api/health → real middleware
// Try GET http://localhost:3001/api/health → mock server
```

Update the header connection status dot accordingly. Store the active base URL in a variable used for all subsequent requests. This means P4 can demo standalone (mock server) or connected to P1+P2+P3's middleware — same dashboard, one variable.

### Biometric Simulation Panel

When the `decision` event arrives with `decision: CHALLENGE`, show a biometric challenge panel below the explanation.

- Show a camera icon and text: "Liveness verification required to proceed"
- Two buttons: "Simulate Biometric Pass" (green) and "Simulate Biometric Fail" (red)
- Pass: `POST /api/confirm { biometric: 'local_pass' }` → show 200 outcome: "Verified & Paid — TXN: SIM-99999"
- Fail: `POST /api/confirm { biometric: 'local_fail' }` → show 403 outcome: "Identity not confirmed. Transaction blocked."
- Update impact counters accordingly after the final outcome

### P4 Deliverables Checklist

| Deliverable | Done when... |
|---|---|
| `mock-server.js` | All 3 scenarios stream correct events with correct timing |
| Full layout | All 7 panels render correctly on desktop and mobile viewport |
| Signal cards | All 6 cards animate correctly for `full_attack` scenario |
| Pipeline status bar | Advances through all stages during a `full_attack` check |
| Dual score bars | Both bars animate from 0 to correct value over 800ms |
| Decision output | BLOCK renders red, CHALLENGE renders amber with biometric panel, APPROVE renders green |
| Activity log | Shows every SSE event with correct colour coding and final duration |
| Environment detection | Switches between mock and live middleware automatically |
| Impact counters | Increment correctly across multiple transaction checks |

---

## How the Four Jobs Connect

### Dependency Map

| | P1 produces | P2 produces | P3 produces | P4 produces |
|---|---|---|---|---|
| **P1 needs** | — | — | — | — |
| **P2 needs** | → 6 CAMARA modules + shared types | — | — | — |
| **P3 needs** | → `simSwap.js` for USSD SIM check | → `POST /api/transaction/check` endpoint for USSD confirm | — | — |
| **P4 needs** | → shared types for event shapes | → SSE stream endpoint to consume | → `/confirm` for biometric simulation panel | — |

### The Day 1 Sync — 30 Minutes Only

The only required cross-team meeting. P1 and P2 write `shared/types.js` together. P2 and P3 agree on the `/confirm` route interface. After this meeting, all four engineers work independently until integration day.

What must be agreed in this meeting:

- Signal response shape for each of the 6 APIs (P1 proposes, everyone approves)
- SSE event format — event names, data field names, all values (P2 proposes)
- `POST /confirm` request and response shape (P2 + P3 agree)
- Decision constants: exactly `APPROVE`, `CHALLENGE`, `BLOCK` — no variations
- Stage constants: exactly `interrogation`, `ai_decision`, `complete`

> P4 attends this meeting as a listener only. P4 needs the SSE event format and the decision constants. Once these are agreed, P4 hardcodes them into `mock-server.js` and builds the entire dashboard independently.

### Integration Order

| When | What happens |
|---|---|
| Day 1 morning | 30-minute sync. `shared/types.js` committed. All four engineers start building. |
| Day 1 — P1 + P2 + P4 | Build independently against mock data. No one is blocked. |
| Day 1 — P3 | Starts after the 30-min sync. Builds `/confirm` and USSD against P2's function signatures. |
| Day 2 — P4 switches | P4 changes environment variable from mock to real middleware. Dashboard connects to live SSE. |
| Day 2 — P3 integration | P3's `/confirm` route integrated into P2's `server.js`. End-to-end CHALLENGE flow tested. |
| Day 3 — Full integration | All four merge to main. Full Attack scenario run end-to-end. All 3 outcomes verified. |
| After Day 3 | P5 (mobile app) connects to the stable middleware endpoint. |

### The Three End-to-End Tests

Before integration is complete, run all three scenario tests. Every engineer must see all three pass.

| Test | Expected result |
|---|---|
| Scenario B — All Clear | 6 Nokia APIs fire in parallel → Claude approves → All signal cards illuminate → APPROVE badge → PaymentSimulator returns `txnId` → Dashboard shows frictionless payment |
| Scenario A — Location Challenge | 6 Nokia APIs fire in parallel → location mismatch fires → Claude returns CHALLENGE → 401 challenge → Biometric pass → PaymentSimulator returns `txnId` → Dashboard shows Verified & Paid |
| Scenario C — Full Attack | 6 Nokia APIs fire in parallel → all 6 signals fire → raw score 100 → Claude returns BLOCK → 403 forbidden → Dashboard shows human explanation → No payment proceeds |

---

## Environment Setup

Every engineer needs these steps before writing any code.

### Step 1 — Clone and install

```bash
git clone [repo-url] GuardLayer-monorepo
cd GuardLayer-monorepo
npm install
```

### Step 2 — Environment variables

```bash
cp .env.example .env
```

| Variable | Who needs it / where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | P2 — console.anthropic.com — free account, personal email works |
| `NOKIA_API_KEY` | P1 — developer.networkascode.nokia.io — free sandbox account |
| `MOCK_MODE` | Everyone — set to `true` until Nokia key is ready |
| `PORT` | P2 — default 3000, leave as-is |
| `DASHBOARD_PORT` | P4 — default 3001 for mock server |

### Step 3 — Run your part

| Role | Command |
|---|---|
| P1 | `npm run test:nokia` |
| P2 | `cd apps/middleware && npm run dev` |
| P3 | `cd apps/middleware && npm run dev` (same server as P2) |
| P4 | `cd apps/dashboard && npm run mock` |

### Git Workflow

- Main branch is protected — no direct pushes
- Each engineer works on their own branch: `p1/camara-apis`, `p2/ai-engine`, `p3/biometric-payment`, `p4/dashboard`
- Pull requests require one other engineer to review before merging
- Merge to main only after your deliverables checklist is complete
- Integration day: all four branches merge to main in order P1 → P2 → P3 → P4

---

## Quick Reference

### API Routes Summary

| Route | Owner | Purpose |
|---|---|---|
| `POST /api/transaction/check/stream` | P2 | Primary SSE agentic pipeline |
| `POST /api/transaction/check` | P2 | Legacy single-pass (used by USSD) |
| `POST /api/confirm` | P3 | Biometric result + payment trigger |
| `POST /api/ussd/simulate` | P3 | USSD session handler |
| `GET /api/simulator/log` | P3 | Session transaction history |
| `GET /api/health` | P2 | Status + config flags |

### SSE Event Types

| Event type | Payload fields |
|---|---|
| `stage` | `stage` (string), `message` (string) |
| `signal` | `api` (string), `result` (object per shared/types.js schema) |
| `raw_score` | `rawScore` (0–100), `triggeredSignals` (array), `triggeredCount`, `combinationMultiplierApplied` |
| `decision` | `decision` (APPROVE\|CHALLENGE\|BLOCK), `riskScore` (0–100), `explanation`, `reasoning`, `recommendedAction` |
| `complete` | `{}` empty object |
| `error` | `message` (string) |

### Scenario → Signal Mapping

| Scenario | SIM | Device | Number | Location | KYC | Congestion |
|---|---|---|---|---|---|---|
| `all_clear` | safe | safe | safe | safe | safe | normal |
| `recent_sim_swap` | recent | safe | safe | safe | safe | normal |
| `device_mismatch` | safe | new_device | safe | safe | safe | normal |
| `location_anomaly` | safe | safe | safe | mismatch | safe | normal |
| `network_attack_window` | recent | safe | safe | mismatch | safe | critical |
| `full_attack` | recent | new_device | spoofed | mismatch | mismatch | critical |
| `random` | random | random | random | random | random | random |

### Score → Decision Reference

| Raw score | Multiplier applies when | Decision zone |
|---|---|---|
| 0 – 30 | Never | APPROVE |
| 31 – 60 | 3+ signals fire (×1.2) | CHALLENGE |
| 61 – 100 | 3+ signals fire (×1.2) | BLOCK |
| Full Attack: 35+25+20+15+10+15 = 120 × 1.2 = 144 → clamped to | **100** | BLOCK |

---

*GuardLayer • Africa Ignite Hackathon • Nokia Network as Code • CAMARA APIs*