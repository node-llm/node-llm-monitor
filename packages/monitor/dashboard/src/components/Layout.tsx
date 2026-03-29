/**
 * Layout component with i18n and RTL support.
 */
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconLogo, IconGlobe, IconGitHub } from './Icons';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('monitor_lng', lng);
  };

  const isRTL = i18n.dir() === 'rtl';

  return (
    <div className="min-h-screen bg-monitor-bg dark:bg-slate-950 font-sans" dir={i18n.dir()}>
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-monitor-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <IconLogo />
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('dashboard.title')}</h1>
                <p className="text-xs text-gray-600 dark:text-gray-400">{t('dashboard.subtitle')}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Modern Language Switcher */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group">
                <IconGlobe className="w-4 h-4 text-gray-500 group-hover:text-monitor-accent transition-colors" />
                <select 
                  className="text-xs font-bold bg-transparent border-none appearance-none outline-none text-gray-800 dark:text-gray-200 cursor-pointer hover:text-monitor-accent transition-all uppercase tracking-widest pl-0.5"
                  onChange={(e) => changeLanguage(e.target.value)}
                  value={i18n.language}
                >
                  {(i18n.options.supportedLngs as string[] || ['en']).filter(l => l !== 'cimode').map((lang) => (
                    <option key={lang} value={lang} className="bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 font-medium">
                      {lang.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs text-green-700 dark:text-green-400 font-medium">Live</span>
              </div>
              
              <a 
                href="https://github.com/node-llm/node-llm-monitor" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                title="GitHub Repository"
              >
                <IconGitHub className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-monitor-border dark:border-slate-800 mt-auto bg-white/50 dark:bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">
            {t('dashboard.title')} • {t('dashboard.subtitle')}
          </p>
        </div>
      </footer>
    </div>
  );
}
