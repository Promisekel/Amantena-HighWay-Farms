import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  FileText,
  Package,
  Users,
  DollarSign,
  RefreshCw,
  BarChart3,
  PieChart,
  LineChart,
  Download
} from 'lucide-react';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  computeAnalytics,
  normaliseProductRecord,
  normaliseSaleRecord,
  resolveDateRange,
  splitSalesByRange
} from './reportUtils';
import { getProductTypeLabel } from '../inventory/productTypes';

const MAX_SALES_RECORDS = 500;

const buildSalesQuery = (rangeInfo) => {
  const constraints = [];

  if (rangeInfo.mode === 'range') {
    if (rangeInfo.fetchStart) {
      constraints.push(where('timestamp', '>=', Timestamp.fromDate(rangeInfo.fetchStart)));
    }
    if (rangeInfo.currentEnd) {
      constraints.push(where('timestamp', '<=', Timestamp.fromDate(rangeInfo.currentEnd)));
    }
  }

  constraints.push(orderBy('timestamp', 'desc'));
  constraints.push(limit(MAX_SALES_RECORDS));

  return query(collection(db, 'sales'), ...constraints);
};

const Reports = () => {
  const [dateRange, setDateRange] = useState('7days');
  const [refreshing, setRefreshing] = useState(false);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [salesReady, setSalesReady] = useState(false);
  const [productsReady, setProductsReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const rangeInfo = useMemo(() => resolveDateRange(dateRange), [dateRange]);

  useEffect(() => {
    setLoading(!(salesReady && productsReady));
  }, [salesReady, productsReady]);

  useEffect(() => {
    setSalesReady(false);

    const unsubscribe = onSnapshot(
      buildSalesQuery(rangeInfo),
      (snapshot) => {
        const records = snapshot.docs.map((doc) => normaliseSaleRecord({ id: doc.id, ...doc.data() }));
        setSales(records);
        setSalesReady(true);
      },
      (error) => {
        console.error('Sales listener error:', error);
        toast.error('Unable to load sales data');
        setSales([]);
        setSalesReady(true);
      }
    );

    return () => unsubscribe();
  }, [rangeInfo]);

  useEffect(() => {
    setProductsReady(false);

    const unsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const items = snapshot.docs
          .map((doc) => normaliseProductRecord({ id: doc.id, ...doc.data() }))
          .filter((product) => product.raw?.status !== 'archived');
        setProducts(items);
        setProductsReady(true);
      },
      (error) => {
        console.error('Products listener error:', error);
        toast.error('Unable to load inventory data');
        setProducts([]);
        setProductsReady(true);
      }
    );

    return () => unsubscribe();
  }, []);

  const analytics = useMemo(() => computeAnalytics(sales, products, rangeInfo), [sales, products, rangeInfo]);

  useEffect(() => {
    setLoading(!(salesReady && productsReady));
  }, [salesReady, productsReady]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [salesSnapshot, productsSnapshot] = await Promise.all([
        getDocs(buildSalesQuery(rangeInfo)),
        getDocs(collection(db, 'products'))
      ]);

      const nextSales = salesSnapshot.docs.map((doc) => normaliseSaleRecord({ id: doc.id, ...doc.data() }));
      const nextProducts = productsSnapshot.docs
        .map((doc) => normaliseProductRecord({ id: doc.id, ...doc.data() }))
        .filter((product) => product.raw?.status !== 'archived');

      setSales(nextSales);
      setProducts(nextProducts);
      toast.success('Reports refreshed successfully');
    } catch (error) {
      console.error('Error refreshing reports:', error);
      toast.error('Failed to refresh reports');
    } finally {
      setRefreshing(false);
    }
  };

  const exportReport = (type) => {
    try {
      let csvContent = '';
      let filename = '';

      if (type === 'sales') {
        const { currentSales } = splitSalesByRange(sales, rangeInfo);
        csvContent = 'Date,Product,Customer,Quantity,Unit Price,Total\n';
        csvContent += currentSales
          .map((sale) => {
            const date = format(sale.timestamp, 'yyyy-MM-dd HH:mm');
            const unitPrice = Number(sale.unitPrice || 0).toFixed(2);
            return `${date},${sale.productName},${sale.customer},${sale.quantity},${unitPrice},${sale.total.toFixed(2)}`;
          })
          .join('\n');
        filename = `sales_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      } else if (type === 'inventory') {
        csvContent = 'Product,Type,Current Stock,Min Stock,Max Stock,Price,Value\n';
        csvContent += products
          .map((product) => {
            const value = product.stockQuantity * product.price;
            return `${product.name},${getProductTypeLabel(product.type)},${product.stockQuantity},${product.minStock},${product.maxStock},${product.price.toFixed(2)},${value.toFixed(2)}`;
          })
          .join('\n');
        filename = `inventory_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      } else {
        return;
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`${type} report exported successfully`);
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    }
  };

  const formatCurrency = (amount = 0) => {
    const numeric = Number(amount) || 0;
    return `GH₵${numeric.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getTrendIcon = (trend) => {
    if (trend > 0) return <TrendingUp className="w-4 h-4" />;
    if (trend < 0) return <TrendingDown className="w-4 h-4" />;
    return <div className="w-4 h-4" />;
  };

  const perUnitPrice = (sale) => {
    if (!sale.quantity) {
      return null;
    }
    return formatCurrency(sale.total / sale.quantity);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-600 mb-4" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports & Analytics</h1>
          <p className="text-gray-600">Comprehensive business insights and performance metrics</p>
        </div>

        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <select
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-100">Total Revenue</p>
              <p className="text-3xl font-bold text-white mt-2">{formatCurrency(analytics.totalRevenue)}</p>
              <div className="flex items-center space-x-2 mt-3 bg-white bg-opacity-10 rounded-lg px-3 py-1">
                {getTrendIcon(analytics.revenueTrend)}
                <span className="text-sm font-medium text-emerald-100">
                  {Math.abs(analytics.revenueTrend).toFixed(1)}% from last period
                </span>
              </div>
            </div>
            <div className="p-4 bg-white bg-opacity-20 rounded-full animate-pulse">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">Total Sales</p>
              <p className="text-3xl font-bold text-white mt-2">{analytics.totalSales}</p>
              <div className="flex items-center space-x-2 mt-3 bg-white bg-opacity-10 rounded-lg px-3 py-1">
                {getTrendIcon(analytics.salesTrend)}
                <span className="text-sm font-medium text-blue-100">
                  {Math.abs(analytics.salesTrend).toFixed(1)}% from last period
                </span>
              </div>
            </div>
            <div className="p-4 bg-white bg-opacity-20 rounded-full animate-pulse">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-100">Total Customers</p>
              <p className="text-3xl font-bold text-white mt-2">{analytics.totalCustomers}</p>
              <div className="flex items-center space-x-2 mt-3 bg-white bg-opacity-10 rounded-lg px-3 py-1">
                <Users className="w-4 h-4 text-white" />
                <span className="text-sm font-medium text-purple-100">Unique buyers</span>
              </div>
            </div>
            <div className="p-4 bg-white bg-opacity-20 rounded-full animate-pulse">
              <Users className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Top Products by Revenue</h3>
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <PieChart className="w-5 h-5 text-purple-100" />
            </div>
          </div>

          <div className="space-y-4">
            {analytics.topProducts.length > 0 ? (
              analytics.topProducts.map((product, index) => (
                <div
                  key={product.id || product.name || index}
                  className="flex items-center justify-between p-4 bg-white bg-opacity-10 backdrop-blur-lg rounded-lg hover:bg-opacity-20 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                        index === 0
                          ? 'bg-yellow-400'
                          : index === 1
                          ? 'bg-blue-400'
                          : index === 2
                          ? 'bg-green-400'
                          : 'bg-pink-400'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{product.name}</p>
                      <p className="text-xs text-purple-200">{getProductTypeLabel(product.type)}</p>
                      {typeof product.stockQuantity === 'number' && (
                        <p className="text-xs text-purple-200">Stock: {product.stockQuantity}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white">{formatCurrency(product.revenue)}</p>
                    <p className="text-xs text-purple-200">Qty sold: {product.quantity}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-purple-200">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No sales data available</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Recent Sales</h3>
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <LineChart className="w-5 h-5 text-blue-100" />
            </div>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {analytics.recentSales.length > 0 ? (
              analytics.recentSales.map((sale) => {
                const unitPrice = perUnitPrice(sale);
                return (
                  <div
                    key={sale.id || `${sale.productName}-${sale.timestamp.getTime()}`}
                    className="flex items-center justify-between p-3 bg-white bg-opacity-10 backdrop-blur-lg rounded-lg hover:bg-opacity-20 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-white">{sale.productName}</p>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm text-blue-100">{sale.customer}</p>
                        <span className="text-xs text-blue-200">•</span>
                        <p className="text-sm text-blue-100">Qty: {sale.quantity}</p>
                      </div>
                      <p className="text-xs text-blue-200">{format(sale.timestamp, 'MMM dd, yyyy HH:mm')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-white">{formatCurrency(sale.total)}</p>
                      <p className="text-xs text-blue-200">{unitPrice ? `${unitPrice} per unit` : '—'}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-blue-200">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No recent sales</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-semibold text-white mb-6">Export Reports</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => exportReport('sales')}
            className="group p-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl hover:shadow-lg transition-all duration-200 text-left transform hover:scale-[1.02]"
          >
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mb-4 transition-colors group-hover:bg-opacity-30">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <h4 className="font-semibold text-white mb-2">Sales Report</h4>
            <p className="text-blue-100 text-sm mb-4">Export detailed sales data with customer information</p>
            <div className="flex items-center space-x-2 text-white">
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">Export CSV</span>
            </div>
          </button>

          <button
            onClick={() => exportReport('inventory')}
            className="group p-6 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl hover:shadow-lg transition-all duration-200 text-left transform hover:scale-[1.02]"
          >
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center mb-4 transition-colors group-hover:bg-opacity-30">
              <Package className="h-6 w-6 text-white" />
            </div>
            <h4 className="font-semibold text-white mb-2">Inventory Report</h4>
            <p className="text-emerald-100 text-sm mb-4">Current stock levels and valuations</p>
            <div className="flex items-center space-x-2 text-white">
              <Download className="w-4 h-4" />
              <span className="text-sm font-medium">Export CSV</span>
            </div>
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg p-6">
          <h4 className="text-xl font-semibold text-white mb-6">Performance Metrics</h4>
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white bg-opacity-10 rounded-lg p-4">
              <span className="text-purple-100">Average Order Value</span>
              <span className="font-semibold text-white">{formatCurrency(analytics.avgOrderValue)}</span>
            </div>
            <div className="flex justify-between items-center bg-white bg-opacity-10 rounded-lg p-4">
              <span className="text-purple-100">Total Quantity Sold</span>
              <span className="font-semibold text-white">{analytics.salesMetrics.totalQuantitySold}</span>
            </div>
            <div className="flex justify-between items-center bg-white bg-opacity-10 rounded-lg p-4">
              <span className="text-purple-100">Inventory Value</span>
              <span className="font-semibold text-white">{formatCurrency(analytics.inventoryMetrics.totalValue)}</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-800 to-slate-900 rounded-xl shadow-lg p-6">
          <h4 className="text-xl font-semibold text-white mb-6">System Status</h4>
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-white bg-opacity-10 rounded-lg p-4">
              <span className="text-gray-300">Data Status</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-400">Live</span>
              </div>
            </div>
            <div className="flex items-center justify-between bg-white bg-opacity-10 rounded-lg p-4">
              <span className="text-gray-300">Last Updated</span>
              <span className="text-sm text-gray-400">{format(analytics.generatedAt, 'MMM dd, yyyy HH:mm')}</span>
            </div>
            <div className="flex items-center justify-between bg-white bg-opacity-10 rounded-lg p-4">
              <span className="text-gray-300">Low Stock Items</span>
              <span className="text-sm text-gray-400">{analytics.inventoryMetrics.lowStockCount}</span>
            </div>
            <div className="flex items-center justify-between bg-white bg-opacity-10 rounded-lg p-4">
              <span className="text-gray-300">Database</span>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-400">Connected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(Reports);