import React from "react";
import { compressAndResizeImage } from "../utils";
import { 
  Building2, 
  Users, 
  LayoutDashboard, 
  Calendar, 
  FilePieChart, 
  Smartphone, 
  RefreshCw, 
  Lock, 
  LogOut,
  Sun, 
  Moon,
  UserCheck,
  Camera,
  X
} from "lucide-react";
import { User } from "../types";
import EliteProLogo from "./EliteProLogo";

interface SidebarProps {
  currentTab: string;
  onChangeTab: (tab: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  isSyncing: boolean;
  onTriggerSync: () => void;
  isMobileModeActive: boolean;
  currentUser: User | null;
  onLogout: () => void;
  onUpdateUserAvatar: (avatarUrl: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  isSoftwarePaused?: boolean;
  onToggleSoftwarePause?: () => void;
}

export default function Sidebar({
  currentTab,
  onChangeTab,
  darkMode,
  onToggleDarkMode,
  isSyncing,
  onTriggerSync,
  isMobileModeActive,
  currentUser,
  onLogout,
  onUpdateUserAvatar,
  isOpen = false,
  onClose,
  isSoftwarePaused = false,
  onToggleSoftwarePause
}: SidebarProps) {
  
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase = await compressAndResizeImage(file, 120, 120, 0.85);
        onUpdateUserAvatar(compressedBase);
      } catch (err) {
        console.error("Failed to compress and resize sidebar avatar upload:", err);
      }
    }
  };

  const menuItems = [
    { id: "dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
    { id: "leads", label: "Lead Pipeline", icon: Users },
    { id: "calendar", label: "Appointments & Reminders", icon: Calendar },
    { id: "reports", label: "Stakeholder Reports", icon: FilePieChart },
    { id: "integrations", label: "System Sync", icon: RefreshCw },
    { id: "mobile-simulation", label: "Mobile Companion", icon: Smartphone },
    { id: "users", label: "Sales Team Accounts", icon: UserCheck },
  ];

  const isTabRestricted = (tabId: string) => {
    if (currentUser?.role === 'sales_team') {
      return tabId === "reports" || tabId === "integrations" || tabId === "users";
    }
    if (currentUser?.role === 'team_leader') {
      return tabId === "integrations";
    }
    return false;
  };

  return (
    <aside 
      id="crm-sidebar"
      className={`fixed top-0 left-0 h-full w-64 z-50 transition-transform duration-300 border-r flex flex-col justify-between
        ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        ${darkMode 
          ? "bg-slate-900 border-slate-800 text-slate-100" 
          : "bg-white border-slate-250 text-slate-800"}`}
    >
      <div>
        {/* Brand Header */}
        <div className={`p-5 pb-6 border-b flex items-center justify-between ${darkMode ? "border-slate-800 bg-slate-950/20" : "border-slate-150 bg-slate-100/10"}`}>
          <div className="flex-1 flex justify-center">
            <EliteProLogo scale={1.05} darkMode={darkMode} />
          </div>
          {onClose && (
            <button
              id="sidebar-close-btn"
              onClick={onClose}
              className={`p-1.5 rounded-lg md:hidden hover:bg-opacity-85 transition active:scale-95 text-slate-400 hover:text-rose-500`}
              title="Close Menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Sync Status Banner */}
        <div className={`px-4 py-3 mx-4 my-4 rounded-xl border flex items-center justify-between text-xs transition-all
          ${darkMode 
            ? "bg-slate-800/55 border-slate-700/60 text-slate-300" 
            : "bg-slate-50 border-slate-100 text-slate-600"}`}
        >
          <div className="flex items-center gap-2">
            <span className={`relative flex h-2.5 w-2.5`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isSyncing ? "bg-teal-400" : "bg-emerald-400"}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isSyncing ? "bg-amber-500" : "bg-emerald-500"}`}></span>
            </span>
            <span className="font-medium">
              {isSyncing ? "Syncing Calendar..." : "Connected to Workspace"}
            </span>
          </div>
          <button 
            id="force-sync-btn"
            onClick={onTriggerSync}
            disabled={isSyncing}
            className={`p-1.5 rounded-lg hover:bg-opacity-80 transition active:scale-95 disabled:opacity-50
              ${darkMode ? "hover:bg-slate-700 text-slate-400" : "hover:bg-slate-200 text-slate-500"}`}
            title="Sync existing CRM and Google Calendar systems instantly"
          >
            <RefreshCw size={13} className={`stroke-[1.5] ${isSyncing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Software Execution Pause Switch */}
        <div className={`px-4 py-2.5 mx-4 mb-4 rounded-xl border flex items-center justify-between text-xs transition-all
          ${isSoftwarePaused 
            ? "bg-amber-500/10 border-amber-500/25 text-amber-500" 
            : darkMode 
              ? "bg-slate-800/45 border-slate-700/50 text-slate-300" 
              : "bg-teal-500/5 border-teal-500/15 text-teal-700"}`}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {isSoftwarePaused ? (
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
              ) : (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              )}
            </span>
            <span className="font-semibold tracking-wide font-sans">
              {isSoftwarePaused ? "System Paused" : "System Active"}
            </span>
          </div>
          
          <button
            id="software-pause-toggle-btn"
            onClick={onToggleSoftwarePause}
            className={`px-2 py-1 rounded-lg text-[10px] font-mono tracking-wider font-bold uppercase transition active:scale-95 cursor-pointer border
              ${isSoftwarePaused 
                ? "bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400 font-extrabold" 
                : darkMode 
                  ? "bg-slate-800 border-slate-705 text-slate-300 hover:bg-slate-700 hover:text-white" 
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"}`}
            title={isSoftwarePaused ? "Resume automated system sync operations" : "Pause all background processors & sync triggers"}
          >
            {isSoftwarePaused ? "RESUME" : "PAUSE"}
          </button>
        </div>

        {/* Nav list */}
        <nav className="px-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            const isLocked = isTabRestricted(item.id);
            
            return (
              <button
                key={item.id}
                id={`sidebar-tab-${item.id}`}
                onClick={() => {
                  onChangeTab(item.id);
                  if (onClose) onClose();
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 group cursor-pointer
                  ${isActive 
                    ? "bg-teal-600 text-white shadow-sm" 
                    : darkMode 
                      ? "hover:bg-slate-850/80 text-slate-400 hover:text-slate-100" 
                      : "hover:bg-slate-50 text-slate-600 hover:text-slate-950"}`}
              >
                <Icon 
                  size={18} 
                  className={`stroke-[1.75] transition-transform group-hover:scale-105 duration-200
                    ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-500"}`} 
                />
                
                <span className="flex-1 text-left truncate">
                  {item.id === "users" && currentUser?.role === "team_leader" ? "My Sales Team" : item.label}
                </span>
                
                {isLocked && (
                  <span className="text-slate-500/70 dark:text-slate-500/80" title="Super Admin or Admin credentials required">
                    <Lock size={12} />
                  </span>
                )}
                
                {item.id === "mobile-simulation" && isMobileModeActive && (
                  <span className="ml-auto w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer controls: User information, local time, dark mode toggle */}
      <div className={`p-4 border-t flex flex-col gap-3.5 ${darkMode ? "border-slate-800/80" : "border-slate-150"}`}>
        {/* User Info */}
        {currentUser && (
          <div className="flex items-center gap-3 p-1 rounded-xl">
            <div 
              className="relative group cursor-pointer" 
              onClick={handleAvatarClick}
              title="Click to change profile portrait"
            >
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.name}
                className="w-10 h-10 rounded-xl object-cover border border-teal-500/20 shadow-sm skeleton transition group-hover:brightness-75"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/45 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Camera size={12} className="text-teal-400" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
            
            <div className="overflow-hidden flex-1 text-left">
              <p className="text-xs font-bold leading-tight truncate">{currentUser.name}</p>
              <span className={`text-[9px] font-mono font-bold uppercase tracking-wider block mt-0.5
                ${currentUser.role === "super_admin" 
                  ? "text-amber-500" 
                  : currentUser.role === "admin" 
                    ? "text-teal-400" 
                    : "text-emerald-400"}`}
              >
                {currentUser.role === "super_admin" 
                  ? "★ Super Admin" 
                  : currentUser.role === "admin" 
                    ? "♦ Board Admin" 
                    : "♠ Sales Team"}
              </span>
            </div>

            <button
              id="sidebar-logout-btn"
              onClick={onLogout}
              className={`p-2 rounded-xl border transition-all cursor-pointer active:scale-95 flex items-center justify-center hover:bg-rose-500/10 hover:border-rose-500/30 text-rose-500
                ${darkMode 
                  ? "bg-slate-800 border-slate-700" 
                  : "bg-slate-50 border-slate-200"}`}
              title="Secure Logout from Console"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}

        {/* Action controls */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest leading-none">
            CRM Console v2.5
          </span>
          
          <button
            id="theme-toggler"
            onClick={onToggleDarkMode}
            className={`p-2 rounded-xl transition duration-150 cursor-pointer border ${
              darkMode 
                ? "bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700" 
                : "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
            }`}
            title={darkMode ? "Switch to Eye-Comfort Light Mode" : "Dark Mode for Eye-Strain Control"}
          >
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>
    </aside>
  );
}
