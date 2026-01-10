import React from 'react';

const Button = ({ children, onClick, variant = 'primary', size = 'md', className = '', disabled = false, loading = false, type = 'button', title }) => {
    const baseClass = "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95";

    const variants = {
        primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 ring-blue-500",
        secondary: "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 ring-gray-200",
        danger: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 ring-red-500",
        ghost: "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800/50 ring-gray-400",
        success: "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 ring-emerald-500",
    };

    const sizes = {
        xs: "px-2 py-1 text-xs",
        sm: "px-3 py-1.5 text-xs",
        md: "px-5 py-2.5 text-sm",
        lg: "px-6 py-3 text-base",
    };

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled || loading}
            className={`${baseClass} ${variants[variant]} ${sizes[size]} ${className}`}
            title={title}
        >
            {loading && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            )}
            {children}
        </button>
    );
};

export default Button;
