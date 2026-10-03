# AK Retail POS - Abr e Karam Fabrics

A modern retail Point of Sale system built with React, TypeScript, and Supabase.

## Features

- 🛒 Point of Sale (Counter Sale & Delivery Sale)
- 📦 Product Management with Barcode Scanning
- 📊 Inventory Management
- 🏷️ Label Printing (TSC TTP 244 Pro)
- 👥 Customer Management
- 📈 Sales Reports
- 👤 User Management & Permissions
- 💳 Multiple Payment Methods (Cash, Card, IBFT, Mixed, Credit)
- 🔄 Returns & Exchange (With/Without Invoice)
- 💰 Expense Tracking
- 📅 Day Closing / Cash Reconciliation
- 🧾 FBR Integration (Dual Invoice Numbers)
- 🏪 Multi-store Support (Future)
- 🌐 Online Ordering Integration (Future)

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query
- **Backend**: Supabase (PostgreSQL + Auth)
- **Routing**: React Router v6

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/khizar7878/ak-retail-pos.git
cd ak-retail-pos
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Update `.env` with your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Database Setup

1. Create a new Supabase project
2. Run the migrations in `supabase/migrations` folder
3. Set up RLS policies
4. Seed initial data

## Deployment

The app can be deployed to Vercel, Netlify, or any static hosting service.

```bash
npm run build
```

## License

Private - All Rights Reserved

## Contact

For support or inquiries, contact: [Your Contact Info]
