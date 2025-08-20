import React from 'react';
import clsx from 'clsx';

/**
 * Props:
 *  - variant: 'primary' | 'ghost' | 'outline'
 *  - className: additional classes
 *  - ...rest
 */
const Button = ({ variant = 'primary', children, className = '', ...rest }) => {
  const base = 'btn';
  const variantClass = variant === 'primary'
    ? 'btn-primary'
    : (variant === 'ghost' ? 'btn-ghost' : 'border border-gray-700 bg-dark-card text-gray-200');

  return (
    <button className={clsx(base, variantClass, className)} {...rest}>
      {children}
    </button>
  );
};

export default Button;
