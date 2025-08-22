import React from 'react';

const Card = ({ children, className = '', style = {}, ...rest }) => {
  return (
    <div className={`app-card p-4 ${className}`} style={style} {...rest}>
      {children}
    </div>
  );
};

export default Card;
