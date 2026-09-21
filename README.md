# FLARE — Financial Ledger Anomaly & Reconciliation Engine

A full-stack MERN application that ingests financial transaction records from
multiple simulated source systems, reconciles them against each other,
surfaces discrepancies as investigable exceptions, and keeps an audit trail
of everything that happened. Built as a MERN-stack learning assignment,
designed to double as a resume-worthy portfolio project.

> All financial data in this project is fictional/simulated. FLARE does not
> connect to any real bank, payment processor, or financial credentials, and
> makes no claim to real banking-grade security or regulatory compliance.

---

## Table of contents

- [Problem statement](#problem-statement)
- [Solution](#solution)
- [Features](#features)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Database models](#database-models)
- [Reconciliation logic](#reconciliation-logic)
- [API overview](#api-overview)
- [Security](#security)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [MongoDB setup](#mongodb-setup)
- [Seed data](#seed-data)
- [Deployment](#deployment)
- [Testing](#testing)
- [Assignment requirement mapping](#assignment-requirement-mapping)
- [Limitations & future improvements](#limitations--future-improvements)

---

## Problem statement

Organizations keep financial records across multiple systems — internal
ledgers, bank feeds, payment gateways, invoice systems, settlement systems.
The same financial event often looks slightly different in each system:
amounts drift, dates shift by a day, statuses disagree, records go missing,
or the same record gets uploaded twice. Manually cross-checking these is
slow and error-prone. FLARE automates the comparison, flags what doesn't
line up, and gives an analyst a workflow to investigate and resolve it.

## Solution

FLARE implements the pipeline: **ingest → reconcile → flag exceptions →
investigate/resolve → audit**.

1. Records are entered manually or imported in bulk via CSV.
2. A reconciliation pass compares "unmatched" records against each other
   using a multi-signal scoring algorithm, across different source systems.
3. Discrepancies (amount/date/status mismatches, duplicates, missing
   counterparts) automatically become **Exceptions**.
4. Analysts assign, annotate, and resolve exceptions through a dedicated
   workflow.
5. Every meaningful action is written to an append-only **AuditLog**.
6. A dashboard aggregates all of this into live metrics, backed by real
   MongoDB queries (no mock numbers).

## Features

- Email/password authentication with JWT, password hashing, protected routes
- Full CRUD on financial records, with search, filter (source system, status,
  reconciliation status, date range), sort, and pagination
- Explainable reconciliation engine with a weighted confidence score
- Automatic exception creation for every discrepancy type
- Exception workflow: assign, add investigation notes, change status
  (open → investigating → resolved/dismissed)
- CSV import pipeline: upload → validate → parse → normalize → dedupe → insert → summary
- Append-only audit log of every important action, viewable and filterable in the UI
- Dashboard with live metrics, a reconciliation-runs trend chart, and an
  exceptions-by-category breakdown

## Architecture

```
flare/
├── backend/                 Node.js + Express REST API
│   ├── server.js            Entry point
│   └── src/
│       ├── config/          MongoDB connection
│       ├── models/          Mongoose schemas (User, Transaction, Reconciliation, Exception, AuditLog)
│       ├── middleware/      auth (JWT), centralized error handler, validation
│       ├── controllers/     request handlers per resource
│       ├── routes/          Express routers per resource
│       └── services/        business logic (reconciliation engine, CSV import, audit logging)
│   ├── seed/                 seed script with realistic fictional data
│   └── tests/                 Jest + Supertest + mongodb-memory-server
│
├── frontend/                 React (Vite) SPA
│   └── src/
│       ├── api/               axios client with JWT interceptor
│       ├── context/           AuthContext (React Hooks, no Redux needed)
│       ├── components/        TransactionList/Item/Form, ExceptionList/Item, Dashboard, Layout
│       └── pages/              route-level pages (Login, Register, Dashboard, Transactions, Exceptions, Import, Audit)
│
├── sample-data/               sample_transactions.csv for testing CSV import
└── render.yaml                 optional one-click Render blueprint for the backend
```

The frontend never talks to MongoDB directly — it only calls the REST API.
The backend is the single source of truth and the only thing with database
credentials.

## Technology stack

**Frontend:** React 18 (functional components + Hooks), React Router,
Axios, Recharts (dashboard charts), plain CSS (no framework, kept simple
and self-contained), Vite (build tool).

**Backend:** Node.js, Express.js, Mongoose, JSON Web Tokens, bcryptjs,
express-validator, helmet, cors, express-rate-limit, multer (CSV upload),
csv-parse.

**Database:** MongoDB (local or MongoDB Atlas).

**Testing:** Jest, Supertest, mongodb-memory-server (in-memory Mongo, no
external DB needed to run tests).

No Kafka, Redis, Kubernetes, or microservices — this is intentionally kept
a single well-organized MERN application, per the assignment's scope.

## Database models

| Model | Purpose |
|---|---|
| **User** | Registered analysts. Password is bcrypt-hashed, never returned in API responses. |
| **Transaction** | One financial record as it appears in one source system (`internal_ledger`, `bank_feed`, `payment_gateway`, `invoice_system`, `settlement_system`). Carries its own `reconciliationStatus` (`unmatched` / `matched` / `exception`). |
| **Reconciliation** | The outcome of comparing two transactions (or one transaction with no counterpart) during a run: `matchType`, `confidenceScore`, and the individual `signals` that produced it. |
| **Exception** | A discrepancy that needs human attention: category, severity, status, related transactions, discrepancy amount, assignment, investigation notes, resolution. |
| **AuditLog** | Append-only record of every significant action (login, CRUD, import, reconciliation run, exception lifecycle events). |

All models use Mongoose schemas with required fields, enum validation,
timestamps, and indexes on fields used for lookups/filtering
(`referenceId`, `sourceSystem`, `reconciliationStatus`, `status`, etc.).

## Reconciliation logic

Implemented in [`backend/src/services/reconciliationEngine.js`](backend/src/services/reconciliationEngine.js).

For every `unmatched` transaction, the engine looks for the best-scoring
candidate from a **different** source system, using five weighted signals:

| Signal | Weight | Rule |
|---|---|---|
| Reference match | 35 | Normalized `referenceId` is identical |
| Amount match | 30 | Within 1% tolerance |
| Date match | 15 | Within 1 day |
| Counterparty match | 10 | Normalized string similarity ≥ 0.6 |
| Status match | 10 | Both records report the same status |

The weighted sum (0–100) is the **confidence score**. A score ≥ 90 with
reference, amount, and date all matching becomes an `exact_match`. Lower
scores are classified by *which* signal disagreed (`amount_mismatch`,
`date_mismatch`, `status_mismatch`). Two records in the **same** source
system with the same reference/amount/date are flagged as a `duplicate`.
No viable candidate anywhere → `missing_counterpart`. Every mismatch or
duplicate automatically creates an `Exception` carrying the exact signals
that led to it — the logic is fully inspectable from the UI, not a black box.

## API overview

All routes are prefixed with `/api`. Protected routes require
`Authorization: Bearer <token>`.

| Method | Route | Description |
|---|---|---|
| POST | `/auth/register` | Create an account |
| POST | `/auth/login` | Log in, returns JWT |
| GET | `/auth/me` | Current user |
| GET/POST | `/transactions` | List (search/filter/sort/paginate) / create |
| GET/PUT/DELETE | `/transactions/:id` | Read / update / delete one record |
| POST | `/reconciliation/run` | Trigger a reconciliation pass |
| GET | `/reconciliation`, `/reconciliation/:id` | Inspect past runs |
| GET | `/exceptions`, `/exceptions/:id` | List / inspect exceptions |
| PATCH | `/exceptions/:id/assign` | Assign to a user |
| PATCH | `/exceptions/:id/status` | Change status / resolve / dismiss |
| POST | `/exceptions/:id/notes` | Add an investigation note |
| POST | `/import/csv` | Upload a CSV (`multipart/form-data`, field `file`) |
| GET | `/audit` | Filterable audit trail |
| GET | `/dashboard/summary` | Aggregated live metrics |
| GET | `/health` | Health check (no auth) |

## Security

- Passwords hashed with bcrypt before storage
- JWT-based authentication, verified on every protected route
- Role field (`analyst` / `admin`) with an `authorize()` middleware hook for
  future role-gated routes
- Input validation via `express-validator` on write endpoints
- `helmet` for standard security headers, `cors` restricted to configured
  origins, `express-rate-limit` on the API
- No secrets committed — `.env.example` provided, `.env` gitignored
- Centralized error handler that never leaks stack traces to the client

This is production-*style* practice for a learning project, not an audited,
compliance-grade financial system — see [Limitations](#limitations--future-improvements).

## Local setup

**Prerequisites:** Node.js 18+, npm, a MongoDB instance (local or Atlas).

```bash
# 1. Backend
cd backend
cp .env.example .env        # then edit MONGO_URI / JWT_SECRET
npm install
npm run seed                # optional but recommended - creates demo data
npm run dev                 # starts on http://localhost:5000

# 2. Frontend (in a second terminal)
cd frontend
cp .env.example .env        # VITE_API_BASE_URL should point at the backend
npm install
npm run dev                 # starts on http://localhost:5173
```

Then open `http://localhost:5173`, log in with the seeded demo account
(`analyst@flare.demo` / `password123`), and click **"Run reconciliation
pass"** on the dashboard to generate exceptions from the seed data.

## Environment variables

**backend/.env** (see `backend/.env.example`):

| Variable | Description |
|---|---|
| `PORT` | Backend port (default 5000) |
| `NODE_ENV` | `development` / `production` / `test` |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string used to sign JWTs |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` |
| `CLIENT_ORIGIN` | Comma-separated allowed CORS origins |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | API rate limiting |

**frontend/.env** (see `frontend/.env.example`):

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API, e.g. `http://localhost:5000/api` |

## MongoDB setup

- **Local:** install MongoDB Community Edition, run `mongod`, use
  `mongodb://127.0.0.1:27017/flare` as `MONGO_URI`.
- **Atlas (recommended for deployment):** create a free cluster at
  [mongodb.com/atlas](https://www.mongodb.com/atlas), create a database
  user, allow your IP (or `0.0.0.0/0` for quick testing), and copy the
  connection string into `MONGO_URI`.

## Seed data

```bash
cd backend
npm run seed
```

This wipes and repopulates the database with one demo user and a set of
fictional transaction pairs specifically constructed to exercise every
reconciliation case: exact matches, amount mismatches, date mismatches,
status mismatches, duplicates, and missing counterparts, spread across all
five source systems. Run a reconciliation pass afterward (from the
dashboard, or `POST /api/reconciliation/run`) to see Exceptions get created.

A `sample-data/sample_transactions.csv` file is also included for manually
testing the CSV import flow.

## Deployment

Suggested split (each piece deploys independently):

- **Frontend (React/Vite):** Vercel or Netlify. `frontend/vercel.json` is
  included for SPA routing on Vercel. Set `VITE_API_BASE_URL` to your
  deployed backend's `/api` URL as a build-time environment variable.
- **Backend (Express):** Render or Railway. `render.yaml` is included as an
  optional one-click Render blueprint (`rootDir: backend`). Set
  `MONGO_URI`, `JWT_SECRET`, and `CLIENT_ORIGIN` (your deployed frontend's
  origin) as environment variables on the host.
- **Database:** MongoDB Atlas.

No deployment has been performed as part of this deliverable — the project
is structured and configured so you can deploy it yourself.

## Testing

```bash
cd backend
npm test
```

Tests run against an in-memory MongoDB instance (`mongodb-memory-server`),
so no external database is required. Coverage includes:

- Registration, login, duplicate-email rejection, protected-route access (`tests/auth.test.js`)
- Transaction CRUD, validation, search, pagination (`tests/transaction.test.js`)
- Reconciliation engine unit logic — exact match, amount/date/status
  mismatch classification, duplicate detection — plus an end-to-end API
  test that runs a full reconciliation pass and asserts the resulting
  exceptions (`tests/reconciliation.test.js`)

As requested, tests were written but not executed in this environment;
run `npm test` after `npm install` to verify.

## Assignment requirement mapping

The table below maps every requirement from the attached MERN assignment
documentation to its implementation in FLARE.

| Assignment requirement | FLARE implementation |
|---|---|
| React state: `todos` array, `newTodo` string | `TransactionList` holds the records array in state; `TransactionForm` holds form state via `useState`, field-by-field (`referenceId`, `amount`, etc. instead of a single `newTodo` string, since financial records need multiple fields) |
| `componentDidMount` → GET request to fetch tasks | Implemented with `useEffect` in `TransactionList.jsx` (assignment explicitly allows/expects the Hooks equivalent rather than a class component) |
| Update state with retrieved data | `setTransactions(res.data.data)` in `TransactionList.jsx` |
| `handleInputChange` or/for user input | `TransactionForm.jsx` → `handleInputChange` |
| `handleSubmit`: validate, build object, POST, update state, reset input | `TransactionForm.jsx` → `handleSubmit`; empty/invalid input shows an inline error and returns early; on success calls `onSubmit` (wired to `POST /transactions`) and resets the form |
| Render UI: list, input field, add button | `TransactionsPage` → `TransactionList` (table) + `TransactionForm` (fields + submit button) |
| Map through array to render each item | `transactions.map(...)` rendering `TransactionItem` rows in `TransactionList.jsx` |
| **Frontend components:** App, Task List, Task Item, Task Form | `App.jsx`, `TransactionList.jsx`, `TransactionItem.jsx`, `TransactionForm.jsx` (plus `ExceptionList`/`ExceptionItem`/`Dashboard` for the extended domain) |
| Fetching tasks from backend | `GET /api/transactions` called from `TransactionList.jsx` |
| Adding a new task | `POST /api/transactions` called from `TransactionForm.jsx` via `TransactionList.jsx` |
| Handling user input for tasks | Controlled inputs + `handleInputChange` throughout `TransactionForm.jsx` |
| **Backend:** API endpoints for fetching/adding tasks | Full REST API in `backend/src/routes/*` — see [API overview](#api-overview); goes beyond fetch/add to full CRUD + reconciliation + exceptions + audit + import |
| Backend: connecting to MongoDB | `backend/src/config/db.js`, called from `server.js` on boot |
| **Database:** schema + model for tasks | `Transaction` Mongoose model (`backend/src/models/Transaction.js`), plus `User`, `Reconciliation`, `Exception`, `AuditLog` models for the extended domain |
| Storing task data with the schema | All writes go through Mongoose models — no in-memory/mock arrays are used as a data source anywhere in the backend |
| CRUD operations for tasks | `backend/src/controllers/transactionController.js`: full Create/Read/Update/Delete, plus search/filter/sort/pagination beyond the assignment's minimum |
| "Convert a previous React/Node project into MERN" | No prior project existed to convert (noted in the original request), so FLARE was built from scratch while satisfying every structural requirement the conversion exercise is meant to teach (Todo → Transaction domain mapping is explicit throughout this table) |

## Limitations & future improvements

- The reconciliation engine's weights/thresholds are reasonable defaults
  for a demo, not tuned against real-world financial data.
- No real-time updates (e.g. WebSockets) — the dashboard and lists refetch
  on demand rather than pushing live updates.
- Role-based authorization (`authorize()` middleware) exists but isn't yet
  applied to restrict any route to `admin` only — every authenticated user
  currently has the same permissions.
- CSV import currently only recognizes one fixed column schema; a
  column-mapping UI would make it usable with arbitrary bank export formats.
- No pagination on the exception "related transactions" or "notes" arrays
  (fine at demo scale, would need attention at high volume).
- This is a portfolio/learning project: it is **not** audited for real
  financial or regulatory use, and should never be pointed at real banking
  credentials or live financial accounts.
