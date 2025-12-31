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

    // Fetch settings and status on mount (Authenticated)
    useEffect(() => {
        if (!isAuthenticated) return;

        const fetchStatusAndSettings = async () => {
            fetchStatus();
            // We can also fetch full settings here if needed, but public name is already fetched.
        };
        fetchStatusAndSettings();

        // Check status every 5 minutes
        const interval = setInterval(fetchStatus, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [isAuthenticated]);

    const handleLogin = (data) => {
        setIsAuthenticated(true);
        setUser(data.user);
    };

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
        return <LoginPage onLogin={handleLogin} siteName={siteName} />;
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
            <div className={`flex h-screen overflow-hidden font-sans ${themeClasses} max-w-[100vw]`}>
                {/* Mobile Backdrop */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 z-20 bg-black/50 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <div className={`
                    fixed inset-y-0 left-0 z-30 transform lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                `}>
                    <Sidebar
                        activeTab={activeTab}
                        setActiveTab={(tab) => {
                            setActiveTab(tab);
                            setSidebarOpen(false);
                        }}
                    />
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                    {/* Mobile Header */}
                    <header className={`lg:hidden flex items-center justify-between p-4 border-b shrink-0 ${computedDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className={`p-2 rounded-lg ${computedDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} transition-colors`}
                        >
                            <span className="text-2xl">☰</span>
                        </button>
                        <h1 className="text-xl font-bold text-blue-400 truncate px-4">{siteName}</h1>
                        <div className="w-10"></div> {/* Spacer for symmetry */}
                    </header>

                    <main className={`flex-1 overflow-y-auto overflow-x-hidden ${computedDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
                        <div className="max-w-full">
                            {renderContent()}
                        </div>
                    </main>
                </div>
            </div>
        </ThemeContext.Provider>
    )
}

export default App
