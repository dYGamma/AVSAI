import React from 'react';

const Loader = ({ size = 48 }) => {
  const s = `${size}px`;
  return (
    <div className="w-full h-full flex items-center justify-center py-10">
      <div style={{ width: s, height: s }} className="rounded-full relative flex items-center justify-center">
        <svg className="animate-spin" style={{ width: s, height: s }} viewBox="0 0 50 50">
          <defs>
            <linearGradient id="g" x1="0" x2="1">
              <stop offset="0%" stopColor="#7dd3c9"/>
              <stop offset="100%" stopColor="#10a37f"/>
            </linearGradient>
          </defs>
          <circle cx="25" cy="25" r="20" stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
          <path d="M45 25a20 20 0 0 0-20-20" stroke="url(#g)" strokeWidth="6" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    </div>
  );
};

export default Loader;
