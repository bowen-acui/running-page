import ActivityList from '@/components/ActivityList';
import { Helmet } from 'react-helmet-async';
import { useTheme } from '@/hooks/useTheme';
import { useEffect } from 'react';

const HomePage = () => {
  const { theme } = useTheme();

  useEffect(() => {
    const htmlElement = document.documentElement;
    htmlElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <Helmet>
        <html lang="en" data-theme={theme} />
        <title>阿崔 Running Summary</title>
        <meta name="description" content="阿崔的年度跑步数据总览" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
      </Helmet>
      <main className="mx-auto min-h-dvh w-full max-w-screen-xl px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-10">
        <ActivityList />
      </main>
    </>
  );
};

export default HomePage;
