import React, { useState, useEffect } from 'react';
import { DashboardStats } from '../components/DashboardStats';
import { api } from '../services/agent';
import type { DashboardStats as DashboardStatsType, Customer, Invoice } from '../types';
import { useNavigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStatsType>({
    totalPendingAmount: 0,
    totalCustomers: 0,
    paidCustomersCount: 0,
    unpaidCustomersCount: 0,
    recentInvoices: [],
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      console.log('📊 Loading dashboard stats...');
      
      const [customersResponse, invoicesResponse] = await Promise.all([
        api.customers.getList(),
        api.invoices.getList(),
      ]);

      const customers = customersResponse.data;
      const invoices = invoicesResponse.data;

      console.log('📦 Customers:', customers);
      console.log('🧾 Invoices:', invoices);

      // Calculate total pending amount from ALL invoices' balanceAmount
      const totalPendingAmount = invoices.reduce((sum, invoice) => sum + invoice.balanceAmount, 0);
      
      // Calculate customer counts based on their invoice balances
      const customerBalanceMap = new Map<number, number>();
      
      // Sum up balance amounts for each customer
      invoices.forEach(invoice => {
        const currentBalance = customerBalanceMap.get(invoice.customerId) || 0;
        customerBalanceMap.set(invoice.customerId, currentBalance + invoice.balanceAmount);
      });

      console.log('💰 Customer Balance Map:', Array.from(customerBalanceMap.entries()));

      // Count paid and unpaid customers
      let paidCustomersCount = 0;
      let unpaidCustomersCount = 0;

      customers.forEach(customer => {
        const customerTotalBalance = customerBalanceMap.get(customer.id) || 0;
        if (customerTotalBalance > 0) {
          unpaidCustomersCount++;
        } else {
          paidCustomersCount++;
        }
      });

      console.log('📈 Calculated Stats:', {
        totalPendingAmount,
        totalCustomers: customers.length,
        paidCustomersCount,
        unpaidCustomersCount,
      });

      setStats({
        totalPendingAmount,
        totalCustomers: customers.length,
        paidCustomersCount,
        unpaidCustomersCount,
        recentInvoices: invoices.slice(0, 5), // Show 5 most recent invoices
      });
    } catch (error) {
      console.error('❌ Failed to load dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPaid = () => {
    navigate('/customers/paid');
  };

  const handleViewUnpaid = () => {
    navigate('/customers/unpaid');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>
        
        <DashboardStats
          stats={stats}
          onViewPaid={handleViewPaid}
          onViewUnpaid={handleViewUnpaid}
        />
        
        {/* Recent Invoices Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-8">
          <h2 className="text-xl font-bold mb-4">Recent Invoices</h2>
          {stats.recentInvoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.recentInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.customerName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(invoice.invoiceDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{invoice.grandTotal.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{invoice.balanceAmount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          invoice.status === 'Paid' 
                            ? 'bg-green-100 text-green-800'
                            : invoice.status === 'Partially Paid'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No invoices found</p>
          )}
        </div>
      </div>
    </div>
  );
};