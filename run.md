# GuardLayer: How to Run the Application

## Overview

GuardLayer is a monorepo consisting of three main applications that work together:

1. **Middleware** (Node.js/Express) - Core fraud detection engine
2. **Dashboard** (React/Vite) - Real-time monitoring and visualization
3. **Payment App** (React Native/Expo) - Mobile payment application

## Prerequisites

- **Node.js** v18+
- **npm** (comes with Node.js)
- **.env file** with required API keys (see [Setup](#setup))

## Initial Setup

### 1. Install Dependencies

```bash
# Install all monorepo dependencies
npm install
```

This will install dependencies for:
- Root workspace
- `apps/middleware`
- `apps/dashboard`
- `payment-app`
- `packages/shared`

### 2. Environment Configuration

Create a `.env` file in the project root with the following variables:

```env
# Nokia Network as Code (CAMARA)
NOKIA_API_KEY=your_nokia_api_key_here
NOKIA_API_URL=https://sandbox.network-as-code-prod.nokia.io

# Claude AI
CLAUDE_API_KEY=your_anthropic_api_key_here

# Middleware
MIDDLEWARE_PORT=3001

# Testing
TEST_PHONE_NUMBER=+1234567890
```

> **Note:** Get your Nokia API Key from [developer.networkascode.nokia.io](https://developer.networkascode.nokia.io)

## Running the Application

### Option 1: Run All Services Concurrently (Recommended)

```bash
npm run dev:all
```

This starts:
- ✅ **Middleware** on `http://localhost:3001`
- ✅ **Dashboard** on `http://localhost:5173`
- ✅ **Payment App** on `http://localhost:8081` (Expo)

### Option 2: Run Individual Services

#### Middleware Only
```bash
npm run dev:middleware
# or
npm run dev --workspace=@guard-layer/middleware
```
Server runs on `http://localhost:3001`

#### Dashboard Only
```bash
npm run dev:dashboard
# or
npm run dev --workspace=@guard-layer/dashboard
```
Server runs on `http://localhost:5173`

#### Payment App Only
```bash
npm run dev:mobile
# or
cd payment-app && npm start
```
Expo Metro bundler starts on `http://localhost:8081`

### Option 3: Run Dashboard + Middleware

```bash
npm run dev
```

This uses Turbo to run both dashboard and middleware in parallel.

## Accessing the Applications

### Middleware API
- **Base URL:** `http://localhost:3001`
- **POST /initiate** - Initiate a transaction and get fraud assessment
- **POST /confirm** - Confirm biometric challenge

Example request:
```bash
curl -X POST http://localhost:3001/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+254712345678",
    "amount": 500,
    "recipientNumber": "+254787654321",
    "deviceId": "device-123"
  }'
```

### Dashboard
- **URL:** `http://localhost:5173`
- Real-time feed of transactions
- Network signal analysis
- Decision tree visualization
- Live SSE stream from middleware

### Payment App (Expo)
- **URL:** `http://localhost:8081`
- **Web:** Press `w` in the terminal
- **iOS:** Press `i` (requires macOS + Xcode)
- **Android:** Press `a` (requires Android emulator or device)

## Testing

### Test Middleware API
```bash
npm run test:api
```

### Test Nokia Network as Code SDK
```bash
npm run test:nokia
```

### Test Nokia NAC Sandbox
```bash
npm run test:nac-sandbox
```

## Building for Production

```bash
npm run build
```

This builds all apps and outputs to their respective `dist/` or `build/` directories.

## Project Structure

```
guard-layer/
├── apps/
│   ├── middleware/          # Node.js Express server (port 3001)
│   │   ├── server.js        # Entry point
│   │   └── src/
│   │       ├── agent/       # Claude decision engine
│   │       ├── camara/      # Nokia CAMARA API calls
│   │       ├── biometric/   # Biometric verification
│   │       └── payment/     # Payment simulation
│   ├── dashboard/           # React + Vite app (port 5173)
│   │   └── src/
│   │       └── components/  # Dashboard UI components
│   └── ...
├── payment-app/             # React Native + Expo (port 8081)
│   ├── app/                 # Expo Router pages
│   └── components/          # React Native components
├── packages/
│   └── shared/              # Shared types and utilities
├── package.json             # Root workspace config
└── turbo.json              # Turbo monorepo config
```

## Key Endpoints

### Middleware

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/initiate` | Start fraud assessment for transaction |
| POST | `/confirm` | Confirm biometric challenge |
| GET | `/api/events` | SSE stream for dashboard |

### Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `NOKIA_API_KEY` | Nokia Network as Code API authentication | — |
| `CLAUDE_API_KEY` | Anthropic Claude API key | — |
| `MIDDLEWARE_PORT` | Port middleware listens on | `3001` |

## Troubleshooting

### "expo/tsconfig.base" not found
```bash
cd payment-app && npm install expo
```

### Middleware won't start
- Check port 3001 is not in use
- Verify `.env` file exists with required keys
- Run: `npm install` in root directory

### Dashboard not connecting to Middleware
- Ensure middleware is running on `http://localhost:3001`
- Check browser console for CORS issues
- Verify SSE connection is working

### Payment App won't load
- Clear Expo cache: `npm run reset-project` (in payment-app)
- Update Expo: `npm install expo@latest`
- Try web version: `npm run web` (in payment-app)

## Development Tips

### Monorepo Commands

```bash
# Run script in specific workspace
npm run <script> --workspace=@guard-layer/middleware

# Install package in specific workspace
npm install <package> --workspace=@guard-layer/dashboard

# List all workspaces
npm workspaces list
```

### File Organization

- **Middleware logic:** `apps/middleware/src/`
- **Shared types:** `packages/shared/types.js`
- **Dashboard components:** `apps/dashboard/src/components/`
- **Mobile UI:** `payment-app/components/`

### Hot Reload

All services support hot reload during development:
- Middleware: Watch `server.js` and `src/`
- Dashboard: Vite HMR
- Payment App: Expo Fast Refresh

## Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Configure `.env` file
3. ✅ Run all services: `npm run dev:all`
4. ✅ Open dashboard: `http://localhost:5173`
5. ✅ Test middleware: Use curl or postman to `/initiate`
6. ✅ Monitor real-time updates in dashboard

## Support

For detailed architecture documentation, see [documentation.md](documentation.md)
For implementation details, see [P1_Implementation.md](P1_Implementation.md) and [P3_Implementation.md](P3_Implementation.md)
