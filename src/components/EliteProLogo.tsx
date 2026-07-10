import React from "react";

interface EliteProLogoProps {
  className?: string;
  scale?: number;
  darkMode?: boolean;
}

export default function EliteProLogo({ className = "", scale = 1, darkMode = false }: EliteProLogoProps) {
  return (
    <div 
      className={`flex items-center justify-center select-none font-display ${className}`} 
      style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
    >
      <div className="flex items-center gap-2.5">
        {/* Subtle decorative visual anchor representing dynamic team/infra alignment */}
        <div className="h-5 w-2 bg-gradient-to-b from-cyan-500 to-emerald-500 rounded-sm" />
        
        <span className="text-sm font-black tracking-widest uppercase inline-flex items-center gap-1.5 leading-none">
          <span className={darkMode ? "text-slate-100" : "text-slate-900"}>
            ELTE PRO INFRA
          </span>
          <span className="text-teal-500 dark:text-teal-400 font-extrabold tracking-normal text-xs bg-teal-500/10 dark:bg-teal-400/10 px-1.5 py-0.5 rounded">
            CRM
          </span>
        </span>
      </div>
    </div>
  );
}




