import React, { useState, useEffect } from 'react';
import { PlusCircle, Eye } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import SalesModal from './SalesModal';
import ViewSaleDetailsModal from './ViewSaleDetailsModal';
import { formatDistanceToNow } from 'date-fns';
import { normaliseSaleRecord } from '../reports/reportUtils';
import { getProductTypeLabel } from '../inventory/productTypes';

const SalesPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [salesData, setSalesData] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    totalSales: 0,
    totalTransactions: 0,
    averageSale: 0
  });

  useEffect(() => {
    // Subscribe to sales data
    const salesRef = collection(db, 'sales');
    const q = query(salesRef, orderBy('timestamp', 'desc'), limit(10));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sales = snapshot.docs.map((doc) => normaliseSaleRecord({ id: doc.id, ...doc.data() }));
      setSalesData(sales);
      updateSummaryStats(sales);
    });

    return () => unsubscribe();
  }, []);

  const updateSummaryStats = (sales) => {
    const totalSales = sales.reduce((sum, sale) => sum + (sale.verifiedTotal || sale.total || 0), 0);
    const totalTransactions = sales.length;
    const averageSale = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    setSummaryStats({
      totalSales,
      totalTransactions,
      averageSale
    });
  };

  const formatCurrency = (value = 0) => {
    return `GH₵${Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Sales Management</h1>
          <p className="text-gray-600">Track and manage your daily sales transactions</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 hover:bg-emerald-700 transition-colors"
        >
          <PlusCircle className="w-5 h-5" />
          Record Sale
        </button>
      </div>

      {/* Sales Summary */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Sales Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-600 mb-1">
              {formatCurrency(summaryStats.totalSales)}
            </div>
            <div className="text-gray-600">Today's Sales</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-1">
              {summaryStats.totalTransactions}
            </div>
            <div className="text-gray-600">Transactions</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600 mb-1">
              {formatCurrency(summaryStats.averageSale)}
            </div>
            <div className="text-gray-600">Average Sale</div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Recent Transactions</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {salesData.map((sale) => {
                const productLabel = sale.productName || sale.raw?.product || 'Unknown Product';
                const typeLabel = sale.raw?.productType ? getProductTypeLabel(sale.raw.productType) : null;
                const unitPrice = sale.unitPrice || sale.price || (sale.quantity ? sale.verifiedTotal / sale.quantity : 0);
                const totalAmount = sale.verifiedTotal || sale.total || unitPrice * sale.quantity;
                const saleTimestamp = sale.timestamp instanceof Date
                  ? sale.timestamp
                  : sale.timestamp?.toDate?.() ?? null;
                const relativeTime = saleTimestamp
                  ? formatDistanceToNow(saleTimestamp, { addSuffix: true })
                  : 'N/A';
                const saleForModal = {
                  id: sale.id,
                  product: productLabel,
                  productName: productLabel,
                  productId: sale.productId,
                  customer: sale.customer,
                  price: unitPrice,
                  quantity: sale.quantity,
                  salesperson: sale.raw?.salesperson || sale.salesperson || '',
                  total: totalAmount,
                  timestamp: saleTimestamp
                };

                return (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{productLabel}</div>
                      <div className="text-sm text-gray-500">
                        {formatCurrency(unitPrice)} each{typeLabel ? ` • ${typeLabel}` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.customer}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sale.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-emerald-600">
                        {formatCurrency(totalAmount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {relativeTime}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button 
                        onClick={() => {
                          setSelectedSale(saleForModal);
                          setShowDetailsModal(true);
                        }}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                      >
                        <Eye size={16} />
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {salesData.length === 0 && (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions yet</h3>
              <p className="text-gray-600">Record your first sale to see it here.</p>
            </div>
          )}
        </div>
      </div>

      {/* Sales Modal */}
      <SalesModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
      />

      {/* View/Edit Sale Details Modal */}
      <ViewSaleDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedSale(null);
        }}
        sale={selectedSale}
      />
    </div>
  );
};

export default SalesPage;
