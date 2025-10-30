
import React from 'react';

export const FireIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.287 8.287 0 0 0 3-2.553 8.252 8.252 0 0 1 3.362-1.834Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12.572A9.736 9.736 0 0 0 12 21a9.736 9.736 0 0 0-7.5-8.428" />
  </svg>
);