/**
 * LEADS STATS COMPONENT
 * File: app/dashboard/chatbot-leads/components/LeadsStats.tsx
 */

'use client';

interface LeadsStatsProps {
  stats: {
    total: number;
    today: number;
    week: number;
    preventiviInviati: number;
    conversionRate: string;
  };
}

export default function LeadsStats({ stats }: LeadsStatsProps) {
  const cards = [
    {
      label: 'Lead Totali',
      value: stats.total,
      icon: '👥',
      color: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-700'
    },
    {
      label: 'Oggi',
      value: stats.today,
      icon: '📅',
      color: 'bg-green-50 border-green-200',
      textColor: 'text-green-700'
    },
    {
      label: 'Questa Settimana',
      value: stats.week,
      icon: '📊',
      color: 'bg-purple-50 border-purple-200',
      textColor: 'text-purple-700'
    },
    {
      label: 'Preventivi Inviati',
      value: stats.preventiviInviati,
      icon: '📧',
      color: 'bg-orange-50 border-orange-200',
      textColor: 'text-orange-700'
    },
    {
      label: 'Conversion Rate',
      value: `${stats.conversionRate}%`,
      icon: '📈',
      color: 'bg-teal-50 border-teal-200',
      textColor: 'text-teal-700'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`${card.color} border-2 rounded-xl p-6 transition-all hover:shadow-lg`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">{card.icon}</span>
          </div>
          <div className={`text-3xl font-bold ${card.textColor} mb-1`}>
            {card.value}
          </div>
          <div className="text-sm text-gray-600 font-medium">
            {card.label}
          </div>
        </div>
      ))}
    </div>
  );
}