import React, { forwardRef } from 'react';

const Input = forwardRef(({
    label,
    error,
    className = '',
    type = 'text',
    containerClassName = '',
    ...props
}, ref) => {
    return (
        <div className={`w-full ${containerClassName}`}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    {label}
                </label>
            )}
            <div className="relative">
                <input
                    ref={ref}
                    type={type}
                    className={`
                        w-full px-4 py-2.5 
                        bg-white dark:bg-surface-800 
                        border border-gray-200 dark:border-gray-700 
                        rounded-xl 
                        text-base text-gray-900 dark:text-gray-100 
                        placeholder-gray-400 dark:placeholder-gray-500
                        focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 
                        transition-all duration-200
                        disabled:opacity-50 disabled:cursor-not-allowed
                        ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
                        ${className}
                    `}
                    {...props}
                />
            </div>
            {error && (
                <p className="mt-1 text-xs text-red-500 animate-fade-in">
                    {error}
                </p>
            )}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;
