-- ====================================================================
-- ELITE PRO CRM - SUPABASE DATABASE SCHEMA INITIALIZATION
-- ====================================================================
-- Run this code in your Supabase SQL Editor (https://supabase.com)
-- to instantly configure the backend tables for leads, users, appointments,
-- communication logs, and activity audit trails.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. USERS TABLE (Corporate Advising Agents & Administation Profiles)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,                       -- Matching Supabase auth.users.id
    name TEXT NOT NULL,                        -- Full name of advisor
    email TEXT NOT NULL UNIQUE,                -- Corporate email address
    phone TEXT,                                -- Direct WhatsApp / Mobile connection
    role TEXT NOT NULL DEFAULT 'sales_team',   -- super_admin | admin | sales_team
    avatar_url TEXT,                           -- Profile image photo URL
    department TEXT NOT NULL DEFAULT 'Sales',  -- Advisory branch/team department
    password TEXT,                             -- Local preset password fallback
    team_leader_id TEXT,                       -- Direct reporting manager ID
    active BOOLEAN NOT NULL DEFAULT true       -- Is account active or deactivated
);

-- --------------------------------------------------------------------
-- 2. LEADS TABLE (Commercial Customer Pipeline Records)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
    id TEXT PRIMARY KEY,                       -- Custom CRM UID (e.g. lead-xxxx)
    name TEXT NOT NULL,                        -- Lead contact name
    company TEXT,                              -- Corporate entity/employer name
    position TEXT,                             -- Job title / corporate role
    email TEXT NOT NULL,                       -- Contact email address
    phone TEXT NOT NULL,                       -- Contact telephone number
    source TEXT NOT NULL,                      -- Lead capture channel (e.g., Campaign, organic)
    status TEXT NOT NULL DEFAULT 'new',        -- new | contacted | qualified | proposal | closed_won | closed_lost
    temperature TEXT NOT NULL DEFAULT 'warm',  -- hot | warm | cold
    budget TEXT,                               -- Approximate investment size or bracket
    location TEXT,                             -- Geographic location (city, state)
    assigned_agent TEXT,                       -- Email/ID of assigned consultant/broker
    notes TEXT,                                -- Freeform conversation/history details
    project_name TEXT,                         -- Property developer project interest
    date_created TEXT,                         -- Description created
    date_updated TEXT,                         -- Description updated
    last_communication TEXT,                   -- Timestamp of last communication action
    score INTEGER NOT NULL DEFAULT 50,         -- Dynamic lead prioritising score (1-100)
    assignment_timestamp BIGINT,               -- Miliseconds timestamp of assignment
    assigned_tl_id TEXT,                       -- Direct leader assignee ID matching users
    last_action_timestamp BIGINT,              -- Inactivity tracking reset timestamp
    reassigned_timestamp BIGINT                -- Redundant backup assignment timestamp
);

-- Create simple speed index for common filters
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_agent ON public.leads(assigned_agent);

-- --------------------------------------------------------------------
-- 3. APPOINTMENTS TABLE (Sales Advisory Reminders & Onsite Calendars)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.appointments (
    id TEXT PRIMARY KEY,                       -- Appointment UID
    lead_id TEXT REFERENCES public.leads(id) ON DELETE CASCADE, -- Linked lead
    lead_name TEXT,                            -- Denormalized contact name reference
    title TEXT NOT NULL,                       -- Title of alignment meeting
    date TEXT NOT NULL,                        -- Date (YYYY-MM-DD)
    time TEXT NOT NULL,                        -- Time (HH:MM)
    type TEXT NOT NULL,                        -- Call | Video | Property Site Tour | Proposal Presentation
    notes TEXT,                                -- Key targets or notes of discussion
    is_completed BOOLEAN NOT NULL DEFAULT false, -- Tour/meeting outcome completion is_completed flag
    reminder_active BOOLEAN NOT NULL DEFAULT true   -- Calendar push parameters flag
);

-- --------------------------------------------------------------------
-- 4. COMMUNICATION LOGS TABLE (Historical Advisors Logs & Inbounds)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_logs (
    id TEXT PRIMARY KEY,                       -- Log UID
    lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE, -- Target lead
    date TEXT NOT NULL,                        -- Date and time of action
    type TEXT NOT NULL,                        -- call | email | whatsapp | note
    content TEXT NOT NULL,                     -- Meeting recap / text content of correspondence
    sender TEXT NOT NULL                       -- Advisor who sent / documented the item
);

-- --------------------------------------------------------------------
-- 5. LEAD EDIT LOGS TABLE (Revision History Integrity & Audits)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_edit_logs (
    id TEXT PRIMARY KEY,                       -- Edit audit UID
    lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE, -- Edited lead reference
    lead_name TEXT NOT NULL,                   -- Name of modified lead
    editor_name TEXT NOT NULL,                 -- Corporate agent name making updates
    editor_role TEXT NOT NULL,                 -- Role metadata level of actioner
    timestamp TEXT NOT NULL,                   -- ISO string of action execution
    changes JSONB NOT NULL                     -- Array of detailed changes: {field, old, new}
);

-- --------------------------------------------------------------------
-- OPTIONAL PROTOTYPING ACCESS: DISABLE ROW LEVEL SECURITY (RLS)
-- --------------------------------------------------------------------
-- By default, Supabase secures new tables with strict Row Level Security.
-- To allow instant read/write transactions directly from your React client
-- during testing, run these commands to bypass RLS.
-- --------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assignment_timestamp BIGINT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_tl_id TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_action_timestamp BIGINT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS reassigned_timestamp BIGINT;

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_edit_logs DISABLE ROW LEVEL SECURITY;

-- If you prefer enabling RLS with unrestricted read/writes policies later:
-- CREATE POLICY "Allow public read" ON public.leads FOR SELECT USING (true);
-- CREATE POLICY "Allow public insert" ON public.leads FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow public update" ON public.leads FOR UPDATE USING (true);
-- CREATE POLICY "Allow public delete" ON public.leads FOR DELETE USING (true);
