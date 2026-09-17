# Life Plan Monitoring System

**Pre-Need Deathcare Plan Management & Financial Collection Platform**

A complete web application for tracking client contracts, recording payments, issuing official receipts, and monitoring delinquency status. Built for teams managing pre-need funeral plans in the Philippines.

![Terminal Theme](https://img.shields.io/badge/theme-terminal%20light-2d8a4e?style=flat-square)
![Convex](https://img.shields.io/badge/backend-Convex-2d8a4e?style=flat-square)
![React](https://img.shields.io/badge/frontend-React%2019-blueviolet?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

## Features

- **Client Management** — Track planholders, beneficiaries, contract details
- **Payment Collection** — Record payments via Cash, GCash, Maya, Bank Transfer, Check
- **Official Receipts** — Auto-generated receipts for every payment
- **Delinquency Tracking** — Dynamic 30/60/90/Lapsed status based on days since last payment
- **Dashboard** — Real-time stats on collections, active contracts, and delinquent accounts
- **Role-Based Access** — CEO, Manager, Finance Staff, Cashier roles
- **Responsive Design** — Works on desktop and mobile browsers

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui |
| Backend | Convex (real-time database + serverless functions) |
| Auth | Convex Auth (email OTP + anonymous) |
| Styling | Terminal light theme, monospace typography |
| Build | Bun, TypeScript strict mode |

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- A [Convex](https://convex.dev/) account (free tier works)

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/evangelist-funeral-services.git
cd evangelist-funeral-services
bun install
```

### 2. Set Up Convex

```bash
bun convex dev
```

This will:
- Create a free Convex project
- Push the schema to your database
- Start the dev server

Follow the CLI prompts to link your project.

### 3. Open the App

The dev server runs at `http://localhost:5173`. Open it in your browser.

### 4. Create Your First Account

1. Go to the app URL
2. Enter your email to receive a verification code
3. Enter the OTP code
4. You're in! Your first account defaults to the CEO role.

## Project Structure

```
evangelist-funeral-services/
├── src/
│   ├── convex/                    # Backend (Convex functions)
│   │   ├── schema.ts              # Database schema & validators
│   │   ├── users.ts               # User queries (auth, roles)
│   │   ├── clients.ts             # Client CRUD + delinquency
│   │   ├── contracts.ts           # Contract management
│   │   ├── payments.ts            # Payment recording
│   │   ├── receipts.ts            # Receipt queries
│   │   ├── dashboard.ts           # Dashboard aggregations
│   │   ├── auth.ts                # Auth providers
│   │   ├── auth.config.ts         # Auth configuration
│   │   └── http.ts                # HTTP routes
│   ├── pages/                     # Page components
│   │   ├── Landing.tsx            # Public landing page
│   │   ├── Auth.tsx               # Sign-in / sign-up
│   │   ├── Dashboard.tsx          # Stats overview
│   │   ├── Clients.tsx            # Client list (30/60/90/Lapsed tabs)
│   │   ├── ClientDetail.tsx       # Client profile & payment history
│   │   ├── Contracts.tsx          # Contracts list
│   │   ├── Payments.tsx           # Payment recording
│   │   └── Receipts.tsx           # Receipt list & detail
│   ├── components/
│   │   ├── AppLayout.tsx          # Responsive sidebar / bottom nav
│   │   ├── ScrollableTable.tsx    # Mobile table wrapper
│   │   └── RequireAuth.tsx        # Auth guard
│   ├── hooks/
│   │   └── use-auth.ts            # Auth hook
│   ├── main.tsx                   # App entry + routing
│   └── index.css                  # Terminal theme tokens
├── LICENSE                        # MIT License
├── README.md                      # This file
└── package.json                   # Dependencies
```

## Database Schema

### Enums

```typescript
contract_status: 'current' | 'delinquent_30' | 'delinquent_60' | 'delinquent_90' | 'lapsed' | 'fully_paid' | 'assigned_death_claim'
payment_channel: 'cash' | 'gcash' | 'maya' | 'bank_transfer' | 'check'
receipt_status: 'active' | 'exhausted' | 'cancelled'
```

### Tables

| Table | Description |
|-------|------------|
| `users` | User accounts with roles (CEO, Manager, Finance Staff, Cashier) |
| `clients` | Planholders with personal, contact, and beneficiary info |
| `contracts` | Payment plans tied to clients with amortization tracking |
| `payments` | Individual payment records with channel and reference details |
| `receipts` | Official receipts auto-generated from payments |

## Delinquency Logic

Status is computed dynamically based on days since the last payment:

| Days Since Payment | Status |
|-------------------|--------|
| 0–30 days | Current |
| 31–60 days | 30 Days Late |
| 61–90 days | 60 Days Late |
| 91–120 days | 90 Days Late |
| 120+ days | Lapsed |

Fully paid contracts and death claims retain their stored status.

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] SMS/email notifications for delinquent clients
- [ ] CSV/Excel export for payments and receipts
- [ ] Bulk status transitions (30→60→90→Lapsed)
- [ ] Penalty/interest calculations
- [ ] Agent commission tracking
- [ ] Multi-branch support
- [ ] Print-optimized receipt layout

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Convex](https://convex.dev/) — Real-time backend
- [shadcn/ui](https://ui.shadcn.com/) — Component library
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS
- [Lucide](https://lucide.dev/) — Icons
- [freebuff.com](https://freebuff.com) — Platform
