import { useState, useEffect, createContext, useContext } from 'react'
import Sidebar from './components/Sidebar'
import DashboardPage from './pages/DashboardPage'
import SearchPage from './pages/SearchPage'
import SettingsPage from './pages/SettingsPage'
import SitesPage from './pages/SitesPage'
import ClientsPage from './pages/ClientsPage'
import TasksPage from './pages/TasksPage'
import HelpPage from './pages/HelpPage'
import LoginPage from './pages/LoginPage'
import SeriesPage from './pages/SeriesPage'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import useAdaptiveStatusBar from './hooks/useAdaptiveStatusBar'
import useSwipeGesture from './hooks/useSwipeGesture'





// Create Theme Context
export const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'))
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('user')
        return saved ? JSON.parse(saved) : null
    })
    const [activeTab, setActiveTab] = useState('dashboard')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebarCollapsed');
        return saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
    }, [sidebarCollapsed]);

    // Search state - preserved across tab switches
    const [searchState, setSearchState] = useState({
        query: '',
        results: [],
        searched: false
    })

    // Theme state - load from localStorage
    const [themeMode, setThemeMode] = useState(() => {
        const saved = localStorage.getItem('themeMode')
        if (saved) return saved;
        // Migration from old darkMode boolean
        const oldDarkMode = localStorage.getItem('darkMode');
        if (oldDarkMode !== null) {
            return JSON.parse(oldDarkMode) ? 'dark' : 'light';
        }
        return 'system' // Default to system
    })

    const [computedDarkMode, setComputedDarkMode] = useState(false);

    // Sites Status state
    const [expiredCookiesCount, setExpiredCookiesCount] = useState(0)

    // Site Name state
    const [siteName, setSiteName] = useState('PT Manager')

    // Handle theme changes and system preference synchronization
    useEffect(() => {
        localStorage.setItem('themeMode', themeMode)

        const applyTheme = () => {
            let isDark = false;
            if (themeMode === 'system') {
                isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            } else {
                isDark = themeMode === 'dark';
            }

            setComputedDarkMode(isDark);

            if (isDark) {
                document.documentElement.classList.add('dark')
                document.documentElement.classList.remove('light')
            } else {
                document.documentElement.classList.add('light')
                document.documentElement.classList.remove('dark')
            }
        };

        applyTheme();

        // Listen for system theme changes if in system mode
        if (themeMode === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const listener = () => applyTheme();
            mediaQuery.addEventListener('change', listener);
            return () => mediaQuery.removeEventListener('change', listener);
        }
    }, [themeMode])

    // Update iOS status bar and theme color dynamically
    useAdaptiveStatusBar(computedDarkMode);

    // Swipe gesture for sidebar (mobile only)
    useSwipeGesture(
        () => setSidebarOpen(true),  // Swipe right - open sidebar
        () => setSidebarOpen(false), // Swipe left - close sidebar
        isAuthenticated && window.innerWidth < 1024 // Only on mobile when authenticated
    );

    const authenticatedFetch = async (url, options = {}) => {
        const token = localStorage.getItem('token');
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };

        const res = await fetch(url, { ...options, headers });

        if (res.status === 401) {
            handleLogout();
            throw new Error('Unauthorized');
        }

        return res;
    };

    const fetchStatus = async () => {
        if (!isAuthenticated) return;
        try {
            const res = await authenticatedFetch('/api/sites');
            const sites = await res.json();
            const expired = sites.filter(s => s.enabled && s.cookie_status === 1).length;
            setExpiredCookiesCount(expired);
        } catch (err) {
            console.error('Failed to fetch sites status:', err);
        }
    };

    // Fetch public settings (Title) on mount
    useEffect(() => {
        const fetchPublicSettings = async () => {
            try {
                const res = await fetch('/api/settings/public');
                const data = await res.json();
                if (data.site_name) {
                    setSiteName(data.site_name);
                }
            } catch (err) {
                console.error('Failed to fetch public settings:', err);
            }
        };
        fetchPublicSettings();
    }, []);

    // Update Document Title
    useEffect(() => {
        document.title = siteName;
    }, [siteName]);

    const fetchUserProfile = async () => {
        if (!isAuthenticated) return;
        try {
            const res = await authenticatedFetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                if (data.user) {
                    setUser(data.user);
                    localStorage.setItem('user', JSON.stringify(data.user));
                }
            }
        } catch (err) {
            console.error('Failed to fetch user profile:', err);
        }
    };

    // Fetch settings and status on mount (Authenticated)
    useEffect(() => {
        if (!isAuthenticated) return;

        const fetchStatusAndSettings = async () => {
            fetchStatus();
            fetchUserProfile(); // Get fresh permissions/role
        };
        fetchStatusAndSettings();

        // Check status and profile every 5 minutes
        const interval = setInterval(() => {
            fetchStatus();
            fetchUserProfile();
        }, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [isAuthenticated]);

    const handleLogin = (data) => {
        setIsAuthenticated(true);
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));

        // Auto-redirect to first allowed menu
        if (data.user.role !== 'admin') {
            const permissions = data.user.permissions ? (typeof data.user.permissions === 'string' ? JSON.parse(data.user.permissions) : data.user.permissions) : null;
            const allowedMenus = permissions?.menus || ['dashboard', 'search', 'series', 'help'];
            if (!allowedMenus.includes(activeTab)) {
                setActiveTab(allowedMenus[0]);
            }
        }
    };

    // Keep activeTab valid after manual refresh or user change
    useEffect(() => {
        if (isAuthenticated && user && user.role !== 'admin') {
            const permissions = user.permissions ? (typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions) : null;
            const allowedMenus = permissions?.menus || ['dashboard', 'search', 'series', 'help'];
            if (!allowedMenus.includes(activeTab)) {
                setActiveTab(allowedMenus[0]);
            }
        }
    }, [user, isAuthenticated]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setUser(null);
    };

    const toggleDarkMode = () => {
        if (themeMode === 'system') {
            setThemeMode('dark');
        } else if (themeMode === 'dark') {
            setThemeMode('light');
        } else {
            setThemeMode('system');
        }
    }

    if (!isAuthenticated) {
        return <LoginPage onLogin={handleLogin} siteName={siteName} themeMode={themeMode} setThemeMode={setThemeMode} darkMode={computedDarkMode} />;
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'sites':
                return <SitesPage authenticatedFetch={authenticatedFetch} />
            case 'clients':
                return <ClientsPage authenticatedFetch={authenticatedFetch} />
            case 'tasks':
                return <TasksPage authenticatedFetch={authenticatedFetch} />
            case 'dashboard':
                return <DashboardPage setActiveTab={setActiveTab} authenticatedFetch={authenticatedFetch} />
            case 'search':
                return <SearchPage searchState={searchState} setSearchState={setSearchState} authenticatedFetch={authenticatedFetch} />
            case 'settings':
                return <SettingsPage authenticatedFetch={authenticatedFetch} />
            case 'series':
                return <SeriesPage />
            case 'help':
                return <HelpPage />
            default:
                return <div className="p-8 text-center text-gray-500">页面开发中...</div>
        }
    }

    const themeClasses = computedDarkMode
        ? 'bg-gray-900 text-gray-100'
        : 'bg-gray-100 text-gray-900'

    return (
        <ThemeContext.Provider value={{
            darkMode: computedDarkMode,
            themeMode,
            setThemeMode,
            toggleDarkMode,
            siteName,
            setSiteName,
            expiredCookiesCount,
            fetchStatus,
            handleLogout,
            user,
            authenticatedFetch
        }}>
            <div className={`min-h-screen flex font-sans ${themeClasses}`}>
                {/* Mobile Backdrop */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 z-20 bg-gray-900/50 backdrop-blur-sm lg:hidden transition-opacity"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <div className={`
                    fixed inset-y-0 left-0 z-30 transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 transition-all duration-300 ease-in-out
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                    ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}
                `}>
                    <Sidebar
                        activeTab={activeTab}
                        setActiveTab={(tab) => {
                            setActiveTab(tab);
                            setSidebarOpen(false);
                        }}
                        user={user}
                        collapsed={sidebarCollapsed}
                        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                    />
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-w-0 relative bg-surface-50 dark:bg-surface-950 transition-colors duration-300">
                    {/* Mobile Header */}
                    <header
                        className={`sticky top-0 z-20 lg:hidden flex items-center justify-between p-2 sm:p-4 border-b shrink-0 ${computedDarkMode ? 'bg-surface-900 border-gray-800' : 'bg-white border-gray-200'}`}
                        style={{
                            paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
                            paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
                            paddingRight: 'max(0.75rem, env(safe-area-inset-right))'
                        }}
                    >
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className={`p-2 rounded-lg ${computedDarkMode ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-gray-100 text-gray-700'} transition-colors`}
                        >
                            <span className="text-2xl">☰</span>
                        </button>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-primary-600 truncate px-4 flex-1 text-center">
                            {siteName}
                        </h1>
                        <button
                            onClick={() => {
                                const next = themeMode === 'system' ? 'light' : themeMode === 'light' ? 'dark' : 'system';
                                setThemeMode(next);
                            }}
                            className={`p-2 rounded-lg ${computedDarkMode ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-gray-100 text-gray-700'} transition-colors w-10 flex items-center justify-center`}
                        >
                            <span className="text-xl">
                                {themeMode === 'light' ? '☀️' : themeMode === 'dark' ? '🌙' : '🖥️'}
                            </span>
                        </button>
                    </header>

                    <main className="flex-1 overflow-x-hidden relative">
                        <div className="max-w-full min-h-full pb-safe overscroll-contain">
                            {renderContent()}
                        </div>
                    </main>
                </div>

                {/* PWA Install Prompt */}
                <PWAInstallPrompt />
            </div>
        </ThemeContext.Provider>
    )
}

export default App
