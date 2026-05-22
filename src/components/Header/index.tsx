import { Link } from 'react-router-dom';
import type { ReactElement } from 'react';
import getSiteMetadata from '@/hooks/useSiteMetadata';
import { useTheme, Theme, ThemePreference } from '@/hooks/useTheme';
import styles from './style.module.css';

const Header = () => {
  const { logo, siteTitle } = getSiteMetadata();
  const { preference, theme, setTheme } = useTheme();

  const icons: Record<ThemePreference, ReactElement> = {
    system: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="3.5"
          y="4.5"
          width="15"
          height="11"
          rx="2.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M8 18H14M11 15.5V18"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
    dark: (
      <svg
        width="22"
        height="23"
        viewBox="0 0 22 23"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M21.7519 15.0137C20.597 15.4956 19.3296 15.7617 18 15.7617C12.6152 15.7617 8.25 11.3965 8.25 6.01171C8.25 4.68211 8.51614 3.41468 8.99806 2.25977C5.47566 3.72957 3 7.20653 3 11.2617C3 16.6465 7.36522 21.0117 12.75 21.0117C16.8052 21.0117 20.2821 18.536 21.7519 15.0137Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    light: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 3.00464V5.25464M18.364 5.64068L16.773 7.23167M21 12.0046H18.75M18.364 18.3686L16.773 16.7776M12 18.7546V21.0046M7.22703 16.7776L5.63604 18.3686M5.25 12.0046H3M7.22703 7.23167L5.63604 5.64068M15.75 12.0046C15.75 14.0757 14.0711 15.7546 12 15.7546C9.92893 15.7546 8.25 14.0757 8.25 12.0046C8.25 9.93357 9.92893 8.25464 12 8.25464C14.0711 8.25464 15.75 9.93357 15.75 12.0046Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  };

  const nextTheme: ThemePreference =
    preference === 'system'
      ? 'light'
      : preference === 'light'
        ? 'dark'
        : 'system';

  const handleToggle = () => {
    setTheme(nextTheme);
  };

  return (
    <header className="mx-auto mt-3 w-full max-w-screen-2xl px-3 sm:px-4 lg:mt-8 lg:px-16">
      <nav className="flex items-center justify-between gap-3 rounded-3xl border border-[color:var(--color-hr-primary)]/22 bg-[color:var(--color-background)] px-3 py-3 shadow-[0_8px_22px_rgba(15,23,42,0.02)] sm:px-4 sm:py-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            to="/"
            className="shrink-0 rounded-full ring-1 ring-[color:var(--color-hr-primary)]/30 transition-transform duration-200 hover:scale-[1.03]"
          >
            <picture>
              <img
                className="h-11 w-11 rounded-full object-cover sm:h-14 sm:w-14"
                alt="logo"
                src={logo}
              />
            </picture>
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              to="/"
              className="block truncate text-lg font-black text-[color:var(--color-text-primary)] italic sm:text-xl lg:text-2xl"
            >
              {siteTitle}
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className={`${styles.themeButton} ${styles.themeButtonActive}`}
          aria-label={`Switch to ${nextTheme} theme`}
          title={`Current: ${preference} (${theme}). Switch to ${nextTheme}`}
        >
          <div className={styles.iconWrapper}>{icons[preference]}</div>
        </button>
      </nav>
    </header>
  );
};

export default Header;
