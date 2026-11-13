"use client";

import React from "react";

export interface ForgeLoaderProps {
  message?: string;
  size?: "sm" | "md" | "lg" | "fullscreen";
  className?: string;
}

export function ForgeLoader({
  message = "Loading FormForge...",
  size = "md",
  className = "",
}: ForgeLoaderProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-12 w-12",
    lg: "h-16 w-16",
    fullscreen: "h-20 w-20",
  }[size];

  const content = (
    <div className={`flex flex-col items-center justify-center gap-3 select-none ${className}`}>
      {/* Kinetic Glowing Forge Nexus */}
      <div className={`relative ${sizeClasses} flex items-center justify-center`}>
        {/* Ambient Backlight Glow */}
        <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-md animate-pulse" />

        {/* Outer Orbital Rotating Ring */}
        <svg
          className="absolute inset-0 h-full w-full animate-spin"
          style={{ animationDuration: "3s" }}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="50"
            cy="50"
            r="44"
            stroke="url(#forge-orbit-grad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="90 180"
          />
          <defs>
            <linearGradient id="forge-orbit-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>

        {/* Counter-Rotating Specular Dot Ring */}
        <svg
          className="absolute inset-0 h-full w-full animate-spin"
          style={{ animationDuration: "6s", animationDirection: "reverse" }}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="50"
            cy="50"
            r="38"
            stroke="#38bdf8"
            strokeOpacity="0.25"
            strokeWidth="1.5"
            strokeDasharray="4 12"
          />
        </svg>

        {/* Center Forged Anvil Monogram */}
        <svg
          className="relative h-1/2 w-1/2 text-cyan-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.6)] animate-pulse"
          style={{ animationDuration: "2s" }}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Vertical Spine */}
          <path
            d="M8 5C8 4.44772 8.44772 4 9 4H11C11.5523 4 12 4.44772 12 5V19C12 19.5523 11.5523 20 11 20H9C8.44772 20 8 19.5523 8 19V5Z"
            fill="currentColor"
          />
          {/* Top Aerodynamic Beam */}
          <path
            d="M8 6C8 4.89543 8.89543 4 10 4H18C18.6 4 19 4.6 18.8 5.2L18.4 6.8C18.2 7.5 17.6 8 16.9 8H12V10H9C8.44772 10 8 9.55228 8 9V6Z"
            fill="#38bdf8"
          />
          {/* Middle Wing */}
          <path
            d="M10 11H16C16.6 11 17 11.6 16.8 12.2L16.5 13.5C16.4 14 15.9 14.4 15.4 14.4H10V11Z"
            fill="#818cf8"
          />
          {/* Electric Energy Core */}
          <circle cx="12" cy="12" r="1.5" fill="#ffffff" />
        </svg>
      </div>

      {/* Styled Contextual Message */}
      {message && (
        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="tracking-wide">{message}</span>
        </div>
      )}
    </div>
  );

  if (size === "fullscreen") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in">
        {content}
      </div>
    );
  }

  return content;
}
