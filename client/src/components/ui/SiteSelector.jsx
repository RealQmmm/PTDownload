import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const SiteSelector = ({ sites, value, onChange, className = '' }) => {
    const { darkMode } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // 监听窗口大小变化
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 过滤和排序站点
    const filteredSites = useMemo(() => {
        let filtered = sites.filter(s => s.enabled === 1 || s.enabled === true || s.enabled === '1');

        if (searchQuery) {
            filtered = filtered.filter(s =>
                s.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        return filtered;
    }, [sites, searchQuery]);

    // 点击外部关闭
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isOpen]);

    // 阻止body滚动（移动端抽屉打开时）
    useEffect(() => {
        if (isOpen && isMobile) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen, isMobile]);

    const handleSelect = (siteName) => {
        onChange(siteName);
        setIsOpen(false);
        setSearchQuery('');
    };

    const displayValue = value || '全部站点';

    // 移动端：底部抽屉
    if (isMobile) {
        return (
            <>
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className={`
            w-full px-3 py-2.5 
            bg-white dark:bg-gray-800 
            border border-gray-200 dark:border-gray-700 
            rounded-xl text-base
            flex items-center justify-between
            transition-colors
            hover:border-gray-300 dark:hover:border-gray-600
            ${className}
          `}
                >
                    <span className="truncate text-gray-900 dark:text-gray-100">{displayValue}</span>
                    <svg className="w-4 h-4 ml-2 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-end">
                        {/* 遮罩 */}
                        <div
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* 抽屉 */}
                        <div className={`
              relative w-full 
              ${darkMode ? 'bg-gray-800' : 'bg-white'}
              rounded-t-2xl 
              max-h-[70vh] 
              flex flex-col
              animate-slide-up
              shadow-2xl
            `}>
                            {/* 拖动指示器 */}
                            <div className="flex justify-center pt-3 pb-2">
                                <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                            </div>

                            {/* 标题栏 */}
                            <div className="px-4 pb-3 flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">选择站点</h3>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* 搜索框 */}
                            {filteredSites.length > 5 && (
                                <div className="px-4 pb-3">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="搜索站点..."
                                            className={`
                        w-full pl-10 pr-4 py-2.5
                        ${darkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-900'}
                        border-0 rounded-xl
                        text-base
                        focus:outline-none focus:ring-2 focus:ring-blue-500/20
                      `}
                                            autoFocus
                                        />
                                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                </div>
                            )}

                            {/* 站点列表 */}
                            <div className="flex-1 overflow-y-auto overscroll-contain pb-safe">
                                <div
                                    onClick={() => handleSelect('')}
                                    className={`
                    px-4 py-3.5 cursor-pointer
                    flex items-center justify-between
                    ${value === ''
                                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                            : 'text-gray-900 dark:text-gray-100'
                                        }
                    active:bg-gray-100 dark:active:bg-gray-700
                    transition-colors
                  `}
                                >
                                    <span className="font-medium">全部站点</span>
                                    {value === '' && (
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                                {filteredSites.map(site => (
                                    <div
                                        key={site.id}
                                        onClick={() => handleSelect(site.name)}
                                        className={`
                      px-4 py-3.5 cursor-pointer
                      flex items-center justify-between
                      ${value === site.name
                                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                                : 'text-gray-900 dark:text-gray-100'
                                            }
                      active:bg-gray-100 dark:active:bg-gray-700
                      transition-colors
                    `}
                                    >
                                        <span className="font-medium">{site.name}</span>
                                        {value === site.name && (
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                ))}
                                {filteredSites.length === 0 && (
                                    <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                        未找到匹配的站点
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    // 桌面端：下拉菜单
    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
          w-full px-3 py-2.5 
          bg-white dark:bg-gray-800 
          border border-gray-200 dark:border-gray-700 
          rounded-xl text-base
          flex items-center justify-between
          transition-all
          hover:border-gray-300 dark:hover:border-gray-600
          focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
          ${className}
        `}
            >
                <span className="truncate text-gray-900 dark:text-gray-100">{displayValue}</span>
                <svg
                    className={`w-4 h-4 ml-2 text-gray-500 dark:text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className={`
          absolute top-full left-0 right-0 mt-2
          ${darkMode ? 'bg-gray-800' : 'bg-white'}
          border border-gray-200 dark:border-gray-700
          rounded-xl shadow-lg
          max-h-80 overflow-hidden
          z-50
          animate-fade-in
        `}>
                    {/* 搜索框 */}
                    {filteredSites.length > 5 && (
                        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="搜索站点..."
                                    className={`
                    w-full pl-8 pr-3 py-1.5 
                    ${darkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-900'}
                    border-0 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500/20
                  `}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                />
                                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>
                    )}

                    {/* 选项列表 */}
                    <div className="overflow-y-auto max-h-60 py-1">
                        <div
                            onClick={() => handleSelect('')}
                            className={`
                px-3 py-2 cursor-pointer text-sm
                flex items-center justify-between
                ${value === ''
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                    : 'text-gray-900 dark:text-gray-100'
                                }
                hover:bg-gray-50 dark:hover:bg-gray-700
                transition-colors
              `}
                        >
                            <span>全部站点</span>
                            {value === '' && (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                        {filteredSites.map(site => (
                            <div
                                key={site.id}
                                onClick={() => handleSelect(site.name)}
                                className={`
                  px-3 py-2 cursor-pointer text-sm
                  flex items-center justify-between
                  ${value === site.name
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                        : 'text-gray-900 dark:text-gray-100'
                                    }
                  hover:bg-gray-50 dark:hover:bg-gray-700
                  transition-colors
                `}
                            >
                                <span>{site.name}</span>
                                {value === site.name && (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                        ))}
                        {filteredSites.length === 0 && (
                            <div className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                                未找到匹配的站点
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SiteSelector;
