# HEFS — Higher Education Finance System (Frontend)

نظام المالية الجامعية — واجهة المستخدم

A staff-facing web application for **university tuition billing and cash collection**, deployable as a **public web app** (Docker + HTTPS) or over a **university LAN**. This repository contains the **frontend** (Astro + vanilla JavaScript); the backend (FastAPI + PostgreSQL) lives in the `StudentManagementSystem` repo.

> Graduation project, 2-developer team: this repo = frontend; a teammate builds the FastAPI backend. The two communicate through a documented API contract that the frontend mocks today and swaps to the live server with a single config change.

---

## ✨ Features

The app implements 8 screens, Arabic-only (RTL):

| # | Screen | Route |
| :- | :-- | :-- |
| 1 | Student account + ongoing-semester payment | `/students/account?id=` |
| 2 | Register new student | `/students/new` |
| 3 | Dashboard (role-based) | `/` |
| 4 | Start new semester + first payment | `/students/start-semester?id=` |
| 5 | Reports (quick + custom ranges, CSV export, print) | `/reports` |
| 6 | Printable / reprintable receipt | `/receipts/view?id=` |
| 7 | Admin hub — majors / semesters / staff (manager-gated) | `/admin` |
| 8 | Login | `/login` |

Plus a student search/list page at `/students`.

Highlights:
- **Cashier flow** — enroll, take payments (overpayment blocked), and print an official receipt (two copies: student + office).
- **Debt enforcement** — a student cannot start a new semester while a previous one is unpaid.
- **Live cost breakdown** — `courses × course_price + base_fee`, computed client-side to match the backend.
- **Reports** — daily / weekly / monthly / custom range, with vanilla CSV export (UTF-8 BOM for Arabic in Excel) and print.
- **Role-based access** — `employee` < `manager` < `superadmin`; the Admin hub is manager-gated.
- **RTL + offline** — `dir="rtl"`, CSS logical properties, self-hosted Arabic font (Cairo), currency in Libyan Dinar (`د.ل`).

---

## 🧱 Tech stack

- **Astro 7** in `static` (SSG) mode — deployed as a `dist/` folder.
- **Vanilla JavaScript** `<script>` islands (DOM-based, no UI framework, no TypeScript).
- **Plain CSS** with design tokens (CSS variables) and Astro scoped styles.
- **Mock-first API** — works fully without a backend; swaps to the live FastAPI server via config.

---

## 🏗️ Architecture

Pages never call `fetch` directly. All data access flows through a small **API service layer**:

```
page  →  endpoints.js  →  client.js  →  ┌─ mock/  (in-browser fake backend)
        (named calls)    (one HTTP      └─ live FastAPI server
                          client)
```

- **`src/lib/api/endpoints.js`** — the single API surface: named functions (`getStudent`, `createPayment`, …). Pages import only from here.
- **`src/lib/api/client.js`** — the single HTTP client: adds the base URL, sends the HttpOnly auth cookies (`credentials: 'same-origin'`), transparently refreshes the session on `401` and retries once, parses JSON, throws a uniform `ApiError`. Routes to the mock or the live server based on config.
- **`src/lib/api/mock/`** — an in-memory backend persisted to `localStorage`, enforcing the real business rules (overpayment block, debt check, role protection, date validation) so the UI behaves exactly as it will against the real API.
- **`src/lib/config.js` + `public/config.json`** — runtime configuration kept *outside* the build, so the same `dist/` can be re-pointed at any LAN server by editing one file.
- **`src/lib/auth.js`** — session helpers: the tokens live in **HttpOnly cookies** set by the backend (unreadable by JS); only the non-sensitive current user is cached in `localStorage`. `requireAuth(minRole)` route guards (UX only — the backend enforces real auth).
- **`src/lib/money.js`** — the single source of truth for cost / paid / remaining / fully-paid (mirrors the backend formulas).

> Pattern: an **API service layer** built as a **facade** over `fetch`, with the mock and live backends as interchangeable **adapters** selected by config (dependency inversion) — so the UI depends on no concrete backend.

### Project structure

```
public/
  config.json              # { apiBaseUrl, currency, useMock } — editable AFTER build
src/
  layouts/                 # BaseLayout, AuthLayout, PortalLayout (auth guard + shell)
  components/              # Sidebar, Topbar, ReceiptView, ReceiptModal
  pages/                   # the 8 screens (see table above)
  lib/
    config.js  auth.js  format.js  money.js  receipt.js
    api/
      client.js  endpoints.js
      mock/index.js  mock/fixtures.js
  styles/                  # tokens.css (design tokens) + global.css
```

---

## 🚀 Getting started

Requires **Node ≥ 22.12**.

```sh
npm install        # install dependencies
npm run dev        # dev server (http://localhost:4321)
npm run build      # build static site to dist/
npm run preview    # preview the production build
```

The app starts in **mock mode**, so it runs end-to-end with no backend.

### Demo logins (mock mode)

Any password works for these seeded usernames:

| Username | Role |
| :-- | :-- |
| `root_admin` | superadmin |
| `sjenkins_fin` | manager |
| `msalem` | employee |

---

## ⚙️ Configuration

Edit `public/config.json` (and, after building, `dist/config.json`):

```json
{
  "apiBaseUrl": "http://localhost:8000",
  "currency": "LYD",
  "useMock": true
}
```

- **`useMock`** — `true` uses the in-browser mock; set `false` to talk to the live backend.
- **`apiBaseUrl`** — the FastAPI server address (include the `/api/v1` prefix here if the backend uses one).
- **`currency`** — `LYD` (د.ل) by default.

Because this file lives outside the build, the **same `dist/` build** can be deployed to any LAN machine and re-pointed by editing `config.json` — no rebuild required.

---

## 📦 Deployment

**Full app (recommended)** — the frontend, backend, and PostgreSQL run together
with Docker Compose from the parent project folder. The frontend is built and
served by nginx (which also proxies `/api`), and `config.json` is generated with
`useMock:false` automatically. See **`../PRODUCTION.md`** (VPS + domain + HTTPS)
or **`../DOCKER.md`** (local / LAN).

**Standalone static build** — build and serve `dist/` with any static server:

```sh
PUBLIC_BASE_PATH=/ npm run build     # base '/' for root hosting
npx serve -s dist -l 3000
```

`base` is env-driven in `astro.config.mjs`: default `/uni-graduation` (GitHub
Pages), or set `PUBLIC_BASE_PATH=/` for root hosting. Then edit `dist/config.json`
to point `apiBaseUrl` at the backend and set `useMock:false` — editable after the
build, no rebuild needed.

---

## 🔌 API contract

The mock encodes the expected request/response shapes for the backend. The full surface is in `src/lib/api/endpoints.js` — share it with the backend developer. A few endpoints were added beyond the original spec to support the designed screens (student CRUD, majors/semesters/staff CRUD, custom-range reports, password reset); confirm exact paths/prefix with the backend early.

---

## 📝 Notes & trade-offs

- **Client-side role guards are UX only.** The backend must enforce auth and roles on every request.
- **Auth tokens live in HttpOnly cookies** (set by the backend, with refresh rotation + revocation) — JavaScript cannot read them, so an XSS bug can't steal the session. Only the non-sensitive user object is cached in `localStorage` for rendering.
- **Arabic-only / RTL** by design; numbers use Western digits with Arabic month names.
- Planning/reference docs (`DRD.md`, `PLAN.md`, …) are intentionally git-ignored.
