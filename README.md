# OmniScop Mini App

A simplified version of the OmniScop application focusing on authentication and chat functionality.

## Features

- ✅ SuperTokens Authentication (Email/Password)
- ✅ Chat Interface with CopilotKit
- ✅ Thread Management
- ✅ Clean Sidebar-Style UI
- ✅ Redux State Management
- ✅ TypeScript Support

## Getting Started

### Prerequisites

- Node.js 18+ or pnpm
- Backend authentication server running on port 8000

### Installation

```bash
# Install dependencies
pnpm install

# or
npm install
```

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# Authentication
NEXT_PUBLIC_AUTH_DOMAIN=http://localhost:8000
NEXT_PUBLIC_WEBSITE_DOMAIN=http://localhost:3001
NEXT_PUBLIC_APP_NAME=OmniScop Mini
NEXT_PUBLIC_SUBSCRIPTION_TYPE=emailpassword

# CopilotKit
COPILOT_BACKEND_URL=http://localhost:8000

# SuperTokens
NEXT_PUBLIC_SUPERTOKENS_LOGGING_ENABLED=true
```

### Running the Development Server

```bash
# Start the development server
pnpm dev

# or
npm run dev
```

The app will be available at [http://localhost:3001](http://localhost:3001)

### Building for Production

```bash
# Build the application
pnpm build

# Start the production server
pnpm start
```

## Project Structure

```
mini-app/
├── src/
│   ├── components/       # React components
│   │   └── ChatInterface.tsx
│   ├── pages/           # Next.js pages
│   │   ├── api/         # API routes
│   │   ├── auth/        # Authentication pages
│   │   ├── chat/        # Chat pages
│   │   ├── _app.tsx     # App wrapper
│   │   └── index.tsx    # Home page
│   ├── redux/           # Redux store and slices
│   ├── utils/           # Utility functions
│   │   └── auth/        # Authentication utilities
│   ├── hooks/           # Custom React hooks
│   ├── constants/       # App constants
│   └── styles/          # Global styles
├── public/              # Static assets
├── next.config.js       # Next.js configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies
```

## Key Differences from Main App

This mini version focuses on:
1. **Simplified UI**: Just chat interface, no admin panels or dashboards
2. **Core Features Only**: Login + Chat
3. **Reused Code**: Same authentication and chat logic from main app
4. **Sidebar Layout**: Optimized for sidebar/embedded usage

## Authentication Flow

1. User lands on `/` → Redirects to `/auth` if not authenticated
2. User signs in with email/password
3. SuperTokens handles authentication
4. Upon success, redirect to `/chat`
5. Chat interface opens with a new thread

## Usage

1. **Login**: Navigate to the app and sign in with your credentials
2. **Chat**: Once logged in, start chatting immediately
3. **New Thread**: Click "New Thread" button to start fresh
4. **Logout**: Click "Logout" to sign out

## Technologies

- **Next.js** - React framework
- **TypeScript** - Type safety
- **SuperTokens** - Authentication
- **CopilotKit** - AI chat functionality
- **Redux Toolkit** - State management
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

## Development Notes

- The app runs on port 3001 by default (different from main app on 3000)
- Authentication backend should run on port 8000
- All authentication logic is reused from the main app
- Chat functionality uses the same CopilotKit setup

## Troubleshooting

### Authentication Issues

If you encounter authentication problems:
1. Ensure backend is running on port 8000
2. Clear browser cookies and localStorage
3. Check `.env.local` configuration

### Chat Not Working

1. Verify `COPILOT_BACKEND_URL` is correct
2. Check backend CopilotKit endpoint is accessible
3. Review browser console for errors

## License

Same as main OmniScop application.


