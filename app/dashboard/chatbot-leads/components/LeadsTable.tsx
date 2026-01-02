/**
 * LEADS TABLE COMPONENT
 * File: app/dashboard/chatbot-leads/components/LeadsTable.tsx
 */

'use client';

import { useState } from 'react';
import LeadCard from './LeadCard';
import ConversationModal from './ConversationModal';

interface Lead {
  id: string;
  nome: string;
  email: string;
  telefono: string;
  servizio: string;
  destinazione: string;
  data: string;
  persone: number;
  orario: string;
  preventivo_inviato: boolean;
  preventivo_inviato_at: string;
  stato: string;
  created_at: string;
}

interface LeadsTableProps {
  initialLeads: Lead[];
}

export default function LeadsTable({ initialLeads }: LeadsTableProps) {
  const [leads, setLeads] = useState(initialLeads);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterServizio, setFilterServizio] = useState<string>('all');
  const [filterStato, setFilterStato] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showConversation, setShowConversation] = useState(false);

  // Filter leads
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.telefono?.includes(searchTerm);
    
    const matchesServizio = filterServizio === 'all' || lead.servizio === filterServizio;
    const matchesStato = filterStato === 'all' || lead.stato === filterStato;

    return matchesSearch && matchesServizio && matchesStato;
  });

  const handleViewConversation = (lead: Lead) => {
    setSelectedLead(lead);
    setShowConversation(true);
  };

  const handleExportCSV = () => {
    const headers = ['Nome', 'Email', 'Telefono', 'Servizio', 'Destinazione', 'Data', 'Persone', 'Orario', 'Preventivo Inviato', 'Stato', 'Data Creazione'];
    const rows = filteredLeads.map(lead => [
      lead.nome,
      lead.email,
      lead.telefono,
      lead.servizio || 'N/A',
      lead.destinazione || 'N/A',
      lead.data || 'N/A',
      lead.persone || 'N/A',
      lead.orario || 'N/A',
      lead.preventivo_inviato ? 'Sì' : 'No',
      lead.stato,
      new Date(lead.created_at).toLocaleString('it-IT')
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatbot-leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      
      {/* Header & Filters */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Cerca per nome, email o telefono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg
                className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <select
              value={filterServizio}
              onChange={(e) => setFilterServizio(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tutti i servizi</option>
              <option value="tour">Tour</option>
              <option value="noleggio">Noleggio</option>
              <option value="taxi">Taxi Mare</option>
            </select>

            <select
              value={filterStato}
              onChange={(e) => setFilterStato(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tutti gli stati</option>
              <option value="nuovo">Nuovo</option>
              <option value="preventivo_inviato">Preventivo Inviato</option>
              <option value="prenotato">Prenotato</option>
            </select>

            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSV
            </button>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-4 text-sm text-gray-600">
          Mostrando <span className="font-semibold">{filteredLeads.length}</span> di <span className="font-semibold">{leads.length}</span> lead
        </div>
      </div>

      {/* Leads List */}
      <div className="divide-y divide-gray-200">
        {filteredLeads.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nessun lead trovato
            </h3>
            <p className="text-gray-600">
              {searchTerm || filterServizio !== 'all' || filterStato !== 'all'
                ? 'Prova a modificare i filtri di ricerca'
                : 'I lead generati dal chatbot appariranno qui'}
            </p>
          </div>
        ) : (
          filteredLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onViewConversation={() => handleViewConversation(lead)}
            />
          ))
        )}
      </div>

      {/* Conversation Modal */}
      {showConversation && selectedLead && (
        <ConversationModal
          lead={selectedLead}
          onClose={() => {
            setShowConversation(false);
            setSelectedLead(null);
          }}
        />
      )}

    </div>
  );
}