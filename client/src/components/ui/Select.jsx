import React, { forwardRef } from 'react';

const Select = forwardRef(({
    label,
    error,
    options = [],
    className = '',
    children,
    ...props
}, ref) => {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    ref={ref}
                    className={`
                        w-full px-4 py-2.5 
                        bg-white dark:bg-surface-800 
                        border border-gray-200 dark:border-gray-700 
                        rounded-xl 
                        text-gray-900 dark:text-gray-100 
                        focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 
                        transition-all duration-200
                        disabled:opacity-50 disabled:cursor-not-allowed
                        appearance-none
                        ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
                        ${className}
                    `}
                    {...props}
                >
                    {children || options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                {/* Custom Chevron */}
                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500 dark:text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
            {error && (
                <p className="mt-1 text-xs text-red-500 animate-fade-in">
                    {error}
                </p>
            )}
        </div>
    );
});

Select.displayName = 'Select';

export default Select;
