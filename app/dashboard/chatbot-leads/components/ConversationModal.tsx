/**
 * CONVERSATION MODAL COMPONENT
 * File: app/dashboard/chatbot-leads/components/ConversationModal.tsx
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ConversationModalProps {
  lead: {
    id: string;
    nome: string;
    email: string;
  };
  onClose: () => void;
}

interface Message {
  role: string;
  content: string;
}

export default function ConversationModal({ lead, onClose }: ConversationModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [emailLog, setEmailLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'conversation' | 'emails'>('conversation');

  useEffect(() => {
    loadData();
  }, [lead.id]);

  async function loadData() {
    setLoading(true);

    // Load conversation
    const { data: conversation } = await supabase
      .from('chatbot_conversations')
      .select('messages')
      .eq('lead_id', lead.id)
      .single();

    if (conversation?.messages) {
      setMessages(conversation.messages);
    }

    // Load email log
    const { data: emails } = await supabase
      .from('chatbot_email_log')
      .select('*')
      .eq('lead_id', lead.id)
      .order('inviata_at', { ascending: false });

    if (emails) {
      setEmailLog(emails);
    }

    setLoading(false);
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-500 to-purple-600 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-white">
              💬 Conversazione - {lead.nome}
            </h2>
            <p className="text-sm text-blue-100 mt-1">
              {lead.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('conversation')}
              className={`pb-3 px-2 font-medium transition-colors border-b-2 ${
                activeTab === 'conversation'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              💬 Conversazione ({messages.length})
            </button>
            <button
              onClick={() => setActiveTab('emails')}
              className={`pb-3 px-2 font-medium transition-colors border-b-2 ${
                activeTab === 'emails'
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              📧 Email Log ({emailLog.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
          ) : activeTab === 'conversation' ? (
            /* Conversation View */
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  Nessuna conversazione trovata
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold">
                          {msg.role === 'user' ? '👤 Cliente' : '🤖 Bot'}
                        </span>
                      </div>
                      <div className="text-sm whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Email Log View */
            <div className="space-y-3">
              {emailLog.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  Nessuna email trovata
                </div>
              ) : (
                emailLog.map((email) => (
                  <div
                    key={email.id}
                    className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            email.tipo === 'notifica_admin'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {email.tipo === 'notifica_admin' ? '📬 Admin' : '📧 Cliente'}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            email.stato === 'inviata'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {email.stato}
                          </span>
                        </div>
                        <div className="font-semibold text-gray-900">
                          {email.oggetto}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          A: {email.destinatario}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 text-right">
                        {formatTime(email.inviata_at)}
                      </div>
                    </div>
                    {email.resend_id && (
                      <div className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded">
                        ID: {email.resend_id}
                      </div>
                    )}
                    {email.errore && (
                      <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
                        ⚠️ {email.errore}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {activeTab === 'conversation' 
              ? `${messages.length} messaggi nella conversazione`
              : `${emailLog.length} email inviate`
            }
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Chiudi
          </button>
        </div>

      </div>
    </div>
  );
}