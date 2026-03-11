# PostHog Next.js Pages Router Example Project

Repository: https://github.com/PostHog/context-mill
Path: basics/next-pages-router

---

## README.md

# PostHog Next.js pages router example

This is a [Next.js](https://nextjs.org) Pages Router example demonstrating PostHog integration with product analytics, session replay, feature flags, and error tracking.

## Features

- **Product Analytics**: Track user events and behaviors
- **Session Replay**: Record and replay user sessions
- **Error Tracking**: Capture and track errors
- **User Authentication**: Demo login system with PostHog user identification
- **Server-side & Client-side Tracking**: Examples of both tracking methods
- **Reverse Proxy**: PostHog ingestion through Next.js rewrites

## Getting Started

### 1. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog API key from your [PostHog project settings](https://app.posthog.com/project/settings).

### 3. Run the Development Server

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## Project Structure

```
src/
├── components/
│   └── Header.tsx           # Navigation header with auth state
├── contexts/
│   └── AuthContext.tsx      # Authentication context with PostHog integration
├── lib/
│   └── posthog-server.ts    # Server-side PostHog client
├── pages/
│   ├── _app.tsx             # App wrapper with Auth provider
│   ├── _document.tsx        # Document wrapper
│   ├── index.tsx            # Home/Login page
│   ├── burrito.tsx          # Demo feature page with event tracking
│   ├── profile.tsx          # User profile with error tracking demo
│   └── api/
│       └── auth/
│           └── login.ts     # Login API with server-side tracking
└── styles/
    └── globals.css          # Global styles

instrumentation-client.ts    # Client-side PostHog initialization
```

## Key Integration Points

### Client-side initialization (instrumentation-client.ts)

```typescript
import posthog from "posthog-js"

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: '2026-01-30',
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development",
});
```

### User identification (AuthContext.tsx)

```typescript
posthog.identify(username, {
  username: username,
});
```

### Event tracking (burrito.tsx)

```typescript
posthog.capture('burrito_considered', {
  total_considerations: count,
  username: username,
});
```

### Error tracking (profile.tsx)

```typescript
posthog.captureException(error);
```

### Server-side tracking (api/auth/login.ts)

```typescript
const posthog = getPostHogClient();
posthog.capture({
  distinctId: username,
  event: 'server_login',
  properties: { ... }
});
```

## Pages router differences from app router

This example uses Next.js Pages Router instead of App Router. Key differences:

1. **File-based routing**: Pages in `src/pages/` instead of `src/app/`
2. **_app.tsx**: Custom App component wraps all pages
3. **API Routes**: Located in `src/pages/api/`
4. **No 'use client'**: All pages are client-side by default
5. **useRouter**: From `next/router` instead of `next/navigation`
6. **Head component**: Using `next/head` for metadata instead of `metadata` export

## Learn More

- [PostHog Documentation](https://posthog.com/docs)
- [Next.js Pages Router Documentation](https://nextjs.org/docs/pages)
- [PostHog Next.js Integration Guide](https://posthog.com/docs/libraries/next-js)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new).

Check out the [Next.js deployment documentation](https://nextjs.org/docs/pages/building-your-application/deploying) for more details.

---

## instrumentation-client.ts

```ts
import posthog from "posthog-js"

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  // Include the defaults option as required by PostHog
  defaults: '2026-01-30',
  // Enables capturing unhandled exceptions via Error Tracking
  capture_exceptions: true,
  // Turn on debug in development mode
  debug: process.env.NODE_ENV === "development",
});

//IMPORTANT: Never combine this approach with other client-side PostHog initialization approaches, especially components like a PostHogProvider. instrumentation-client.ts is the correct solution for initializating client-side PostHog in Next.js 15.3+ apps.
```

---

## next.config.ts

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default nextConfig;

```

---

## src/components/Header.tsx

```tsx
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <div className="header-container">
        <nav>
          <Link href="/">Home</Link>
          {user && (
            <>
              <Link href="/burrito">Burrito Consideration</Link>
              <Link href="/profile">Profile</Link>
            </>
          )}
        </nav>
        <div className="user-section">
          {user ? (
            <>
              <span>Welcome, {user.username}!</span>
              <button onClick={logout} className="btn-logout">
                Logout
              </button>
            </>
          ) : (
            <span>Not logged in</span>
          )}
        </div>
      </div>
    </header>
  );
}

```

---

## src/contexts/AuthContext.tsx

```tsx
import { createContext, useContext, useState, ReactNode } from 'react';
import posthog from 'posthog-js';

interface User {
  username: string;
  burritoConsiderations: number;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  incrementBurritoConsiderations: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const users: Map<string, User> = new Map();

export function AuthProvider({ children }: { children: ReactNode }) {
  // Use lazy initializer to read from localStorage only once on mount
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;

    const storedUsername = localStorage.getItem('currentUser');
    if (storedUsername) {
      const existingUser = users.get(storedUsername);
      if (existingUser) {
        return existingUser;
      }
    }
    return null;
  });

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const { user: userData } = await response.json();

        // Get or create user in local map
        let localUser = users.get(username);
        if (!localUser) {
          localUser = userData as User;
          users.set(username, localUser);
        }

        setUser(localUser);
        localStorage.setItem('currentUser', username);

        // Identify user in PostHog using username as distinct ID
        posthog.identify(username, {
          username: username,
        });

        // Capture login event
        posthog.capture('user_logged_in', {
          username: username,
        });

        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    // Capture logout event before resetting
    posthog.capture('user_logged_out');
    posthog.reset();

    setUser(null);
    localStorage.removeItem('currentUser');
  };

  const incrementBurritoConsiderations = () => {
    if (user) {
      user.burritoConsiderations++;
      users.set(user.username, user);
      setUser({ ...user });
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, incrementBurritoConsiderations }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

```

---

## src/lib/posthog-server.ts

```ts
import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

export function getPostHogClient() {
  if (!posthogClient) {
    posthogClient = new PostHog(
      process.env.NEXT_PUBLIC_POSTHOG_KEY!,
      {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        flushAt: 1,
        flushInterval: 0
      }
    );
  }
  return posthogClient;
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}

```

---

## src/pages/_app.tsx

```tsx
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { AuthProvider } from "@/contexts/AuthContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}

```

---

## src/pages/_document.tsx

```tsx
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

```

---

## src/pages/api/auth/login.ts

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getPostHogClient } from '@/lib/posthog-server';

const users = new Map<string, { username: string; burritoConsiderations: number }>();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  let user = users.get(username);
  const isNewUser = !user;

  if (!user) {
    user = { username, burritoConsiderations: 0 };
    users.set(username, user);
  }

  // Capture server-side login event
  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: username,
    event: 'server_login',
    properties: {
      username: username,
      isNewUser: isNewUser,
      source: 'api'
    }
  });

  // Identify user on server side
  posthog.identify({
    distinctId: username,
    properties: {
      username: username,
      createdAt: isNewUser ? new Date().toISOString() : undefined
    }
  });

  return res.status(200).json({ success: true, user });
}

```

---

## src/pages/api/hello.ts

```ts
// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";

type Data = {
  name: string;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  res.status(200).json({ name: "John Doe" });
}

```

---

## src/pages/burrito.tsx

```tsx
import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';

export default function BurritoPage() {
  const { user, incrementBurritoConsiderations } = useAuth();
  const router = useRouter();
  const [hasConsidered, setHasConsidered] = useState(false);

  // Redirect to home if not logged in
  if (!user) {
    router.push('/');
    return null;
  }

  const handleConsideration = () => {
    incrementBurritoConsiderations();
    setHasConsidered(true);
    setTimeout(() => setHasConsidered(false), 2000);

    // Capture burrito consideration event
    posthog.capture('burrito_considered', {
      total_considerations: user.burritoConsiderations + 1,
      username: user.username,
    });
  };

  return (
    <>
      <Head>
        <title>Burrito Consideration - Burrito Consideration App</title>
        <meta name="description" content="Consider the potential of burritos" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Header />
      <main>
        <div className="container">
          <h1>Burrito consideration zone</h1>
          <p>Take a moment to truly consider the potential of burritos.</p>

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleConsideration}
              className="btn-burrito"
            >
              I have considered the burrito potential
            </button>

            {hasConsidered && (
              <p className="success">
                Thank you for your consideration! Count: {user.burritoConsiderations}
              </p>
            )}
          </div>

          <div className="stats">
            <h3>Consideration stats</h3>
            <p>Total considerations: {user.burritoConsiderations}</p>
          </div>
        </div>
      </main>
    </>
  );
}

```

---

## src/pages/index.tsx

```tsx
import { useState } from 'react';
import Head from 'next/head';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';

export default function Home() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const success = await login(username, password);
      if (success) {
        setUsername('');
        setPassword('');
      } else {
        setError('Please provide both username and password');
      }
    } catch (err) {
      console.error('Login failed:', err);
      setError('An error occurred during login');
    }
  };

  return (
    <>
      <Head>
        <title>Burrito Consideration App</title>
        <meta name="description" content="Consider the potential of burritos" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Header />
      <main>
        {user ? (
          <div className="container">
            <h1>Welcome back, {user.username}!</h1>
            <p>You are now logged in. Feel free to explore:</p>
            <ul>
              <li>Consider the potential of burritos</li>
              <li>View your profile and statistics</li>
            </ul>
          </div>
        ) : (
          <div className="container">
            <h1>Welcome to Burrito Consideration App</h1>
            <p>Please sign in to begin your burrito journey</p>

            <form onSubmit={handleSubmit} className="form">
              <div className="form-group">
                <label htmlFor="username">Username:</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter any username"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password:</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter any password"
                />
              </div>

              {error && <p className="error">{error}</p>}

              <button type="submit" className="btn-primary">Sign In</button>
            </form>

            <p className="note">
              Note: This is a demo app. Use any username and password to sign in.
            </p>
          </div>
        )}
      </main>
    </>
  );
}

```

---

## src/pages/profile.tsx

```tsx
import Head from 'next/head';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();

  // Redirect to home if not logged in
  if (!user) {
    router.push('/');
    return null;
  }

  const triggerTestError = () => {
    try {
      throw new Error('Test error for PostHog error tracking');
    } catch (err) {
      posthog.captureException(err);
      console.error('Captured error:', err);
      alert('Error captured and sent to PostHog!');
    }
  };

  return (
    <>
      <Head>
        <title>Profile - Burrito Consideration App</title>
        <meta name="description" content="Your burrito consideration profile" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Header />
      <main>
        <div className="container">
          <h1>User Profile</h1>

          <div className="stats">
            <h2>Your Information</h2>
            <p><strong>Username:</strong> {user.username}</p>
            <p><strong>Burrito Considerations:</strong> {user.burritoConsiderations}</p>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button onClick={triggerTestError} className="btn-primary" style={{ backgroundColor: '#dc3545' }}>
              Trigger Test Error (for PostHog)
            </button>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <h3>Your Burrito Journey</h3>
            {user.burritoConsiderations === 0 ? (
              <p>You haven&apos;t considered any burritos yet. Visit the Burrito Consideration page to start!</p>
            ) : user.burritoConsiderations === 1 ? (
              <p>You&apos;ve considered the burrito potential once. Keep going!</p>
            ) : user.burritoConsiderations < 5 ? (
              <p>You&apos;re getting the hang of burrito consideration!</p>
            ) : user.burritoConsiderations < 10 ? (
              <p>You&apos;re becoming a burrito consideration expert!</p>
            ) : (
              <p>You are a true burrito consideration master! 🌯</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

```

---

