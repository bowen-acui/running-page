import ActivityList from '@/components/ActivityList';
import { Helmet } from 'react-helmet-async';
import { useTheme } from '@/hooks/useTheme';
import { useEffect } from 'react';
import Layout from '@/components/Layout';

const HomePage = () => {
  const { theme } = useTheme();

  useEffect(() => {
    const htmlElement = document.documentElement;
    htmlElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <Layout>
      <Helmet>
        <html lang="en" data-theme={theme} />
      </Helmet>
      <div className="w-full">
        <ActivityList />
      </div>
    </Layout>
  );
};

export default HomePage;
