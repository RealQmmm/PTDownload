import { useState, useEffect, createContext, useContext } from 'react'
import Sidebar from './components/Sidebar'
import DashboardPage from './pages/DashboardPage'
import SearchPage from './pages/SearchPage'
import SettingsPage from './pages/SettingsPage'
import SitesPage from './pages/SitesPage'
import ClientsPage from './pages/ClientsPage'
import TasksPage from './pages/TasksPage'

// Create Theme Context
export const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

function App() {
    const [activeTab, setActiveTab] = useState('dashboard')

    // Search state - preserved across tab switches
    const [searchState, setSearchState] = useState({
        query: '',
        results: [],
        searched: false
    })

    // Theme state - load from localStorage
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('darkMode')
        return saved !== null ? JSON.parse(saved) : true // Default to dark mode
    })

    // Site Name state
    const [siteName, setSiteName] = useState('PT Manager')

    // Save theme preference to localStorage
    useEffect(() => {
        localStorage.setItem('darkMode', JSON.stringify(darkMode))
        // Apply theme to document
        if (darkMode) {
            document.documentElement.classList.add('dark')
            document.documentElement.classList.remove('light')
        } else {
            document.documentElement.classList.add('light')
            document.documentElement.classList.remove('dark')
        }
    }, [darkMode])

    // Fetch settings on mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/settings');
                const data = await res.json();
                if (data.site_name) {
                    setSiteName(data.site_name);
                }
            } catch (err) {
                console.error('Failed to fetch settings:', err);
            }
        };
        fetchSettings();
    }, []);

    const toggleDarkMode = () => {
        setDarkMode(!darkMode)
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'sites':
                return <SitesPage />
            case 'clients':
                return <ClientsPage />
            case 'tasks':
                return <TasksPage />
            case 'dashboard':
                return <DashboardPage setActiveTab={setActiveTab} />
            case 'search':
                return <SearchPage searchState={searchState} setSearchState={setSearchState} />
            case 'settings':
                return <SettingsPage />
            default:
                return <div className="p-8 text-center text-gray-500">页面开发中...</div>
        }
    }

    const themeClasses = darkMode
        ? 'bg-gray-900 text-gray-100'
        : 'bg-gray-100 text-gray-900'

    return (
        <ThemeContext.Provider value={{ darkMode, toggleDarkMode, siteName, setSiteName }}>
            <div className={`flex h-screen overflow-hidden font-sans ${themeClasses}`}>
                <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
                <main className={`flex-1 overflow-y-auto ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
                    {renderContent()}
                </main>
            </div>
        </ThemeContext.Provider>
    )
}

export default App
