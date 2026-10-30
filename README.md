# Sadguru Survey Backend

Backend API service for the Sadguru Surveys transport and operations platform.  
This service handles authentication, fleet data, trip and fuel operations, ledger and transaction records, invoice workflows, file uploads, and dashboard analytics.

## Tech Stack

- Node.js (supported: `>=19.0.0 <=20.12.2`)
- TypeScript
- Express
- MongoDB with Mongoose
- JWT-based authentication
- AWS S3 for file storage

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create a `.env` file in the project root and set:

```env
PORT=3000
MONGO_URL=mongodb://localhost:27017/sadguru-survey
JWT_SECRET=your_jwt_secret

AWS_REGION=ap-south-1
AWS_S3_BUCKET_NAME=your_bucket_name
AWS_S3_ACCESS_KEY=your_access_key
AWS_S3_SECRET_KEY=your_secret_key
```

### 3) Run in development

```bash
npm run dev
```

### 4) Build and run production build

```bash
npm run build
npm start
```

## API Basics

- Base URL prefix: `/api/v1`
- Root health check: `GET /`
- Authentication: use `Authorization: Bearer <token>` for protected routes
- Most endpoints return JSON via shared response helpers

## Main API Modules

The service registers the following route groups:

- `/auth` - register/login/user profile and password/subscription updates
- `/vehicle` - vehicle CRUD, assignment views, and fuel validation helpers
- `/driver` - driver CRUD and active-driver listings
- `/fuel` - fuel logs, diesel add operation, and print views
- `/vendor` - vendor CRUD and lookup endpoints
- `/maintenance` - maintenance records and printable reports
- `/transaction` - transaction records and printing
- `/daily-log` - daily operational logs
- `/feature-flag` - feature toggles per user
- `/ledger` - ledger CRUD and listing helpers
- `/ledger-transaction` - ledger transaction entries
- `/lorry-receipt` - lorry receipt lifecycle and reporting
- `/invoice/lorry-receipt` - lorry receipt invoice creation and retrieval
- `/dashboard` - analytics and widget endpoints
- `/files` - document/logo uploads and deletions (S3-backed)
- `/local-trip` - local trip management and print/export operations
- `/other-organization` - other organization CRUD
- `/driver-fnf` - driver full-and-final settlement records
- `/driver-salary` - driver salary records
- `/market-truck-fuel` - market truck fuel entries and analytics helpers

## Project Structure (High Level)

- `index.ts` - app bootstrap, middleware setup, route registration
- `routes/` - API route definitions
- `controllers/` - request handlers and business logic
- `models/` - Mongoose schemas/models
- `middleware/` - auth and request middleware
- `setups/` - external service setup (MongoDB, S3)
- `utils/` - helper utilities (auth, responses, uploads, S3, etc.)

## Notes

- MongoDB connection is initialized at startup via `setups/mongo.ts`.
- Files are stored in S3; missing AWS variables will cause S3 setup failures.
- Keep `JWT_SECRET` private and rotate periodically.
