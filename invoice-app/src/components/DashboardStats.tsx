import React from 'react';
import { IndianRupee, Users, FileText, AlertCircle, Wallet } from 'lucide-react';
import type { DashboardStats as DashboardStatsType } from '../types';
import { formatCurrency } from '../utils/helpers';

interface DashboardStatsProps {
  stats: DashboardStatsType;
  userRole?: string;
  onViewPaid: () => void;
  onViewUnpaid: () => void;
  onViewPending?: () => void;
  onViewPendingByUser?: () => void;
  onViewAllCustomers?: () => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  stats,
  userRole,
  onViewPaid,
  onViewUnpaid,
  onViewPending,
  onViewPendingByUser,
  onViewAllCustomers,
}) => {
  const statCards = [
    {
      title: 'Total Pending Amount',
      value: formatCurrency(stats.totalPendingAmount),
      icon: IndianRupee,
      color: 'bg-red-500',
      onClick: onViewPendingByUser ?? onViewPending,
      clickable: !!(onViewPendingByUser ?? onViewPending),
    },
    // Admin only: show their own pending amount
    ...(userRole === 'Admin'
      ? [{
          title: 'My Pending Amount',
          value: formatCurrency(stats.adminOwnPendingAmount ?? 0),
          icon: Wallet,
          color: 'bg-indigo-500',
          onClick: onViewPending,
          clickable: !!onViewPending,
        }]
      : []),
    {
      title: 'Total Customers',
      value: stats.totalCustomers.toString(),
      icon: Users,
      color: 'bg-blue-500',
      onClick: onViewAllCustomers,
      clickable: !!onViewAllCustomers,
    },
    {
      title: 'Paid Customers',
      value: stats.paidCustomersCount.toString(),
      icon: FileText,
      color: 'bg-green-500',
      onClick: onViewPaid,
      clickable: true,
    },
    {
      title: 'Unpaid Customers',
      value: stats.unpaidCustomersCount.toString(),
      icon: AlertCircle,
      color: 'bg-orange-500',
      onClick: onViewUnpaid,
      clickable: true,
    },
  ];



  const cardCount = statCards.length;
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8 ${cardCount <= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-5'}`}>
      {statCards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            onClick={card.onClick}
            className={`bg-white rounded-lg shadow-md p-4 sm:p-6 ${card.clickable ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''
              }`}
          >
            <div className="flex items-center">
              <div className={`p-2 sm:p-3 rounded-full ${card.color} text-white mr-3 sm:mr-4`}>
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{card.title}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};