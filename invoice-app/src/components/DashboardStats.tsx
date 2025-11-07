import React from 'react';
import { IndianRupee, Users, FileText, AlertCircle } from 'lucide-react';
import type { DashboardStats as DashboardStatsType } from '../types';
import { formatCurrency } from '../utils/helpers';

interface DashboardStatsProps {
  stats: DashboardStatsType;
  onViewPaid: () => void;
  onViewUnpaid: () => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  stats,
  onViewPaid,
  onViewUnpaid,
}) => {
  const statCards = [
    {
      title: 'Total Pending Amount',
      value: formatCurrency(stats.totalPendingAmount),
      icon: IndianRupee,
      color: 'bg-red-500',
    },
    {
      title: 'Total Customers',
      value: stats.totalCustomers.toString(),
      icon: Users,
      color: 'bg-blue-500',
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

  

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statCards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={index}
            onClick={card.onClick}
            className={`bg-white rounded-lg shadow-md p-6 ${
              card.clickable ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''
            }`}
          >
            <div className="flex items-center">
              <div className={`p-3 rounded-full ${card.color} text-white mr-4`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};