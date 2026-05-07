#  P3: Biometric Escalation & Payment Simulation Layer

This document records **P3 — Biometric Verification and Payment Fulfillment** as implemented on the middleware service. That layer handles post-check **confirmation**: when the overall risk posture requires escalation, it chooses the verification path based on **device capability** (smartphone liveness vs. feature-phone USSD), then—for approved flows—runs a **mock STK Push** payment simulator.

**Primary route:** `POST /confirm` in `apps/middleware/server.js` (default base URL `http://localhost:3000` unless `PORT` is set).

---

##  Test Credentials

Use these JSON bodies in **Postman**, **REST Client**, or **cURL** against `POST http://localhost:3000/confirm` (`Content-Type: application/json`).

| Scenario | JSON Body | Expected Result |
| :--- | :--- | :--- |
| **1. Trigger Selfie** | `{"phoneNumber": "27677159301", "amount": 100, "isFeaturePhone": false}` | **401 Unauthorized** · `action`: `SMILE_ID_LIVENESS` · Body explains biometric verification required |
| **2. Verify & Pay** | `{"phoneNumber": "27677159301", "amount": 100, "bio_token": "mock_token_123"}` | **200 OK** · `status`: `Completed` · `txn_id` present · `message`: payment success |
| **3. USSD Fallback** | `{"phoneNumber": "27677159301", "amount": 100, "isFeaturePhone": true}` | **200 OK** · `action`: `PIN_CHALLENGE` · PIN / USSD messaging |

### Example cURL (smartphone → liveness)

```bash
curl -s -X POST http://localhost:3000/confirm \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumber\":\"27677159301\",\"amount\":100,\"isFeaturePhone\":false}"
```

### Example cURL (with bio token → STK simulator)

```bash
curl -s -X POST http://localhost:3000/confirm \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumber\":\"27677159301\",\"amount\":100,\"bio_token\":\"mock_token_123\"}"
```

### Example cURL (feature phone → PIN challenge)

```bash
curl -s -X POST http://localhost:3000/confirm \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumber\":\"27677159301\",\"amount\":100,\"isFeaturePhone\":true}"
```

---

## Functional Logic

- **Biometric challenge (smartphone):** If the client is **not** on a feature phone and **no** `bio_token` is supplied, the middleware returns **401** with `SMILE_ID_LIVENESS`, aligned with initiating a **Smile ID SmartSelfie-style liveness** step on the client before re-calling `/confirm` with a token.
- **USSD fallback (feature phone):** If `isFeaturePhone` is strictly `true`, the server does not require a selfie path; it returns **200** with `PIN_CHALLENGE` and a USSD-oriented message for **financial inclusion** on basic handsets.
- **Payment simulation:** When a `bio_token` is present (happy path after liveness), the handler calls **`processSTKPush(phoneNumber, amount)`**, which models **M-Pesa-style STK Push** latency and returns a synthetic **`txn_id`** plus `status: Completed`.

**Evaluation order on `/confirm`:** `isFeaturePhone === true` → PIN challenge; else missing `bio_token` → liveness **401**; else run STK simulator and return **200** with transaction fields.

**Observability:** Each branch logs a short **“agentic”** line to the terminal (incoming payload summary, decision, STK start/finish) for demo visibility.

---

## Components

| Path | Role |
| :--- | :--- |
| `apps/middleware/server.js` | Registers **`POST /confirm`**, wires imports, implements the decision tree above. |
| `apps/middleware/src/biometric/smileId.js` | **`verifyBiometricSession(userData)`** — mock Smile ID session (2s delay; feature phone → `PIN_CHALLENGE`; else approved mock token). Imported on the server for hackathon integration and logging; client flow uses `bio_token` on `/confirm` for the pay path. |
| `apps/middleware/src/payment/paymentSimulator.js` | **`processSTKPush(phoneNumber, amount)`** — async mock STK Push (~3s delay), returns `status` and `txn_id`. |
| `apps/middleware/src/biometric/tokenValidator.js` | Placeholder for future server-side token validation against Smile ID sandbox credentials (currently empty). |

---

## Tasks Completed (implementation checklist)

1. **Mock Smile ID surface** — `verifyBiometricSession` in `smileId.js` with simulated processing delay and feature-phone vs. approved outcomes.
2. **`POST /confirm`** — Unified HTTP contract for liveness escalation, USSD PIN pivot, and post-token payment simulation.
3. **STK Push simulator** — `paymentSimulator.js` fulfills the payment step with realistic wait and generated `txn_id`.
4. **Demo logging** — Structured `console.log` steps on `/confirm` for live terminal narration.

---

## Next Steps (optional hardening)

- Flesh out **`tokenValidator.js`** to validate `bio_token` against real Smile ID sandbox responses before calling `processSTKPush`.
- Add automated **end-to-end tests** covering all three `/confirm` outcomes (aligned with hackathon acceptance criteria).

---

## Relation to Other Parts

- **P1 / P2** continue to own transaction **check** pipelines (`/api/transaction/check`, streaming variant). **P3** focuses on **confirm / fulfill** after a challenge or high-risk branch, without changing the core risk-scoring APIs.
