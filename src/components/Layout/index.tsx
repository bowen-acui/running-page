import React, { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import DataStatusBar from '@/components/DataStatusBar';
import Header from '@/components/Header';
import getSiteMetadata from '@/hooks/useSiteMetadata';

const Layout = ({ children }: React.PropsWithChildren) => {
  const { siteTitle, description } = getSiteMetadata();
  const location = useLocation();

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    if (location.hash) return;

    window.scrollTo(0, 0);
  }, [location.pathname, location.search, location.hash]);

  return (
    <>
      <Helmet>
        <html lang="en" />
        <title>{siteTitle}</title>
        <meta name="description" content={description} />
        <meta name="keywords" content="running" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
      </Helmet>
      <Header />
      <DataStatusBar />
      <main className="mx-auto mt-4 mb-16 max-w-screen-2xl px-3 pb-10 sm:px-4 lg:mt-8 lg:px-16">
        {children}
      </main>
    </>
  );
};

export default Layout;
