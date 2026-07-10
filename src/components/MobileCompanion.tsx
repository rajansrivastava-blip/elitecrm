import React, { useState } from "react";
import { Lead, CommunicationLog, User } from "../types";
import { 
  Smartphone, 
  MapPin, 
  CheckCircle, 
  Sparkles, 
  Send, 
  Building2, 
  Briefcase, 
  User as UserIcon, 
  Map, 
  Phone, 
  Mail, 
  Clock,
  RefreshCcw,
  RefreshCw,
  Eye,
  Check
} from "lucide-react";

interface MobileCompanionProps {
  leads: Lead[];
  onUpdateLead: (lead: Lead) => void;
  onAddCommunicationLog: (log: Omit<CommunicationLog, "id">) => void;
  onTriggerSync: () => void;
  darkMode: boolean;
  currentUser?: User | null;
}

export default function MobileCompanion({
  leads,
  onUpdateLead,
  onAddCommunicationLog,
  onTriggerSync,
  darkMode,
  currentUser
}: MobileCompanionProps) {
  
  // Choose lead to update
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leads[0]?.id || "");
  const selectedLead = leads.find(l => l.id === selectedLeadId);

  // Form states on mobile screen
  const [synopsisNote, setSynopsisNote] = useState("");
  const [isCheckInActive, setIsCheckInActive] = useState(false);
  const [syncDoneMsg, setSyncDoneMsg] = useState("");
  const [isMobileConnecting, setIsMobileConnecting] = useState(false);

  // Status stage choices on mobile
  const [mobileStatus, setMobileStatus] = useState<Lead["status"]>(() => {
    return leads[0]?.status || "Interested";
  });

  // Keep mobileStatus in sync with selected lead or external updates
  React.useEffect(() => {
    const found = leads.find(l => l.id === selectedLeadId);
    if (found) {
      setMobileStatus(found.status);
    }
  }, [selectedLeadId, leads]);

  // Handle select change - pull lead details and lock initial status choice
  const handleLeadChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedLeadId(id);
    setSynopsisNote("");
  };

  // Check In site coordination action
  const handleSiteCheckIn = () => {
    if (!selectedLead) return;
    setIsCheckInActive(true);
    
    setTimeout(() => {
      onAddCommunicationLog({
        leadId: selectedLead.id,
        date: new Date().toISOString().split("T")[0],
        type: "site_visit",
        content: `[MOBILE COMPANION CHECK-IN] Representative arrived physically at target site coordinate boundary in "${selectedLead.location}". Client coordination loop refreshed.`,
        sender: currentUser?.name || "Viren Mehta"
      });

      // Update Lead dateUpdated
      onUpdateLead({
        ...selectedLead,
        dateUpdated: new Date().toISOString().split("T")[0],
        lastCommunication: new Date().toISOString().split("T")[0]
      });

      setIsCheckInActive(false);
      setSyncDoneMsg("Physical check-in registered & synced to database logs!");
      onTriggerSync(); // Force core sync animation

      setTimeout(() => {
        setSyncDoneMsg("");
      }, 3000);
    }, 1500);
  };

  // Mobile quick update on the go
  const handleOnGoUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    setIsMobileConnecting(true);

    const mergedNotes = synopsisNote 
      ? `[Mobile Update on Go]: "${synopsisNote}" --- (Previous notes: ${selectedLead.notes})` 
      : selectedLead.notes;

    setTimeout(() => {
      onUpdateLead({
        ...selectedLead,
        status: mobileStatus,
        notes: mergedNotes,
        dateUpdated: new Date().toISOString().split("T")[0],
        lastCommunication: new Date().toISOString().split("T")[0]
      });

      // Log communication call/email
      onAddCommunicationLog({
        leadId: selectedLead.id,
        date: new Date().toISOString().split("T")[0],
        type: "call",
        content: `[MOBILE APP SUBMISSION] Status updated to "${mobileStatus}". Synopsis summary: ${synopsisNote || "(No text synopsis recorded)"}`,
        sender: `${currentUser?.name || "Viren Mehta"} (Field Link)`
      });

      setIsMobileConnecting(false);
      setSynopsisNote("");
      setSyncDoneMsg("Lead updated physically & synced seamlessly with Core CRM Database!");
      onTriggerSync();

      setTimeout(() => {
        setSyncDoneMsg("");
      }, 3000);
    }, 1200);
  };

  return (
    <div id="mobile-companion-tab" className="space-y-6">
      
      {/* Intro descriptive row */}
      <div className={`p-6 rounded-2xl border transition-all ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-sm"}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-405">
              <Smartphone size={22} className="stroke-[1.75]" />
            </div>
            <div>
              <h3 className={`font-display font-semibold text-lg ${darkMode ? "text-white" : "text-slate-905"}`}>
                Elite Pro Field Companion Simulator
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Mock smartphone system highlighting high-fidelity mobile workspace sync for on-site advisors updating database records in real-time.
              </p>
            </div>
          </div>

          <div className="text-xs font-mono bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-xl border border-emerald-500/15">
            🔑 Bi-directional WebSocket Link: Active
          </div>
        </div>
      </div>

      {/* Simulator workspace container split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Mock Smartphone hardware container wrap */}
        <div className="lg:col-span-5 flex justify-center">
          
          <div 
            id="simulated-smartphone"
            className="w-[335px] h-[670px] rounded-[48px] bg-slate-950 border-[10px] border-slate-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col justify-between"
          >
            {/* Top Bar Speaker & Camera notch cutout */}
            <div className="absolute top-2.5 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-slate-950 rounded-full z-30 flex items-center justify-center gap-1.5 px-3">
              <div className="w-10 h-1 bg-slate-800 rounded-full"></div>
              <div className="w-2.5 h-2.5 bg-slate-850 rounded-full border border-slate-900"></div>
            </div>

            {/* Mobile Screen Area */}
            <div className="flex-1 flex flex-col justify-between text-slate-205 p-5 pt-11 text-xs select-none">
              
              {/* Header inside screen */}
              <div>
                <div className="flex justify-between items-center pb-2 border-b border-white/5 font-mono text-[9px] text-slate-400">
                  <span>ElitePro Field-v2.5</span>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    <span>SYNCED</span>
                  </div>
                </div>

                <div className="mt-3 text-left">
                  <span className="text-[9px] uppercase tracking-wider font-semibold opacity-65 font-mono">Representative Context</span>
                  <h4 className="font-display font-semibold text-sm text-teal-400">{currentUser?.name || "Viren Mehta"}</h4>
                  <p className="opacity-50 text-[10px] mt-0.5">{currentUser?.department || "Executive Board"} Client alignment loop</p>
                </div>

                {/* Form Selection */}
                <div className="mt-4 p-3 bg-slate-900/80 rounded-xl space-y-2 border border-white/5">
                  <label className="block text-[8px] font-mono uppercase tracking-widest text-slate-400 font-bold">Target Client Alignment Account</label>
                  <select
                    id="mobile-lead-picker"
                    value={selectedLeadId}
                    onChange={handleLeadChange}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-2 py-1.5 rounded text-[11px] appearance-auto cursor-pointer focus:outline-none"
                  >
                    {leads.map(l => (
                      <option key={l.id} value={l.id}>{l.name} {l.projectName ? `[Proj: ${l.projectName}]` : l.company ? `(${l.company})` : ""}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Core Screen Context Body */}
              <div className="flex-1 my-3 overflow-y-auto pr-0.5 space-y-3.5 text-left">
                {selectedLead ? (
                  <>
                    {/* Display current statistics segment */}
                    <div className="p-3 bg-slate-900 border border-white/5 rounded-xl space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">
                            {selectedLead.projectName ? `Project: ${selectedLead.projectName}` : "Lead Source Route"}
                          </span>
                          <h5 className="font-semibold text-teal-400 text-xs truncate max-w-[170px]">{selectedLead.source}</h5>
                        </div>
                        <span className="px-1.5 py-0.5 bg-orange-500/10 text-orange-400 rounded-md font-mono text-[8px] font-bold uppercase tracking-wider">
                          {selectedLead.budget}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[9px] pt-1.5 border-t border-white/5 text-slate-400">
                        <div className="flex items-center gap-1">
                          <MapPin size={11} className="text-amber-500 flex-shrink-0" />
                          <span className="truncate">{selectedLead.location}</span>
                        </div>
                        <div className="flex items-center gap-1 font-semibold text-slate-300 capitalize">
                          <Clock size={11} className="text-teal-400 flex-shrink-0" />
                          <span>Status: {selectedLead.status}</span>
                        </div>
                      </div>
                    </div>

                    {/* Site Check-in GPS Simulation Module */}
                    <div className="p-3 bg-slate-900/60 border border-teal-500/15 rounded-xl space-y-2.5">
                      <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest block font-bold">Physical Site Boundary Alignment</span>
                      
                      <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-white/5 font-mono text-[9px] text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Map size={11} className="text-amber-400" />
                          <span>GPS Coordinate Lock</span>
                        </div>
                        <span className="text-white font-medium">Auto-Range Valid</span>
                      </div>

                      <button
                        id="mobile-checkin-action"
                        type="button"
                        onClick={handleSiteCheckIn}
                        disabled={isCheckInActive}
                        className="w-full py-2 bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition duration-150 cursor-pointer disabled:opacity-50 active:scale-95 select-none"
                      >
                        {isCheckInActive ? (
                          <>
                            <RefreshCw size={11} className="animate-spin" />
                            Locking Coordinates...
                          </>
                        ) : (
                          <>
                            <MapPin size={11} className="animate-pulse" />
                            Register Boundary Arrival Check-in
                          </>
                        )}
                      </button>
                    </div>

                    {/* Quick Database Notes change Form */}
                    <form onSubmit={handleOnGoUpdate} className="space-y-2">
                      <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest block font-bold leading-none">Record On-the-Go Refinement</span>
                      
                      <div className="space-y-1">
                        <label className="text-[8px] text-slate-500 font-medium">Refined Pipeline Stage</label>
                        <select
                          id="mobile-status-picker"
                          value={mobileStatus}
                          onChange={(e) => setMobileStatus(e.target.value as Lead["status"])}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-200 px-2 py-1.5 rounded text-[10px] focus:outline-none"
                        >
                          <option value="New Lead">🆕 New Lead</option>
                          <option value="Interested">👍 Interested</option>
                          <option value="Follow Up">📞 Follow Up</option>
                          <option value="Detailed Share">🤝 Detailed Share</option>
                          <option value="Meeting Done">🎉 Meeting Done</option>
                          <option value="Site Visit">🏗️ Site Visit</option>
                          <option value="Closed Client">💼 Closed Client</option>
                          <option value="Call Back">🔄 Call Back</option>
                          <option value="Not Interested">❌ Not Interested</option>
                          <option value="Not Pick">🔇 Not Pick</option>
                          <option value="Switched Off">📴 Switched Off</option>
                          <option value="Low Budget">📉 Low Budget</option>
                          <option value="Junk">🗑️ Junk</option>
                          <option value="Duplicate">👥 Duplicate</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] text-slate-500 font-medium">Client demands synopsis</label>
                        <textarea
                          id="mobile-synopsis-notes"
                          rows={2}
                          value={synopsisNote}
                          onChange={(e) => setSynopsisNote(e.target.value)}
                          placeholder="Note down quick demands, grid requests"
                          className="w-full bg-slate-950 border border-slate-800 text-white px-2 py-1.5 rounded text-[10px] focus:outline-none placeholder-slate-600 font-light"
                        />
                      </div>

                      <button
                        id="mobile-on-the-go-submit"
                        type="submit"
                        disabled={isMobileConnecting}
                        className="w-full py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-semibold uppercase tracking-wider transition duration-150 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 select-none"
                      >
                        {isMobileConnecting ? (
                          <>
                            <RefreshCw size={10} className="animate-spin" />
                            Syncing database...
                          </>
                        ) : (
                          <>
                            <Send size={10} />
                            Synch Record Over Go
                          </>
                        )}
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="py-20 text-center text-slate-450 text-[11px] flex flex-col items-center justify-center gap-1">
                    {currentUser?.role === "sales_team" || currentUser?.role === "team_leader" ? (
                      <>
                        <span className="font-semibold uppercase tracking-wider font-mono text-amber-500/80">No lead assigned.</span>
                        <p className="text-[10px] text-slate-500 max-w-[180px] leading-normal mt-1">Please wait for admin or round-robin auto-transfers to route leads to your workspace.</p>
                      </>
                    ) : (
                      "No leads available in registry context."
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Home indicator strip */}
              <div className="pt-2 border-t border-white/5 flex flex-col items-center">
                <div className="w-24 h-1 bg-slate-700 rounded-full bg-opacity-70"></div>
                <span className="text-[7px] font-mono text-slate-600 uppercase tracking-widest mt-1.5">Elite Pro Mobilization Suite</span>
              </div>

            </div>
          </div>

        </div>

        {/* Right Side: Informational sync logs and visual representation of mobile sync actions */}
        <div className={`lg:col-span-7 p-6 rounded-2xl border transition-all space-y-5 text-left
          ${darkMode ? "bg-slate-900 border-slate-850" : "bg-white border-slate-100 shadow-sm"}`}
        >
          <div>
            <h4 className="font-display font-semibold text-base">Bi-Directional Cloud Syncing Framework</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-lg">
              The smartphone application uses real-time event routing to sync. Every arrival check-in or client detail modified on-site instantly refreshes corporate dashboards.
            </p>
          </div>

          {/* Sync notification message alert */}
          {syncDoneMsg && (
            <div className="p-3.5 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 shadow-md shadow-emerald-500/5 flex items-center gap-2 animate-pulse">
              <CheckCircle size={14} />
              {syncDoneMsg}
            </div>
          )}

          {/* Core architecture steps graphic */}
          <div className="space-y-4">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Simulator Synchronization Flow</span>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs text-left">
              
              <div className={`p-4 rounded-xl border ${darkMode ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-405 flex items-center justify-center font-bold mb-2">1</div>
                <h5 className="font-semibold font-display">Advisor Interaction</h5>
                <p className="text-[10px] text-slate-400 mt-1">Advisor performs boundary check-in near the commercial site coordinate corridor.</p>
              </div>

              <div className={`p-4 rounded-xl border ${darkMode ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-404 flex items-center justify-center font-bold mb-2">2</div>
                <h5 className="font-semibold font-display">API Pipeline Fire</h5>
                <p className="text-[10px] text-slate-400 mt-1">Secure TLS call triggers, generating bi-directional communication logs and site verification.</p>
              </div>

              <div className={`p-4 rounded-xl border ${darkMode ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-404 flex items-center justify-center font-bold mb-2">3</div>
                <h5 className="font-semibold font-display">Dashboard Refresh</h5>
                <p className="text-[10px] text-slate-400 mt-1">Parent React state consumes parameters, refreshing analytics maps and metrics charts.</p>
              </div>

            </div>
          </div>

          {/* Static GPS alignment view representing map coordination */}
          <div className={`p-4 rounded-xl border text-xs relative ${darkMode ? "bg-slate-955 border-slate-850" : "bg-slate-50 border-slate-200"}`}>
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <Map size={14} className="text-teal-400" />
              Active Site Coordination Coordinates
            </h5>
            <p className="text-[11px] text-slate-400 font-light leading-relaxed mb-3">
              Elite Pro corporate sites are mapped with custom spatial polygons. Geofenced alignment handles on the companion mode enforce validation checklist adherence before check-in can be submitted.
            </p>

            {selectedLead && (
              <div className="p-3 rounded-lg bg-slate-900 border border-white/5 space-y-1">
                <p className="font-mono text-[10px] text-slate-400">TARGET LAND SURVEY COORDINATE ZONE:</p>
                <p className="font-semibold text-emerald-450">{selectedLead.location}</p>
                <div className="flex gap-4 font-mono text-[9px] text-slate-505 pt-2">
                  <span>LATITUDE MATCH: 28.4595° N</span>
                  <span>LONGITUDE MATCH: 77.0266° E</span>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
