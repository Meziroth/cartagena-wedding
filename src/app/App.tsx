import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../state/auth';
import { ToastProvider } from '../state/toast';
import { Home } from '../views/Home';
import { NotFound, Section } from '../views/Section';
import { AccessGate } from './AccessGate';
import { ROUTES } from './routes';
import { Shell } from './Shell';

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
                    <Route key={r.id} path={r.path} element={<Section id={r.id as Exclude<typeof r.id, 'home'>} />} />
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
