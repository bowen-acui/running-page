import ActivityList from '@/components/ActivityList';
import { Helmet } from 'react-helmet-async';
import { useTheme } from '@/hooks/useTheme';
import { useEffect } from 'react';
import Layout from '@/components/Layout';

const HomePage = () => {
  // Use the theme hook to get the current theme
  const { theme } = useTheme();

  // Apply theme changes to the document when theme changes
  useEffect(() => {
    const htmlElement = document.documentElement;
    // Set explicit theme attribute
    htmlElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <Layout>
      <Helmet>
        {/* Set HTML attributes including theme */}
        <html lang="en" data-theme={theme} />
      </Helmet>
      <div className="w-full">
        <div className="mb-6 rounded-[2.2rem] border border-[color:var(--color-hr-primary)]/30 bg-[color:var(--color-run-row-hover-background)]/20 px-5 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.32em] text-[color:var(--color-run-date)]">
            Activity Index
          </p>
          <h1 className="mt-4 text-3xl font-black italic tracking-tight text-[color:var(--color-text-primary)] sm:text-4xl">
            按时间维度翻看你的全部训练记录
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-[color:var(--color-run-date)]">
            切换年、月、周、日和生命日历视角，手机上优先保留筛选和卡片阅读手感。
          </p>
        </div>
        <ActivityList />
      </div>
    </Layout>
  );
};

export default HomePage;
