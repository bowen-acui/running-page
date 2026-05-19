import React from 'react';
import { Helmet } from 'react-helmet-async';
import DataStatusBar from '@/components/DataStatusBar';
import Header from '@/components/Header';
import getSiteMetadata from '@/hooks/useSiteMetadata';

const Layout = ({ children }: React.PropsWithChildren) => {
  const { siteTitle, description } = getSiteMetadata();

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
