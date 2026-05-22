import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { MAP_TILE_STYLE_LIGHT, MAP_TILE_STYLE_DARK } from '@/utils/const';

export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

// Custom event name for theme changes
export const THEME_CHANGE_EVENT = 'theme-change';

const getSystemTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
};

const getStoredThemePreference = (): ThemePreference => {
  if (typeof window === 'undefined') return 'system';
  const storedTheme = localStorage.getItem('theme');
  return storedTheme === 'light' || storedTheme === 'dark'
    ? storedTheme
    : 'system';
};

const resolveThemePreference = (preference: ThemePreference): Theme =>
  preference === 'system' ? getSystemTheme() : preference;

const getCurrentThemeSnapshot = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light'
    ? 'light'
    : 'dark';
};

const subscribeToThemeChanges = (onStoreChange: () => void) => {
  if (typeof window === 'undefined') return () => {};

  const observer = new MutationObserver((mutations) => {
    if (
      mutations.some(
        (mutation) =>
          mutation.type === 'attributes' &&
          mutation.attributeName === 'data-theme'
      )
    ) {
      onStoreChange();
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  const handleThemeChange = () => onStoreChange();
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'theme') {
      onStoreChange();
    }
  };

  window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  window.addEventListener('storage', handleStorageChange);
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', handleThemeChange);

  return () => {
    observer.disconnect();
    window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.removeEventListener('storage', handleStorageChange);
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .removeEventListener('change', handleThemeChange);
  };
};

/**
 * Converts a theme value to the corresponding map style
 * @param theme - The current theme ('light' or 'dark')
 * @returns The appropriate map style for the theme
 */
export const getMapThemeFromCurrentTheme = (theme: Theme): string => {
  if (theme === 'dark') return MAP_TILE_STYLE_DARK;
  return MAP_TILE_STYLE_LIGHT;
};

/**
 * Hook for managing map theme based on application theme
 * @returns The current map theme style
 */
export const useMapTheme = () => {
  const themeSnapshot = useSyncExternalStore(
    subscribeToThemeChanges,
    getCurrentThemeSnapshot,
    () => 'dark'
  );

  return getMapThemeFromCurrentTheme(
    themeSnapshot === 'light' ? 'light' : 'dark'
  );
};

/**
 * Main theme hook for the application
 * @returns Object with current theme and function to change theme
 */
export const useTheme = () => {
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    getStoredThemePreference
  );

  /**
   * Set theme and dispatch event to notify other components
   */
  const setTheme = useCallback((newTheme: ThemePreference) => {
    setThemePreference(newTheme);

    // Dispatch custom event for theme change
    const event = new CustomEvent(THEME_CHANGE_EVENT, {
      detail: { theme: newTheme },
    });
    window.dispatchEvent(event);
  }, []);

  // Apply theme changes to DOM and localStorage
  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = () => {
      root.setAttribute('data-theme', resolveThemePreference(themePreference));
      localStorage.setItem('theme', themePreference);
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    };

    applyTheme();

    if (themePreference !== 'system') return undefined;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [themePreference]);

  return {
    preference: themePreference,
    theme: resolveThemePreference(themePreference),
    setTheme,
  };
};

/**
 * Hook to trigger re-render when theme changes for dynamic color calculations
 * @returns A counter that increments when theme changes
 */
export const useThemeChangeCounter = () => {
  return useSyncExternalStore(
    subscribeToThemeChanges,
    getCurrentThemeSnapshot,
    () => 'dark'
  );
};
