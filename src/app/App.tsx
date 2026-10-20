import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../state/toast';
import { WeddingProvider } from '../state/wedding';
import { Home } from '../views/Home';
import { NotFound, Section } from '../views/Section';
import { ROUTES } from './routes';
import { Shell } from './Shell';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <WeddingProvider>
          <HashRouter>
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
        </WeddingProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
