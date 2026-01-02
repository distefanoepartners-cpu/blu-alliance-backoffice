/**
 * LEAD CARD COMPONENT
 * File: app/dashboard/chatbot-leads/components/LeadCard.tsx
 */

'use client';

interface LeadCardProps {
  lead: {
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
  };
  onViewConversation: () => void;
}

export default function LeadCard({ lead, onViewConversation }: LeadCardProps) {
  const getServizioIcon = (servizio: string) => {
    switch (servizio) {
      case 'tour': return '🏖️';
      case 'noleggio': return '⛵';
      case 'taxi': return '🚤';
      default: return '📋';
    }
  };

  const getStatoBadge = (stato: string) => {
    const badges = {
      nuovo: 'bg-blue-100 text-blue-800',
      preventivo_inviato: 'bg-green-100 text-green-800',
      prenotato: 'bg-purple-100 text-purple-800',
      completato: 'bg-gray-100 text-gray-800'
    };
    return badges[stato as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6 hover:bg-gray-50 transition-colors">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        
        {/* Lead Info */}
        <div className="flex-1">
          <div className="flex items-start gap-4">
            
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-2xl">
                {getServizioIcon(lead.servizio)}
              </div>
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              
              {/* Nome & Badge */}
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {lead.nome || 'Nome non fornito'}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatoBadge(lead.stato)}`}>
                  {lead.stato.replace('_', ' ')}
                </span>
                {lead.preventivo_inviato && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    ✉️ Preventivo
                  </span>
                )}
              </div>

              {/* Contatti */}
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                <div className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href={`mailto:${lead.email}`} className="hover:text-blue-600">
                    {lead.email}
                  </a>
                </div>
                {lead.telefono && (
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <a href={`tel:${lead.telefono}`} className="hover:text-blue-600">
                      {lead.telefono}
                    </a>
                  </div>
                )}
              </div>

              {/* Dettagli richiesta */}
              <div className="flex flex-wrap gap-3 text-sm">
                {lead.servizio && (
                  <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1 rounded-full">
                    <span className="font-medium text-blue-700">
                      {lead.servizio.charAt(0).toUpperCase() + lead.servizio.slice(1)}
                    </span>
                    {lead.destinazione && (
                      <span className="text-blue-600">
                        → {lead.destinazione}
                      </span>
                    )}
                  </div>
                )}
                {lead.data && lead.data !== 'da definire' && (
                  <div className="flex items-center gap-1.5 bg-green-50 px-3 py-1 rounded-full text-green-700">
                    📅 {lead.data}
                  </div>
                )}
                {lead.persone && (
                  <div className="flex items-center gap-1.5 bg-purple-50 px-3 py-1 rounded-full text-purple-700">
                    👥 {lead.persone} {lead.persone === 1 ? 'persona' : 'persone'}
                  </div>
                )}
                {lead.orario && lead.orario !== 'da definire' && (
                  <div className="flex items-center gap-1.5 bg-orange-50 px-3 py-1 rounded-full text-orange-700">
                    ⏰ {lead.orario}
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <div className="mt-3 text-xs text-gray-500">
                Creato: {formatDate(lead.created_at)}
                {lead.preventivo_inviato_at && (
                  <span className="ml-3">
                    • Preventivo: {formatDate(lead.preventivo_inviato_at)}
                  </span>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 md:flex-col md:items-end">
          <button
            onClick={onViewConversation}
            className="flex-1 md:flex-initial px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Conversazione
          </button>
          
          <a
            href={`mailto:${lead.email}`}
            className="flex-1 md:flex-initial px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email
          </a>
        </div>

      </div>
    </div>
  );
}