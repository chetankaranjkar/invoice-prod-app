import React from 'react';
import { IndianRupee, Users, FileText, AlertCircle, Wallet, ArrowRight } from 'lucide-react';
import type { DashboardStats as DashboardStatsType } from '../types';
import { formatCurrency } from '../utils/helpers';
import { cn } from '../lib/cn';

interface DashboardStatsProps {
  stats: DashboardStatsType;
  userRole?: string;
  onViewPaid: () => void;
  onViewUnpaid: () => void;
  onViewPending?: () => void;
  onViewPendingByUser?: () => void;
  onViewAllCustomers?: () => void;
}

type StatTone = 'red' | 'indigo' | 'blue' | 'emerald' | 'amber';

const toneStyles: Record<StatTone, { iconWrap: string; ring: string; valueText: string }> = {
  red:     { iconWrap: 'bg-red-50 text-red-600',       ring: 'ring-red-100',     valueText: 'text-red-600' },
  indigo:  { iconWrap: 'bg-indigo-50 text-indigo-600', ring: 'ring-indigo-100',  valueText: 'text-indigo-600' },
  blue:    { iconWrap: 'bg-blue-50 text-blue-600',     ring: 'ring-blue-100',    valueText: 'text-slate-900' },
  emerald: { iconWrap: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-100', valueText: 'text-slate-900' },
  amber:   { iconWrap: 'bg-amber-50 text-amber-600',   ring: 'ring-amber-100',   valueText: 'text-slate-900' },
};

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  stats,
  userRole,
  onViewPaid,
  onViewUnpaid,
  onViewPending,
  onViewPendingByUser,
  onViewAllCustomers,
}) => {
  type Card = {
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: StatTone;
    onClick?: () => void;
  };

  const statCards: Card[] = [
    {
      title: 'Total Pending',
      value: formatCurrency(stats.totalPendingAmount),
      subtitle: 'Outstanding receivables',
      icon: IndianRupee,
      tone: 'red',
      onClick: onViewPendingByUser ?? onViewPending,
    },
    ...(userRole === 'Admin'
      ? [{
          title: 'My Pending',
          value: formatCurrency(stats.adminOwnPendingAmount ?? 0),
          subtitle: 'Your invoices',
          icon: Wallet,
          tone: 'indigo' as StatTone,
          onClick: onViewPending,
        }]
      : []),
    {
      title: 'Total Customers',
      value: stats.totalCustomers.toString(),
      subtitle: 'Across your business',
      icon: Users,
      tone: 'blue',
      onClick: onViewAllCustomers,
    },
    {
      title: 'Paid Customers',
      value: stats.paidCustomersCount.toString(),
      subtitle: 'Fully settled',
      icon: FileText,
      tone: 'emerald',
      onClick: onViewPaid,
    },
    {
      title: 'Unpaid Customers',
      value: stats.unpaidCustomersCount.toString(),
      subtitle: 'With balance due',
      icon: AlertCircle,
      tone: 'amber',
      onClick: onViewUnpaid,
    },
  ];

  const cardCount = statCards.length;
  return (
    <div className={cn(
      'grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6',
      cardCount <= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-5'
    )}>
      {statCards.map((card, index) => {
        const Icon = card.icon;
        const tone = toneStyles[card.tone];
        const clickable = !!card.onClick;
        return (
          <button
            key={index}
            type="button"
            onClick={card.onClick}
            disabled={!clickable}
            className={cn(
              'group text-left relative w-full min-w-0 max-w-full overflow-hidden bg-white rounded-xl border border-slate-200 p-4 sm:p-5 transition-all',
              clickable
                ? 'hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.12)] hover:-translate-y-0.5 hover:border-slate-300 cursor-pointer'
                : 'cursor-default'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={cn('h-10 w-10 rounded-lg flex items-center justify-center ring-4', tone.iconWrap, tone.ring)}>
                <Icon className="h-5 w-5" />
              </span>
              {clickable && (
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
              )}
            </div>
            <div className="mt-4 min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{card.title}</p>
              <p
                className={cn(
                  'mt-1 text-xl sm:text-2xl lg:text-xl xl:text-2xl font-bold tracking-tight tabular-nums break-words [overflow-wrap:anywhere] leading-snug',
                  tone.valueText,
                )}
                title={card.value}
              >
                {card.value}
              </p>
              {card.subtitle && (
                <p className="mt-1 text-xs text-slate-400">{card.subtitle}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
