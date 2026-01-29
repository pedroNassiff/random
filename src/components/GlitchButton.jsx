import React, { useState, useEffect } from 'react';

export default function GlitchButton({ children, className = '', variant = 'nav', ...props }) {
  // Si children es un componente React (como ScrollingText), no aplicar glitch
  const isReactElement = React.isValidElement(children);
  
  const [displayText, setDisplayText] = useState(isReactElement ? children : children);
  const [isGlitching, setIsGlitching] = useState(false);
  const originalText = children;

  useEffect(() => {
    // No aplicar glitch si es un React element
    if (isReactElement) return;
    
    if (!isGlitching) {
      setDisplayText(originalText);
      return;
    }

    const chars = '!<>-_\\/[]{}—=+*^?#________';
    let frame = 0;
    const maxFrames = 15;

    const glitchInterval = setInterval(() => {
      if (frame >= maxFrames) {
        setDisplayText(originalText);
        setIsGlitching(false);
        clearInterval(glitchInterval);
        return;
      }

      const textArray = originalText.split('');
      const glitchedText = textArray
        .map((char, index) => {
          if (Math.random() < 0.5) {
            return chars[Math.floor(Math.random() * chars.length)];
          }
          return char;
        })
        .join('');

      setDisplayText(glitchedText);
      frame++;
    }, 40);

    return () => clearInterval(glitchInterval);
  }, [isGlitching, originalText, isReactElement]);

  const handleMouseEnter = () => {
    if (!isReactElement) {
      setIsGlitching(true);
    }
  };

  const variants = {
    nav: "px-5 py-2.5 text-[15px] text-[#666666] hover:text-[#1A1A1A] hover:bg-[#F5F5F5] rounded-lg transition-all duration-200",
    primary: isReactElement 
      ? "py-[14px] bg-white rounded-full text-[15px] font-medium text-[#1A1A1A] hover:bg-gray-100 transition-all duration-200 overflow-hidden"
      : "px-8 py-[14px] bg-white rounded-full text-[15px] font-medium text-[#1A1A1A] hover:bg-gray-100 transition-all duration-200 overflow-hidden",
    secondary: isReactElement
      ? "py-[18px] bg-[#1A1A1A] rounded-lg text-base font-medium text-white hover:bg-[#333333] transition-all duration-200 overflow-hidden"
      : "px-10 py-[18px] bg-[#1A1A1A] rounded-lg text-base font-medium text-white hover:bg-[#333333] transition-all duration-200"
  };

  return (
    <button
      className={`${variants[variant]} ${className}`}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {isReactElement ? children : <span className="inline-block min-w-max">{displayText}</span>}
    </button>
  );
}
