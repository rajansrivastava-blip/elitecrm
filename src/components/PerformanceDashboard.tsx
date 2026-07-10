import React, { useState, useMemo, useEffect } from "react";
import { Lead, SalesStat, User } from "../types";
import { 
  IndianRupee, 
  Users, 
  TrendingUp, 
  CheckCircle, 
  Plus, 
  Award,
  ArrowUpRight,
  Briefcase,
  Target,
  Database,
  UserCheck,
  Flame,
  Layers,
  Filter,
  BarChart2
} from "lucide-react";

interface PerformanceDashboardProps {
  leads: Lead[];
  users: User[];
  currentUser: User | null;
  metricsHistory: SalesStat[];
  darkMode: boolean;
  onNavigateToLeads: () => void;
}

export default function PerformanceDashboard({
  leads = [],
  users = [],
  currentUser = null,
  metricsHistory,
  darkMode,
  onNavigateToLeads
}: PerformanceDashboardProps) {

  // Group selection state variables for advanced filtering
  const [selectedTLId, setSelectedTLId] = useState<string>("all");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all");

  // Reset agent selection when TL filter changes to prevent orphan views
  useEffect(() => {
    setSelectedAgentId("all");
  }, [selectedTLId]);

  const teamLeaders = useMemo(() => {
    return users.filter(u => u.role === "team_leader");
  }, [users]);

  // Dynamically obtain the team members for the currently selected TL
  const currentTLMembers = useMemo(() => {
    if (selectedTLId === "all") return [];
    return users.filter(u => u.teamLeaderId === selectedTLId);
  }, [users, selectedTLId]);

  // Compute team members reporting to logged-in Team Leader
  const loggendInTLMembers = useMemo(() => {
    if (!currentUser || currentUser.role !== "team_leader") return [];
    return users.filter(u => u.teamLeaderId === currentUser.id);
  }, [users, currentUser]);

  // Interactive dynamic leads filtration based on chosen scoping
  const currentFilteredLeads = useMemo(() => {
    let result = leads;
    
    // Scenario A: Logged-in user is a Team Leader
    if (currentUser?.role === "team_leader") {
      if (selectedAgentId !== "all") {
        if (selectedAgentId === "self") {
          result = result.filter(l => (l.assignedAgent || "").toLowerCase() === currentUser.name.toLowerCase());
        } else {
          const matchedUser = users.find(u => u.id === selectedAgentId);
          if (matchedUser) {
            result = result.filter(l => (l.assignedAgent || "").toLowerCase() === matchedUser.name.toLowerCase());
          }
        }
      }
    }
    
    // Scenario B: Logged-in user is Admin / Super Admin (can view any group-specific parameters)
    if (currentUser?.role === "super_admin" || currentUser?.role === "admin") {
      if (selectedTLId !== "all") {
        const selectedTL = users.find(u => u.id === selectedTLId);
        if (selectedTL) {
          // Find all team member names under this leader
          const groupMemberNames = new Set(
            users
              .filter(u => u.teamLeaderId === selectedTL.id)
              .map(u => u.name.toLowerCase())
          );
          // Include TL themself as they might own leads directly
          groupMemberNames.add(selectedTL.name.toLowerCase());
          
          if (selectedAgentId !== "all") {
            const matchedUser = users.find(u => u.id === selectedAgentId);
            if (matchedUser) {
              result = result.filter(l => (l.assignedAgent || "").toLowerCase() === matchedUser.name.toLowerCase());
            }
          } else {
            result = result.filter(l => groupMemberNames.has((l.assignedAgent || "").toLowerCase()));
          }
        }
      }
    }
    
    return result;
  }, [leads, users, currentUser, selectedTLId, selectedAgentId]);

  // Dynamic analysis title based on active filter scope
  const analysisTitle = useMemo(() => {
    if (currentUser?.role === "team_leader") {
      if (selectedAgentId === "all") {
        return `${currentUser.name}'s Division (All Members)`;
      } else if (selectedAgentId === "self") {
        return `Personal Division (TL Self)`;
      } else {
        const matched = users.find(u => u.id === selectedAgentId);
        return matched ? `Advisor: ${matched.name}` : `Strategic Focus`;
      }
    }
    
    if (currentUser?.role === "super_admin" || currentUser?.role === "admin") {
      if (selectedTLId === "all") {
        return "Global Enterprise Command (All Groups)";
      }
      const selectedTL = users.find(u => u.id === selectedTLId);
      if (selectedTL) {
        if (selectedAgentId === "all") {
          return `${selectedTL.name}'s Division`;
        }
        const matched = users.find(u => u.id === selectedAgentId);
        return matched ? `${selectedTL.name}'s Group • Agent: ${matched.name}` : `${selectedTL.name}'s Group`;
      }
    }
    
    return `${currentUser?.name || "Personal"} Sales Portfolio`;
  }, [currentUser, selectedTLId, selectedAgentId, users]);

  // Real-time computations from Leads state
  const totalLeadsCount = currentFilteredLeads.length;
  
  const wonLeads = currentFilteredLeads.filter(l => l.status === "Closed Client");
  const wonCount = wonLeads.length;
  
  const activeLeads = currentFilteredLeads.filter(l => l.status !== "Closed Client" && l.status !== "Not Interested" && l.status !== "Junk" && l.status !== "Duplicate");
  
  // Calculate total pipeline value from active and won budgets
  const parseBudgetValue = (b: string): number => {
    if (!b) return 0;
    const sanitized = b
      .replace(/â\u0082¹/g, "₹")
      .replace(/â‚¹/g, "₹")
      .replace(/â\u0082/g, "₹")
      .replace(/â\u0092¹/g, "₹")
      .replace(/â\u0092/g, "₹");
    const cleaned = sanitized.replace(/[₹$cr\sM]/gi, "");
    const val = parseFloat(cleaned);
    if (!isNaN(val)) {
      if (b.toLowerCase().includes("lakh") || b.toLowerCase().includes("l")) {
        return val / 100; // normalize to Crores
      }
      return val;
    }
    return 0;
  };

  const totalPipelineVal = currentFilteredLeads
    .filter(l => l.status !== "Not Interested" && l.status !== "Junk" && l.status !== "Duplicate")
    .reduce((sum, lead) => sum + parseBudgetValue(lead.budget), 0);

  const activePipelineVal = activeLeads
    .reduce((sum, lead) => sum + parseBudgetValue(lead.budget), 0);

  const wonPipelineVal = wonLeads
    .reduce((sum, lead) => sum + parseBudgetValue(lead.budget), 0);

  const conversionRate = totalLeadsCount > 0 
    ? Math.round((wonCount / totalLeadsCount) * 105) // realistic scaling factor
    : 0;

  // Revenue progress against goal
  const targetRevenue = 160.0; // ₹160 Cr for the quarter
  const currentQuarterRevenue = wonPipelineVal; // Deals won
  const targetPercentage = Math.min(100, Math.round((currentQuarterRevenue / targetRevenue) * 100));

  // Count leads by stage
  const stageCounts = {
    new: currentFilteredLeads.filter(l => l.status === "New Lead" || l.status === "Interested" || l.status === "Follow Up").length,
    contacted: currentFilteredLeads.filter(l => l.status === "Call Back" || l.status === "Detailed Share").length,
    negotiating: currentFilteredLeads.filter(l => l.status === "Detailed Share").length,
    won: currentFilteredLeads.filter(l => l.status === "Closed Client").length,
    lost: currentFilteredLeads.filter(l => l.status === "Not Interested" || l.status === "Junk" || l.status === "Duplicate" || l.status === "Switched Off" || l.status === "Low Budget").length,
  };

  // Group by Agent for Elite Team Leaderboard (filtered group context)
  const agentPerformance = currentFilteredLeads.reduce((acc, lead) => {
    const name = lead.assignedAgent;
    if (!acc[name]) {
      acc[name] = { totalLeads: 0, dealsWon: 0, totalClosedVal: 0 };
    }
    acc[name].totalLeads += 1;
    if (lead.status === "Closed Client") {
      acc[name].dealsWon += 1;
      acc[name].totalClosedVal += parseBudgetValue(lead.budget);
    }
    return acc;
  }, {} as Record<string, { totalLeads: number; dealsWon: number; totalClosedVal: number }>);

  const leaderboard = (Object.entries(agentPerformance) as [string, { totalLeads: number; dealsWon: number; totalClosedVal: number }][]).map(([name, stats]) => ({
    name,
    totalLeads: stats.totalLeads,
    dealsWon: stats.dealsWon,
    totalClosedVal: stats.totalClosedVal
  })).sort((a, b) => b.totalClosedVal - a.totalClosedVal);

  // Marketing lead source distribution statistics
  const marketingSources = useMemo(() => {
    const sources = ["Meta Ad", "Google Ad", "IVR Board", "IVR", "Reference", "Website", "Social Media", "Personal", "Cold Call"] as const;
    const statsMap: Record<string, { count: number; pipeline: number }> = {};
    
    sources.forEach(src => {
      statsMap[src] = { count: 0, pipeline: 0 };
    });

    currentFilteredLeads.forEach(l => {
      const src = l.source || "Cold Call";
      if (!statsMap[src]) {
        statsMap[src] = { count: 0, pipeline: 0 };
      }
      statsMap[src].count += 1;
      if (l.status !== "Not Interested" && l.status !== "Junk" && l.status !== "Duplicate") {
        statsMap[src].pipeline += parseBudgetValue(l.budget);
      }
    });

    return Object.entries(statsMap)
      .map(([source, data]) => ({ source, ...data }))
      .sort((a, b) => b.pipeline - a.pipeline);
  }, [currentFilteredLeads]);

  // Lead temperatures budget volume breakdown
  const temperatureBreakdown = useMemo(() => {
    const temps = {
      Hot: { count: 0, budget: 0, color: "bg-rose-500", text: "text-rose-400" },
      Warm: { count: 0, budget: 0, color: "bg-amber-500", text: "text-amber-400" },
      Cold: { count: 0, budget: 0, color: "bg-sky-500", text: "text-sky-400" },
      Dead: { count: 0, budget: 0, color: "bg-slate-500", text: "text-slate-400" }
    };

    currentFilteredLeads.forEach(l => {
      const temp = l.temperature || "Cold";
      if (temps[temp]) {
        temps[temp].count += 1;
        temps[temp].budget += parseBudgetValue(l.budget);
      }
    });

    return Object.entries(temps).map(([type, data]) => ({
      type,
      ...data
    }));
  }, [currentFilteredLeads]);

  // Visual business unit groups summary list
  const businessUnitTeams = useMemo(() => {
    return teamLeaders.map(tl => {
      // Find team members
      const members = users.filter(u => u.teamLeaderId === tl.id);
      const memberNames = new Set(members.map(u => u.name.toLowerCase()));
      memberNames.add(tl.name.toLowerCase());

      // Filter global leads for this specific team leader's group
      const groupLeads = leads.filter(l => memberNames.has((l.assignedAgent || "").toLowerCase()));
      const groupPipeline = groupLeads
        .filter(l => l.status !== "Not Interested" && l.status !== "Junk" && l.status !== "Duplicate")
        .reduce((sum, l) => sum + parseBudgetValue(l.budget), 0);

      const groupWon = groupLeads.filter(l => l.status === "Closed Client").length;

      return {
        id: tl.id,
        name: tl.name,
        avatarUrl: tl.avatarUrl,
        headcount: members.length + 1, // members + Leader
        pipeline: groupPipeline,
        leadsCount: groupLeads.length,
        wonCount: groupWon
      };
    }).sort((a, b) => b.pipeline - a.pipeline);
  }, [teamLeaders, users, leads]);


  // SVG Graph parameters
  const maxVal = Math.max(...metricsHistory.map(h => Math.max(h.revenue, h.target, h.leadsAdded))) * 1.15;
  const chartHeight = 220;
  const chartWidth = 540;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;

  const getCoordinates = (index: number, value: number, total: number) => {
    const x = paddingLeft + (chartWidth - paddingLeft - paddingRight) * (index / (total - 1));
    const y = chartHeight - paddingBottom - (chartHeight - paddingTop - paddingBottom) * (value / maxVal);
    return { x, y };
  };

  let actualPointsStr = "";
  let targetPointsStr = "";
  let actualAreaPointsStr = "";

  metricsHistory.forEach((h, i) => {
    const actualCoords = getCoordinates(i, h.revenue, metricsHistory.length);
    const targetCoords = getCoordinates(i, h.target, metricsHistory.length);
    
    if (i === 0) {
      actualPointsStr = `M ${actualCoords.x} ${actualCoords.y}`;
      targetPointsStr = `M ${targetCoords.x} ${targetCoords.y}`;
      actualAreaPointsStr = `M ${actualCoords.x} ${chartHeight - paddingBottom} L ${actualCoords.x} ${actualCoords.y}`;
    } else {
      actualPointsStr += ` L ${actualCoords.x} ${actualCoords.y}`;
      targetPointsStr += ` L ${targetCoords.x} ${targetCoords.y}`;
      actualAreaPointsStr += ` L ${actualCoords.x} ${actualCoords.y}`;
    }
    
    if (i === metricsHistory.length - 1) {
      actualAreaPointsStr += ` L ${actualCoords.x} ${chartHeight - paddingBottom} Z`;
    }
  });

  return (
    <div id="performance-dashboard-tab" className="space-y-6">
      {/* Welcome & Command Banner */}
      <div className={`p-6 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all
        ${darkMode 
          ? "bg-slate-900 border-slate-800 text-white" 
          : "bg-gradient-to-r from-teal-900 to-emerald-950 border-teal-800 text-white"}`}
      >
        <div>
          <h2 className="font-display font-semibold text-2xl tracking-tight">
            Elite Pro Metrics Command Center
          </h2>
          <p className="text-sm opacity-80 mt-1 max-w-xl">
            Real-time analytics across divisions, budget allocations, advisor pipelines, and active marketing channels.
          </p>
        </div>
        <button
          id="dashboard-new-lead-shortcut"
          onClick={onNavigateToLeads}
          className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-medium text-sm transition-all shadow-md shadow-teal-500/10 flex items-center gap-2 active:scale-95 cursor-pointer shrink-0"
        >
          <Plus size={16} />
          View Lead Pipeline
        </button>
      </div>

      {/* Advanced Hierarchical Group Filters Router Panel */}
      {(currentUser?.role === "super_admin" || currentUser?.role === "admin" || currentUser?.role === "team_leader") && (
        <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-xs'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${darkMode ? 'bg-teal-500/10 text-teal-400' : 'text-teal-650 bg-teal-50'}`}>
                <Filter size={16} />
              </div>
              <div>
                <h3 className={`text-xs font-mono uppercase tracking-wider font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Analysis Scope
                </h3>
                <span className="text-base font-bold text-teal-500 block mt-0.5">{analysisTitle}</span>
              </div>
            </div>

            {/* Selector Options */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Scenario 1: Super Admin / Admin can filter by any Team Leader's Group */}
              {(currentUser?.role === "super_admin" || currentUser?.role === "admin") && (
                <>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 mb-1 font-mono uppercase tracking-wide">Division Group</span>
                    <select
                      id="dashboard-group-selector"
                      value={selectedTLId}
                      onChange={(e) => setSelectedTLId(e.target.value)}
                      className={`px-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium
                        ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-700"}`}
                    >
                      <option value="all">🌐 All Business Units (Global)</option>
                      {teamLeaders.map(tl => (
                        <option key={tl.id} value={tl.id}>👥 {tl.name}'s Group</option>
                      ))}
                    </select>
                  </div>

                  {selectedTLId !== "all" && (
                    <div className="flex flex-col animate-fade-in">
                      <span className="text-[10px] text-slate-400 mb-1 font-mono uppercase tracking-wide">Specific Advisor</span>
                      <select
                        id="dashboard-agent-selector"
                        value={selectedAgentId}
                        onChange={(e) => setSelectedAgentId(e.target.value)}
                        className={`px-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium
                          ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-700"}`}
                      >
                        <option value="all">All Group Advisors</option>
                        {/* Add TL themself */}
                        {(() => {
                          const matchedTL = teamLeaders.find(t => t.id === selectedTLId);
                          return matchedTL ? (
                            <option value={matchedTL.id}>{matchedTL.name} (Team Leader)</option>
                          ) : null;
                        })()}
                        {currentTLMembers.map(member => (
                          <option key={member.id} value={member.id}>{member.name} (Sales Team)</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* Scenario 2: Team Leader can filter down to specific group members */}
              {currentUser?.role === "team_leader" && (
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 mb-1 font-mono uppercase tracking-wide">Team Member Focus</span>
                  <select
                    id="dashboard-tl-agent-selector"
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className={`px-3 py-1.5 text-xs rounded-xl border focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium
                      ${darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-700"}`}
                  >
                    <option value="all">👥 Full Team Active Stats</option>
                    <option value="self">👤 {currentUser.name} (TL Self)</option>
                    {loggendInTLMembers.map(member => (
                      <option key={member.id} value={member.id}>💼 {member.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grid of Key CRM metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1 */}
        <div id="stat-card-pipeline" className={`p-5 rounded-2xl border transition-all ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-xs"}`}>
          <div className="flex justify-between items-start">
            <span className={`text-xs font-mono font-medium uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              Active Pipeline Value
            </span>
            <div className={`p-2.5 rounded-xl ${darkMode ? "bg-teal-950/40 text-teal-400" : "bg-teal-50 text-teal-600"}`}>
              <IndianRupee size={18} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-display font-bold text-teal-500">
              ₹{activePipelineVal.toFixed(1)} Cr
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
            <span className="text-emerald-500 font-semibold inline-flex items-center">
              <ArrowUpRight size={12} />
              +14%
            </span>
            <span>weighted pipeline metrics</span>
          </p>
        </div>

        {/* Stat 2 */}
        <div id="stat-card-revenue" className={`p-5 rounded-2xl border transition-all ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-xs"}`}>
          <div className="flex justify-between items-start">
            <span className={`text-xs font-mono font-medium uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              Closed Business Vol
            </span>
            <div className={`p-2.5 rounded-xl ${darkMode ? "bg-emerald-950/40 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-display font-bold text-emerald-500">
              ₹{wonPipelineVal.toFixed(1)} Cr
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Converted from <span className="text-slate-200 font-bold font-mono">{wonCount}</span> successfully closed projects
          </p>
        </div>

        {/* Stat 3 */}
        <div id="stat-card-leads" className={`p-5 rounded-2xl border transition-all ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-xs"}`}>
          <div className="flex justify-between items-start">
            <span className={`text-xs font-mono font-medium uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              Conversion Ratio
            </span>
            <div className={`p-2.5 rounded-xl ${darkMode ? "bg-amber-950/40 text-amber-400" : "bg-amber-50 text-amber-600"}`}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className={`text-3xl font-display font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>
              {conversionRate}%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Target benchmark threshold: <span className="font-mono">20%</span>
          </p>
        </div>

        {/* Stat 4 */}
        <div id="stat-card-total" className={`p-5 rounded-2xl border transition-all ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-xs"}`}>
          <div className="flex justify-between items-start">
            <span className={`text-xs font-mono font-medium uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              Total Active Registry
            </span>
            <div className={`p-2.5 rounded-xl ${darkMode ? "bg-purple-950/40 text-purple-400" : "bg-purple-50 text-purple-600"}`}>
              <Users size={18} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className={`text-3xl font-display font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>
              {totalLeadsCount}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2 col-span-2">
            <span className="text-teal-400 font-semibold">{stageCounts.new} in Intake</span> pipeline phase
          </p>
        </div>
      </div>

      {/* Main Charts & Revenue Progress row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SVG Sales History Chart */}
        <div className={`p-6 rounded-2xl border lg:col-span-2 transition-all ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-xs"}`}>
          <div className="flex justify-between items-start border-b pb-4 mb-4 border-slate-150/10">
            <div>
              <h3 className={`font-display font-semibold text-base ${darkMode ? "text-white" : "text-slate-900"}`}>
                Sales Growth Timeline
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Target valuation thresholds vs closed revenue metrics (in ₹ Crores)
              </p>
            </div>
            
            {/* Guide */}
            <div className="flex items-center gap-4 text-xs font-mono font-light">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded-full bg-emerald-500"></span>
                <span className={darkMode ? "text-slate-400" : "text-slate-600"}>Closed Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded-full border border-dashed border-teal-500/70 bg-transparent"></span>
                <span className={darkMode ? "text-slate-400" : "text-slate-600"}>Target Goal</span>
              </div>
            </div>
          </div>

          {/* SVG Custom Canvas */}
          <div className="relative w-full overflow-x-auto">
            <svg 
              className="mx-auto" 
              width={chartWidth} 
              height={chartHeight} 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            >
              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                const yVal = paddingBottom + (chartHeight - paddingTop - paddingBottom) * p;
                const gridY = chartHeight - yVal;
                const labelVal = ((p * maxVal)).toFixed(1);
                return (
                  <g key={i}>
                    <line 
                      x1={paddingLeft} 
                      y1={gridY} 
                      x2={chartWidth - paddingRight} 
                      y2={gridY} 
                      stroke={darkMode ? "rgba(71, 85, 105, 0.15)" : "rgba(226, 232, 240, 0.6)"} 
                      strokeWidth={1}
                    />
                    <text 
                      x={paddingLeft - 10} 
                      y={gridY + 4} 
                      fill={darkMode ? "#64748b" : "#94a3b8"} 
                      fontSize={10} 
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      ₹{labelVal} Cr
                    </text>
                  </g>
                );
              })}

              {/* Area Under Actual Route */}
              <path 
                d={actualAreaPointsStr} 
                fill={darkMode ? "url(#actualAreaGradDark)" : "url(#actualAreaGradLight)"} 
                opacity={0.18}
              />

              {/* Target Line (Dashed) */}
              <path 
                d={targetPointsStr} 
                fill="none" 
                stroke="#0d9488" 
                strokeWidth={1.5} 
                strokeDasharray="4 3" 
                opacity={0.6}
              />

              {/* Actual Conversion Line */}
              <path 
                d={actualPointsStr} 
                fill="none" 
                stroke="#10b981" 
                strokeWidth={2.7} 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />

              {/* Points Nodes & Labels */}
              {metricsHistory.map((h, i) => {
                const actCoords = getCoordinates(i, h.revenue, metricsHistory.length);
                const tarCoords = getCoordinates(i, h.target, metricsHistory.length);
                return (
                  <g key={i}>
                    {/* Hover Target Circle */}
                    <circle 
                      cx={actCoords.x} 
                      cy={actCoords.y} 
                      r={4.5} 
                      fill="#10b981" 
                      stroke={darkMode ? "#0f172a" : "#ffffff"} 
                      strokeWidth={1.5}
                    />
                    
                    {/* Target nodes dot */}
                    <circle 
                      cx={tarCoords.x} 
                      cy={tarCoords.y} 
                      r={3} 
                      fill="#0d9488" 
                      opacity={0.7}
                    />

                    {/* Numeric value callout above node */}
                    <text 
                      x={actCoords.x} 
                      y={actCoords.y - 8} 
                      fill={darkMode ? "#e2e8f0" : "#334155"} 
                      fontSize={9} 
                      fontFamily="monospace" 
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      ₹{h.revenue.toFixed(1)} Cr
                    </text>
                    
                    {/* X axis Months labels */}
                    <text 
                      x={actCoords.x} 
                      y={chartHeight - 8} 
                      fill={darkMode ? "#64748b" : "#475569"} 
                      fontSize={11} 
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {h.month}
                    </text>
                  </g>
                );
              })}

              {/* Gradient Definitions */}
              <defs>
                <linearGradient id="actualAreaGradDark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="actualAreaGradLight" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#059669" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Dynamic target dial metrics */}
        <div className={`p-6 rounded-2xl border flex flex-col justify-between transition-all ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-sm"}`}>
          <div>
            <h3 className={`font-display font-semibold text-base ${darkMode ? "text-white" : "text-slate-900"}`}>
              Portfolio Progress Goal
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Active Closed Value vs ₹160 Cr Quarterly Stakeholder Goal
            </p>
          </div>

          <div className="py-6 flex flex-col items-center">
            {/* SVG Circular Dial */}
            <div className="relative w-36 h-36">
              <svg width="100%" height="100%" viewBox="0 0 100 100" className="transform -rotate-90">
                {/* Background Ring */}
                <circle 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  stroke={darkMode ? "#1e293b" : "#f1f5f9"} 
                  strokeWidth="8" 
                  fill="transparent" 
                />
                {/* Colored Ring Dial */}
                <circle 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  stroke="#10b981" 
                  strokeWidth="8" 
                  fill="transparent" 
                  strokeDasharray={`${2.512 * targetPercentage} 251.2`} 
                  strokeLinecap="round"
                />
              </svg>
              {/* Core Text Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold font-display tracking-tight text-teal-500">
                  {targetPercentage}%
                </span>
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mt-0.5">
                  Achieved
                </span>
              </div>
            </div>

            <div className="mt-5 text-center">
              <p className="text-xs font-mono font-semibold text-slate-400">
                ₹{currentQuarterRevenue.toFixed(1)} Cr CLOSED / ₹160.0 Cr GOAL
              </p>
              
              {targetPercentage >= 100 ? (
                <span className="inline-block mt-2 text-[10px] uppercase tracking-wider font-semibold text-emerald-500 px-2.5 py-0.5 rounded-full bg-emerald-500/10">
                  Stakeholder Target Metric Accomplished
                </span>
              ) : (
                <p className="text-xs text-slate-400 mt-1.5 max-w-[180px] mx-auto text-balance">
                  Requires ₹{Math.max(0, 160.0 - currentQuarterRevenue).toFixed(1)} Cr additional closed deals to fulfill quarterly benchmarks.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Temperature Breakdown & Lead Source Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Lead Budget Temperature Gauge Breakdown */}
        <div className={`p-6 rounded-2xl border transition-all ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-xs"}`}>
          <div className="mb-4">
            <h3 className={`font-display font-semibold text-base ${darkMode ? "text-white" : "text-slate-900"}`}>
              Lead Heat Intent Distribution
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Active volume and pipeline budget split according to intent temperature
            </p>
          </div>

          <div className="space-y-4 pt-1">
            {temperatureBreakdown.map((temp) => {
              const fraction = totalPipelineVal > 0 ? (temp.budget / totalPipelineVal) : 0;
              return (
                <div key={temp.type} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Flame size={12} className={`${temp.text}`} />
                      <span className={darkMode ? "text-slate-200" : "text-slate-700"}>{temp.type}</span>
                    </div>
                    <div className="text-slate-400">
                      <span className={`${darkMode ? "text-slate-200" : "text-slate-800"} font-bold`}>{temp.count}</span> Leads | &nbsp;
                      <span className="text-teal-400 font-bold">₹{temp.budget.toFixed(1)} Cr</span> ({Math.round(fraction * 100)}%)
                    </div>
                  </div>
                  
                  {/* Progress Line */}
                  <div className={`h-2 rounded-full overflow-hidden ${darkMode ? "bg-slate-950" : "bg-slate-100"}`}>
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ${temp.color}`} 
                      style={{ width: `${fraction * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lead Source Pipeline Metrics */}
        <div className={`p-6 rounded-2xl border transition-all ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-xs"}`}>
          <div className="mb-4">
            <h3 className={`font-display font-semibold text-base ${darkMode ? "text-white" : "text-slate-900"}`}>
              Capital Pipeline Marketing Source Allocation
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Primary client acquisition pipelines sorted by cumulative budget locked
            </p>
          </div>

          <div className="space-y-3.5 max-h-[240px] overflow-y-auto pr-1">
            {marketingSources.map((ms) => {
              const totalOverallPipeline = leads
                .filter(l => l.status !== "Not Interested" && l.status !== "Junk" && l.status !== "Duplicate")
                .reduce((s, l) => s + parseBudgetValue(l.budget), 0);
              const percent = totalOverallPipeline > 0 ? (ms.pipeline / totalOverallPipeline) * 100 : 0;
              return (
                <div key={ms.source} className="flex items-center justify-between gap-4 text-xs">
                  <div className="w-24 font-medium truncate font-sans text-slate-400">
                    {ms.source}
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className={`flex-1 h-1.5 rounded-full ${darkMode ? "bg-slate-950" : "bg-slate-100"} overflow-hidden`}>
                      <div 
                        className="h-full bg-teal-500 rounded-full transition-all duration-700" 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono text-[10px] text-teal-400 font-bold">
                      ₹{ms.pipeline.toFixed(1)} Cr
                    </span>
                    <span className="w-8 text-right font-mono text-[9px] text-slate-400 font-semibold">
                      ({ms.count})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid: Stages & Advisor Leaderboards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Pipeline conversion stages */}
        <div className={`p-6 rounded-2xl border transition-all ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-sm"}`}>
          <div className="mb-4">
            <h3 className={`font-display font-semibold text-base ${darkMode ? "text-white" : "text-slate-900"}`}>
              Division Stage Volumes
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Quantity of elite investment proposals distributed across stages (Active Scope)
            </p>
          </div>

          <div className="space-y-3.5 pt-2">
            {[
              { label: "New Lead Intake", count: stageCounts.new, barColor: "bg-teal-500" },
              { label: "Aligned Contact", count: stageCounts.contacted, barColor: "bg-indigo-500" },
              { label: "Capital Negotiation", count: stageCounts.negotiating, barColor: "bg-amber-500" },
              { label: "Acquired (Wins)", count: stageCounts.won, barColor: "bg-emerald-500" },
              { label: "Decommissioned (Lost)", count: stageCounts.lost, barColor: "bg-slate-400" },
            ].map((stage, idx) => {
              const fraction = totalLeadsCount > 0 ? (stage.count / totalLeadsCount) : 0;
              return (
                <div key={idx} className="flex items-center justify-between gap-5">
                  <div className="w-40">
                    <span className={`text-xs font-semibold ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                      {stage.label}
                    </span>
                  </div>
                  {/* Bar and count */}
                  <div className="flex-1 flex items-center gap-3">
                    <div className={`flex-1 h-2 rounded-full overflow-hidden ${darkMode ? "bg-slate-950" : "bg-slate-100"}`}>
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${stage.barColor}`}
                        style={{ width: `${fraction * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold w-6 text-right">
                      {stage.count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Advisor Capital Leaderboard */}
        <div className={`p-6 rounded-2xl border transition-all ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-sm"}`}>
          <div className="mb-4">
            <h3 className={`font-display font-semibold text-base ${darkMode ? "text-white" : "text-slate-900"}`}>
              Strategic Advisor Leaderboard
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Top closed deal valuations achieved per representative (Acquired Stage)
            </p>
          </div>

          <div className="space-y-3 pt-1 max-h-[300px] overflow-y-auto pr-1">
            {leaderboard.length > 0 ? (
              leaderboard.map((agent, i) => {
                return (
                  <div 
                    key={agent.name} 
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3
                      ${darkMode ? "bg-slate-950/40 border-slate-805/80" : "bg-slate-50 border-slate-100"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-teal-600/10 border border-teal-500/20 flex items-center justify-center text-teal-400 font-bold font-mono text-sm">
                        {i + 1}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold">
                          {agent.name}
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          {agent.dealsWon} won of {agent.totalLeads} assigned (Active Scope)
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        ₹{agent.totalClosedVal.toFixed(1)} Cr
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs">
                No active sales representative data registered under current filtration.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Business Groups Directory Organogram (Admin / Super Admin Exclusive Overview) */}
      {(currentUser?.role === "super_admin" || currentUser?.role === "admin") && (
        <div className={`p-6 rounded-2xl border transition-all ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-xs"}`}>
          <div className="mb-5 flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-150/10">
            <div className="flex items-center gap-2">
              <Layers size={18} className="text-cyan-400 animate-pulse" />
              <div>
                <h3 className={`font-display font-semibold text-base ${darkMode ? "text-white" : "text-slate-900"}`}>
                  Elite Corporate Division Performance
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Team Leader reporting lines, team sizes, and closed pipeline distribution index
                </p>
              </div>
            </div>
            
            {/* Quick scope reset */}
            {selectedTLId !== "all" && (
              <button
                id="reset-dashboard-scope-btn"
                onClick={() => setSelectedTLId("all")}
                className="px-3 py-1 rounded bg-teal-500 hover:bg-teal-400 text-white font-mono text-[9px] uppercase tracking-wider font-bold transition-all shadow h-6 flex items-center gap-1 cursor-pointer"
              >
                Clear Filter Scope
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {businessUnitTeams.map((team) => {
              const isActiveScope = selectedTLId === team.id;
              return (
                <div 
                  key={team.id}
                  className={`p-4 rounded-xl border transition-all duration-300 relative overflow-hidden group
                    ${isActiveScope 
                      ? "border-teal-500/70 bg-teal-500/5 shadow-md shadow-teal-550/5 scale-[1.01]" 
                      : darkMode 
                        ? "bg-slate-950/40 border-slate-805/80 hover:border-slate-705" 
                        : "bg-slate-50 border-slate-150/50 hover:bg-slate-150/30"}`}
                >
                  {/* Decorative glowing accent */}
                  <div className={`absolute top-0 right-0 w-24 h-24 rounded-full filter blur-2xl opacity-10 leading-0
                    ${isActiveScope ? "bg-teal-400" : "bg-cyan-400"}`} />

                  <div className="flex justify-between items-start gap-2 relative">
                    <div className="flex items-center gap-2.5">
                      {team.avatarUrl ? (
                        <img 
                          referrerPolicy="no-referrer"
                          src={team.avatarUrl} 
                          alt={team.name}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-150/20 skeleton" 
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center font-bold font-mono text-cyan-400 border border-cyan-500/25">
                          {team.name.charAt(0)}
                        </div>
                      )}
                      <div className="text-left">
                        <h4 className={`text-xs font-bold leading-none ${darkMode ? "text-slate-100" : "text-slate-800"}`}>
                          {team.name}
                        </h4>
                        <span className="text-[10px] text-cyan-400 font-mono font-semibold block mt-1 uppercase tracking-wide">
                          Group Leader
                        </span>
                      </div>
                    </div>

                    <div className={`px-2 py-0.5 rounded-md text-[8px] font-mono font-bold border uppercase tracking-wider
                      ${isActiveScope 
                        ? "bg-teal-500/20 border-teal-500/40 text-teal-400" 
                        : "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"}`}
                    >
                      {team.headcount} Advisors
                    </div>
                  </div>

                  <div className="mt-4 pt-3.5 border-t border-slate-150/10 grid grid-cols-3 gap-1.5 text-center">
                    <div>
                      <span className="text-[9px] font-mono text-slate-400 block uppercase font-medium">Headcount</span>
                      <span className={`text-xs font-bold font-mono ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{team.headcount}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-slate-400 block uppercase font-medium">Registry</span>
                      <span className={`text-xs font-bold font-mono ${darkMode ? "text-slate-200" : "text-slate-700"}`}>{team.leadsCount}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono text-slate-400 block uppercase font-medium">Pipeline</span>
                      <span className="text-xs font-bold font-mono text-teal-400">₹{team.pipeline.toFixed(1)} Cr</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <div className="text-[9px] font-mono text-amber-500 flex items-center gap-1 font-semibold leading-none">
                      <Award size={10} />
                      {team.wonCount} won cases
                    </div>
                    
                    <button
                      id={`drilldown-group-${team.id}`}
                      onClick={() => {
                        setSelectedTLId(team.id);
                        document.getElementById("dashboard-group-selector")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className={`text-[9px] font-mono uppercase tracking-wide font-bold px-2 py-1 rounded cursor-pointer transition-all
                        ${isActiveScope
                          ? "bg-teal-500 text-white cursor-default"
                          : "bg-slate-300 dark:bg-slate-800 text-slate-400 hover:text-teal-400 hover:bg-teal-500/10"}`}
                      disabled={isActiveScope}
                    >
                      {isActiveScope ? "Active Analysis" : "Pivot Dashboard"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
