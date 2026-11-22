# DNX INDICATES

### Every Dividend. Every Opportunity. One Platform.

**DNX INDICATES** is a responsive Indian dividend-intelligence dashboard designed to help users explore dividend information, analyze companies, track corporate actions, and manage their personal watchlists and portfolios.

Built using **Next.js, React, TypeScript, Tailwind CSS, Lucide React, and Recharts**, the platform provides an interactive and user-friendly experience for dividend research and analysis.

---

## 🚀 Technology Stack

- **Framework:** Next.js
- **Frontend:** React
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Charts:** Recharts
- **Database Foundation:** PostgreSQL and Prisma
- **Deployment:** Vercel
- **Persistent Storage:** Vercel Blob

---

## ✨ Features

### Dashboard & Market Intelligence
- Interactive dividend dashboard.
- Dividend calendar and dividend screener.
- Company directory and company analysis pages.
- Corporate actions tracking.
- Interactive financial charts and visualizations.

### Dividend Tools
- Dividend calculator.
- Company comparison.
- Dividend yield analysis.
- Dividend event tracking.

### Portfolio Management
- Personal portfolio management.
- Stock watchlist.
- Profile and display preferences.
- Dark and light themes.

### Developer Console
- Private developer authentication.
- Company fundamentals editor.
- Manual dividend update editor.
- NSE and BSE corporate-action CSV import.
- Dividend announcement and payment date management.
- Source links for manually updated information.

---

## 💻 Run Locally

Follow these steps to run the project on your computer.

### 1. Clone the Repository

```bash
git clone https://github.com/Dnx-Op0/Dnx-Indicator.git
```

### 2. Open the Project

```bash
cd Dnx-Indicator
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Development Server

```bash
npm run dev
```

Open the following URL in your browser:

http://localhost:3000

### 5. Production Build

To create a production build:

```bash
npm run build
```

To start the production server:

```bash
npm start
```

To run ESLint:

```bash
npm run lint
```

---

## 🔐 Developer Console Setup

The project includes a private developer console for managing company records and dividend information.

### Phase 1: Configure Environment Variables

1. Copy `.env.example` to `.env.local`.
2. Generate a secure developer password hash:

```bash
node scripts/hash-developer-password.mjs
```

3. Copy the generated hash into `.env.local`:

```env
DNX_DEVELOPER_EMAIL=your-email@example.com
DNX_DEVELOPER_PASSWORD_HASH=your-generated-hash
DNX_DEVELOPER_SESSION_SECRET=your-random-secret
```

Use a random session secret containing at least 32 characters.

4. Restart the development server:

```bash
npm run dev
```

5. Open the developer login page:

http://localhost:3000/developer/login

### Security Features

- Signed developer sessions.
- HttpOnly cookies.
- SameSite-strict cookie protection.
- Eight-hour session expiration.
- Password verification using salted scrypt hashing.
- Protected developer routes.

The legacy `/owner` editor remains available for compatible installations.

**Important:** Never upload `.env`, `.env.local`, passwords, API keys, or session secrets to GitHub.

---

## 📊 Dividend Management

The developer dashboard provides separate editors for:

### Company Fundamentals
Manage existing company information and fundamentals.

### Manual Dividend Updates
Update the following information:

- Dividend per share.
- Dividend yield.
- Dividend type.
- Announcement date.
- Ex-dividend date.
- Record date.
- Payment date.
- Optional source links.

### Public Manual Updates Page

Every dividend saved through the manual editor is also listed publicly at `/manual-dividends` ("Manual Updates" in the sidebar). Visitors can search, filter by dividend type, sort, and export the entries to CSV. Each row shows the last-updated date and the source link, when one was provided, and is clearly labelled as manually entered and not independently verified.

### NSE & BSE CSV Import

The developer console supports importing official corporate-action CSV files.

Steps:

1. Download the appropriate equity dividend CSV from the official NSE or BSE website.
2. Open `/developer/dividends`.
3. Select the correct exchange.
4. Upload the CSV file.
5. Preview the imported information.
6. Select **Import and publish**.

The importer processes eligible dividend records, skips non-dividend entries and out-of-range dates, and preserves unavailable information instead of inventing values.

Dual-listed companies are maintained as separate exchange listings.

---

## 🗄️ Database & Storage

The project includes a PostgreSQL and Prisma database foundation for future scheduled dividend synchronization.

### Local Development

Local development currently uses:

```text
data/owner-data.json
```

### Production Deployment

The Vercel deployment uses a private Vercel Blob store connected to:

- Production
- Preview
- Development

Saved developer changes are shared with public dividend pages.

Manually edited information is marked accordingly and is not independently verified.

---

## ⏰ Scheduled Dividend Synchronization

The project includes:

- PostgreSQL database schema.
- Prisma integration.
- Protected manual synchronization endpoint.
- Protected cron endpoint.
- Synchronization history.
- Notification storage.
- Vercel Cron schedules.

### Database Configuration

1. Create a PostgreSQL database.
2. Add the database connection string:

```env
DATABASE_URL=your_database_connection_string
```

3. Configure the cron secret:

```env
CRON_SECRET=your_random_secret
```

4. Apply the database migration after the initial migration is available:

```bash
npm run db:migrate:deploy
```

5. Deploy the project to Vercel.

### Vercel Cron

On the Vercel Hobby plan, the configured full synchronization schedule runs once daily at 16:00 India time (10:30 UTC).

More frequent scheduled checks require a suitable paid Vercel plan.

### Current Synchronization Status

**The synchronization system is currently a foundation, not an active financial-data service.**

No authorized NSE, BSE, company, or licensed-provider data feed is currently connected.

Until an approved provider and its API credentials are configured:

- Synchronization runs remain `UNCONFIGURED`.
- Missing PostgreSQL configuration can return HTTP 503.
- No synchronization is reported as successful without a source response.
- Public financial figures remain illustrative demo data.

The connector is deliberately disabled until an authorized data source is approved.

---

## 📈 Live Market Data — Future Integration

DNX INDICATES is designed with the possibility of future integration with authorized financial-data providers.

Potential future capabilities include:

- Live NIFTY 50 data.
- BANK NIFTY and SENSEX.
- Individual stock prices.
- Live dividend
