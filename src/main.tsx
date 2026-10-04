import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import {
  initializeGoogleAnalytics,
  USE_GOOGLE_ANALYTICS,
} from './utils/analytics';
import '@/styles/index.css';
import { withOptionalGAPageTracking } from './utils/trackRoute';
import { resetActivityData } from '@/hooks/useActivities';

const Index = lazy(() => import('./pages'));
const HomePage = lazy(() => import('@/pages/total'));
const NotFound = lazy(() => import('./pages/404'));

const RouteFallback = () => (
  <div
    style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: 'var(--color-background)',
      color: 'var(--color-run-date)',
      fontFamily: 'var(--font-sans)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      fontSize: '0.72rem',
      fontWeight: 700,
    }}
  >
    正在加载页面…
  </div>
);

const RouteError = () => (
  <main
    style={{
      minHeight: '100vh',
      display: 'grid',
      placeContent: 'center',
      gap: '0.75rem',
      padding: '2rem',
      color: 'var(--color-run-date)',
      textAlign: 'center',
      fontFamily: 'var(--font-sans)',
    }}
  >
    <h1>跑步记录暂时无法加载</h1>
    <p>请检查网络连接后重试。</p>
    <button
      type="button"
      onClick={() => {
        resetActivityData();
        window.location.reload();
      }}
    >
      重试
    </button>
  </main>
);

const createRouteElement = (element: React.ReactElement) =>
  withOptionalGAPageTracking(
    <Suspense fallback={<RouteFallback />}>{element}</Suspense>
  );

if (USE_GOOGLE_ANALYTICS) {
  void initializeGoogleAnalytics();
}

const routes = createBrowserRouter(
  [
    {
      path: '/',
      element: createRouteElement(<Index />),
      errorElement: <RouteError />,
    },
    {
      path: 'summary',
      element: createRouteElement(<HomePage />),
      errorElement: <RouteError />,
    },
    {
      path: 'total',
      element: createRouteElement(<HomePage />),
      errorElement: <RouteError />,
    },
    {
      path: '*',
      element: createRouteElement(<NotFound />),
      errorElement: <RouteError />,
    },
  ],
  { basename: import.meta.env.BASE_URL }
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <RouterProvider router={routes} />
    </HelmetProvider>
  </React.StrictMode>
);
