import React, { useState, useRef, useEffect } from "react";
import { 
  Bell, 
  Check, 
  Trash2, 
  ExternalLink, 
  X, 
  Megaphone, 
  Database, 
  Calendar,
  Layers,
  ArrowRight,
  Filter
} from "lucide-react";
import { AppNotification, User } from "../types";

interface NotificationCenterProps {
  notifications: AppNotification[];
  currentUser: User;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onNavigateToLead?: (leadId: string) => void;
  darkMode: boolean;
  users?: User[];
}

export default function NotificationCenter({
  notifications,
  currentUser,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onNavigateToLead,
  darkMode,
  users,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('unread');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter notifications based on role
  // TL sees team notifications. Sales Team sees notifications assigned directly to them.
  // Super Admin and Admin can see ALL notifications in the system to monitor active workflow routing.
  const isPrivileged = currentUser.role === "super_admin" || currentUser.role === "admin";
  
  const relevantNotifications = notifications.filter(notif => {
    if (isPrivileged) return true;
    
    const recipientLower = (notif.recipientName || "").trim().toLowerCase();
    const currentUserNameLower = (currentUser.name || "").trim().toLowerCase();
    
    if (recipientLower === currentUserNameLower) return true;
    
    // For Team Leaders, also include notifications for members of their team
    if (currentUser.role === "team_leader") {
      const activeUsers = users || (() => {
        try {
          const saved = localStorage.getItem("elite_pro_users");
          return saved ? JSON.parse(saved) : [];
        } catch {
          return [];
        }
      })();
      
      const teamMemberNames = activeUsers
        .filter((u: any) => u.teamLeaderId === currentUser.id)
        .map((u: any) => (u.name || "").trim().toLowerCase());
        
      return teamMemberNames.includes(recipientLower);
    }
    
    return false;
  });

  const unreadCount = relevantNotifications.filter(n => !n.isRead).length;

  const filteredNotifications = relevantNotifications.filter(notif => {
    if (activeTab === 'unread') {
      return !notif.isRead;
    }
    return true;
  });

  const maskText = (text: string): string => {
    if (!text) return text;
    if (!currentUser || (currentUser.role !== "sales_team" && currentUser.role !== "team_leader")) {
      return text;
    }

    let masked = text;
    const activeUsers: User[] = users || (() => {
      try {
        const saved = localStorage.getItem("elite_pro_users");
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    })();

    const namesToMask = activeUsers
      .map(u => u.name)
      .filter((name): name is string => typeof name === "string" && name.trim().length > 0 && name.toLowerCase() !== currentUser.name.toLowerCase())
      .sort((a, b) => b.length - a.length);

    const safetyPreserves = [
      "Jeevak Raina",
      "Kunal Wadhwa",
      "Kaushal Midha",
      "Rajan Srivastava",
    ];
    safetyPreserves.forEach(pName => {
      if (pName.toLowerCase() !== currentUser.name.toLowerCase() && !namesToMask.includes(pName)) {
        namesToMask.push(pName);
      }
    });

    namesToMask.forEach(name => {
      const escaped = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');
      masked = masked.replace(regex, "••••••");
    });

    return masked;
  };

  const getSourceBadgeColor = (source?: string) => {
    const s = (source || "").toLowerCase();
    if (s.includes("meta")) return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    if (s.includes("google")) return "bg-red-500/10 text-red-400 border border-red-500/20";
    if (s.includes("ivr")) return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
    if (s.includes("website")) return "bg-purple-500/10 text-purple-400 border border-purple-500/30";
    return "bg-slate-500/10 text-slate-400 border border-slate-500/20";
  };

  const getNotificationIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'assignment':
        return <Layers className="w-4 h-4 text-emerald-400" />;
      case 'sync':
        return <Database className="w-4 h-4 text-cyan-400" />;
      case 'update':
        return <Calendar className="w-4 h-4 text-indigo-400" />;
      default:
        return <Megaphone className="w-4 h-4 text-teal-400" />;
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} id="notification-center-module">
      {/* Target button */}
      <button
        id="notification-bell-trigger"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl border flex items-center justify-center transition cursor-pointer active:scale-95 text-slate-350
          ${darkMode 
            ? "bg-slate-900 border-slate-800 hover:bg-slate-850 hover:text-white" 
            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-xs hover:text-slate-950"}`}
        title="View Notifications"
      >
        <Bell size={18} className={unreadCount > 0 ? "animate-swing" : ""} />
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white leading-none ring-2 ring-white dark:ring-slate-950">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Container */}
      {isOpen && (
        <div 
          id="notification-dropdown-popup"
          className={`absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl border shadow-2xl z-50 overflow-hidden transform origin-top-right transition duration-200
            ${darkMode 
              ? "bg-slate-900 border-slate-800 text-slate-100" 
              : "bg-white border-slate-200 text-slate-900"}`}
        >
          {/* Header */}
          <div className={`p-4 border-b flex items-center justify-between ${darkMode ? "border-slate-800 bg-slate-900" : "border-slate-150 bg-slate-50"}`}>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm sm:text-base tracking-tight flex items-center gap-1.5">
                <Bell size={16} className="text-teal-400" />
                Notification Inbox
                {isPrivileged && (
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider bg-teal-500/10 text-teal-400 px-1.5 py-0.5 rounded">
                    Global Logger
                  </span>
                )}
              </span>
            </div>
            
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-450 hover:text-slate-300 transition"
            >
              <X size={16} />
            </button>
          </div>

          {/* Quick Stats & Tabs */}
          <div className={`px-4 py-2 border-b flex items-center justify-between text-xs font-mono font-semibold
            ${darkMode ? "border-slate-800/80 bg-slate-900/60" : "border-slate-100 bg-slate-50/50"}`}>
            <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab('unread')}
                className={`py-1 px-2.5 rounded-lg transition-colors ${activeTab === 'unread' ? (darkMode ? 'bg-slate-800 text-teal-450' : 'bg-slate-200 text-teal-800') : 'text-slate-500'}`}
              >
                Unread ({unreadCount})
              </button>
              <button 
                onClick={() => setActiveTab('all')}
                className={`py-1 px-2.5 rounded-lg transition-colors ${activeTab === 'all' ? (darkMode ? 'bg-slate-800 text-teal-450' : 'bg-slate-200 text-teal-800') : 'text-slate-500'}`}
              >
                All ({relevantNotifications.length})
              </button>
            </div>

            {unreadCount > 0 && (
              <button 
                onClick={onMarkAllAsRead}
                className="text-teal-400 hover:text-teal-300 transition flex items-center gap-1 hover:underline text-[11px]"
              >
                <Check size={12} />
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-800/20 select-none">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center text-slate-500">
                <Bell size={24} className="opacity-20 mb-2" />
                <span className="text-xs font-mono">No notifications to display</span>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div 
                  key={notif.id}
                  className={`p-4 transition duration-150 relative ${!notif.isRead ? (darkMode ? 'bg-teal-500/5 hover:bg-slate-850' : 'bg-slate-50/50 hover:bg-slate-100/50') : (darkMode ? 'hover:bg-slate-850' : 'hover:bg-slate-50')}`}
                >
                  <div className="flex gap-3 items-start">
                    {/* Color dot for unread status */}
                    {!notif.isRead && (
                      <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-teal-450 shrink-0" />
                    )}

                    <div className={`p-2 rounded-xl mt-0.5 shrink-0
                      ${darkMode ? "bg-slate-800/80 text-slate-300" : "bg-slate-100/80 text-slate-800"}`}
                    >
                      {getNotificationIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-xs font-semibold tracking-tight text-teal-400">
                          {notif.title}
                        </span>
                        
                        {notif.source && (
                          <span className={`text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${getSourceBadgeColor(notif.source)}`}>
                            {notif.source}
                          </span>
                        )}
                      </div>

                      <p className={`text-xs mt-1 leading-snug break-words ${darkMode ? 'text-slate-350' : 'text-slate-650'}`}>
                        {maskText(notif.message)}
                      </p>

                      <div className="flex items-center justify-between mt-2.5">
                        <span className="text-[9px] font-mono text-slate-500">
                          {notif.timestamp}
                        </span>

                        <div className="flex items-center gap-2">
                          {/* If a parent lead, show rapid entry button */}
                          {notif.leadId && onNavigateToLead && (
                            <button
                              onClick={() => {
                                onNavigateToLead(notif.leadId!);
                                setIsOpen(false);
                              }}
                              className="text-[10px] font-mono text-teal-400 hover:text-teal-350 font-bold flex items-center gap-0.5 transition cursor-pointer"
                              title="Go directly to lead profile"
                            >
                              Go to Lead <ArrowRight size={10} />
                            </button>
                          )}
                          
                          {/* Individual read button */}
                          {!notif.isRead && (
                            <button
                              onClick={() => onMarkAsRead(notif.id)}
                              className="p-1 rounded bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:text-emerald-400 transition"
                              title="Mark read"
                            >
                              <Check size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Area */}
          <div className={`p-3 border-t text-center flex items-center justify-between text-xs font-mono
            ${darkMode ? "border-slate-800 bg-slate-900/90" : "border-slate-150 bg-slate-50"}`}>
            {isPrivileged && (
              <span className="text-[10px] text-slate-500">
                Sys Total: {notifications.length}
              </span>
            )}
            {!isPrivileged && <div />}
            
            {relevantNotifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="text-rose-455 hover:text-rose-400 transition flex items-center gap-1 font-semibold ml-auto hover:underline"
              >
                <Trash2 size={12} />
                Clear Inbox
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
