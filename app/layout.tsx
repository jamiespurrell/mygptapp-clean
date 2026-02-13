import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { ThemeToggle } from '../components/theme-toggle';
import { AuthSessionProvider } from '../components/auth-session-provider';
import { AuthHeaderControls } from '../components/auth-header-controls';
import './globals.css';

export const metadata: Metadata = {
  title: 'Daily Voice Notes & Task Planner',
  description: 'Voice notes and task planner with optional Clerk/Auth.js authentication',
};

const themeInitScript = `(() => {
  const savedTheme = window.localStorage.getItem('theme');
  const theme = savedTheme === 'dark' ? 'dark' : 'light';
  document.documentElement.classList.toggle('dark', theme === 'dark');
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <AuthSessionProvider>
        <html lang="en" suppressHydrationWarning>
          <head>
            <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
          </head>
          <body>
            <header className="topbar">
              <h1>Daily Voice Notes &amp; Task Planner</h1>
              <div className="auth-actions">
                <ThemeToggle />
                <AuthHeaderControls />
              </div>
            </header>
            {children}
          </body>
        </html>
      </AuthSessionProvider>
    </ClerkProvider>
  );
}
