import React from 'react';

export default function ScrollingText({ text, speed = 20, className = '', textColor = 'text-white' }) {
  return (
    <div className={`relative overflow-hidden w-full h-full flex items-center ${className}`}>
      <div 
        className={`inline-flex whitespace-nowrap gap-8 text-[13px] ${textColor} tracking-[0.5px]`}
        style={{
          animation: `scroll ${speed}s linear infinite`
        }}
      >
        <span className="inline-block">{text}</span>
        <span className="inline-block">{text}</span>
        <span className="inline-block">{text}</span>
        <span className="inline-block">{text}</span>
      </div>
      <style>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
