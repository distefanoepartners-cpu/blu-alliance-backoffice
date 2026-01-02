/**
 * CHATBOT LEADS DASHBOARD
 * File: app/dashboard/chatbot-leads/page.tsx
 * 
 * Dashboard completa per gestire lead generati dal chatbot
 */

import { createClient } from '@supabase/supabase-js';
import LeadsTable from './components/LeadsTable';
import LeadsStats from './components/LeadsStats';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getLeadsData() {
  // Get all leads
  const { data: leads, error: leadsError } = await supabase
    .from('chatbot_leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (leadsError) {
    console.error('Error fetching leads:', leadsError);
    return { leads: [], stats: null };
  }

  // Calculate stats
  const total = leads.length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayLeads = leads.filter(lead => 
    new Date(lead.created_at) >= today
  ).length;

  const thisWeek = new Date();
  thisWeek.setDate(thisWeek.getDate() - 7);
  const weekLeads = leads.filter(lead => 
    new Date(lead.created_at) >= thisWeek
  ).length;

  const preventiviInviati = leads.filter(lead => 
    lead.preventivo_inviato === true
  ).length;

  const stats = {
    total,
    today: todayLeads,
    week: weekLeads,
    preventiviInviati,
    conversionRate: total > 0 ? ((preventiviInviati / total) * 100).toFixed(1) : '0'
  };

  return { leads, stats };
}

export default async function ChatbotLeadsPage() {
  const { leads, stats } = await getLeadsData();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🚤 Lead Chatbot
          </h1>
          <p className="text-gray-600">
            Gestisci e monitora i lead generati dal chatbot AI
          </p>
        </div>

        {/* Stats Cards */}
        {stats && <LeadsStats stats={stats} />}

        {/* Leads Table */}
        <LeadsTable initialLeads={leads || []} />

      </div>
    </div>
  );
}