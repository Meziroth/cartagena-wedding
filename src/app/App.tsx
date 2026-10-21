import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../state/auth';
import { ToastProvider } from '../state/toast';
import { Budget } from '../views/Budget';
import { Checklist } from '../views/Checklist';
import { Details } from '../views/Details';
import { Guests } from '../views/Guests';
import { Home } from '../views/Home';
import { Notes } from '../views/Notes';
import { NotFound, Section } from '../views/Section';
import { Vendors } from '../views/Vendors';
import { AccessGate } from './AccessGate';
import { ROUTES, type RouteId } from './routes';
import { Shell } from './Shell';

const SCREENS: Record<Exclude<RouteId, 'home'>, JSX.Element> = {
  checklist: <Checklist />,
  budget: <Budget />,
  vendors: <Vendors />,
  inspiration: <Section id="inspiration" />,
  guests: <Guests />,
  notes: <Notes />,
  details: <Details />,
};

// Tell components about cache changes before the next event or paint (the default waits for a 0 ms timer), so an
// optimistic edit never shows the old value for a moment, and quick slider key presses build on each other.
notifyManager.setScheduler(queueMicrotask);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <AccessGate>
            <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Routes>
                <Route element={<Shell />}>
                  <Route index element={<Home />} />
                  {ROUTES.filter((r) => r.id !== 'home').map((r) => (
                    <Route key={r.id} path={r.path} element={SCREENS[r.id as Exclude<RouteId, 'home'>]} />
                  ))}
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </HashRouter>
          </AccessGate>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
