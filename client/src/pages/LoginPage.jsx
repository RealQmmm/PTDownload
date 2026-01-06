import { useState } from 'react'
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export default function LoginPage({ onLogin, siteName, themeMode, setThemeMode, darkMode }) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || '登录失败')
            }

            localStorage.setItem('token', data.token)
            localStorage.setItem('user', JSON.stringify(data.user))
            onLogin(data)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const bgClass = darkMode ? 'bg-gray-900' : 'bg-gray-50';
    const cardBg = darkMode ? 'bg-gray-800' : 'bg-white';
    const borderClass = darkMode ? 'border-gray-700' : 'border-gray-200';
    const textPrimary = darkMode ? 'text-white' : 'text-gray-900';
    const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-500';

    return (
        <div className={`min-h-screen flex flex-col items-center justify-center ${bgClass} p-4 transition-colors duration-300`}>
            {/* Theme Toggle in Header-right style */}
            <div className="fixed top-6 right-6 flex items-center bg-gray-500/10 backdrop-blur-sm p-1 rounded-xl border border-gray-500/20">
                {[
                    { id: 'light', icon: '☀️' },
                    { id: 'dark', icon: '🌙' },
                    { id: 'system', icon: '🖥️' }
                ].map((mode) => (
                    <button
                        key={mode.id}
                        onClick={() => setThemeMode(mode.id)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${themeMode === mode.id
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'text-gray-500 hover:bg-gray-500/20'}`}
                    >
                        {mode.icon}
                    </button>
                ))}
            </div>

            <div className={`max-w-md w-full space-y-8 ${cardBg} p-10 rounded-3xl shadow-2xl border ${borderClass} transition-all`}>
                <div className="text-center">
                    <div className="inline-block p-4 rounded-2xl bg-blue-600/10 mb-4">
                        <span className="text-4xl">⚡</span>
                    </div>
                    <h2 className={`text-3xl font-black ${textPrimary} tracking-tight`}>
                        {siteName}
                    </h2>
                    <p className={`mt-3 ${textSecondary} text-sm font-medium`}>
                        请登录您的管理账号
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-xs py-3 px-4 rounded-xl text-center font-bold animate-shake">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <Input
                            label="用户名"
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="请输入用户名"
                            className="text-base sm:text-sm"
                        />
                        <Input
                            label="密码"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="请输入密码"
                            className="text-base sm:text-sm"
                        />
                    </div>

                    <div className="pt-2">
                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 text-base"
                        >
                            {loading ? '身份验证中...' : '进入控制台'}
                        </Button>
                    </div>
                </form>
            </div>

            <p className={`mt-8 ${textSecondary} text-xs font-medium`}>
                &copy; {new Date().getFullYear()} {siteName}. All Rights Reserved.
            </p>
        </div>
    )
}
