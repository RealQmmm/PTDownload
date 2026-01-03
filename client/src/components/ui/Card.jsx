import React from 'react';

const Card = ({ children, className = '', hover = false, noPadding = false }) => {
    return (
        <div className={`card-base ${hover ? 'card-hover' : ''} ${noPadding ? '' : 'p-4 md:p-6'} ${className}`}>
            {children}
        </div>
    );
};

export default Card;
