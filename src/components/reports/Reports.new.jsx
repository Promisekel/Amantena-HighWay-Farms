import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Package, 
  Users, 
  DollarSign, 
  Calendar, 
  Download,
  RefreshCw,
  BarChart3,
  PieChart,
  LineChart
} from 'lucide-react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  where, 
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { format, subDays, startOfDay } from 'date-fns';
import toast from 'react-hot-toast';

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState('7days');
  
  // Data states
  const [salesData, setSalesData] = useState([]);
  const [productsData, setProductsData] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalCustomers: 0,
    avgOrderValue: 0,
    topProducts: [],
    recentSales: [],
    salesTrend: 0,
    revenueTrend: 0
  });

  // Effect to load initial data and set up listeners
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Set up real-time listeners
        const unsubscribe = setupRealTimeListeners();
        
        // Initial data fetch
        const [sales, products] = await Promise.all([
          fetchSalesData(),
          fetchProductsData()
        ]);
        
        // Calculate initial analytics
        if (sales && products) {
          calculateAnalytics(sales, products);
        }
      } catch (error) {
        console.error('Error loading reports data:', error);
        toast.error('Failed to load reports data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dateRange]);

  const fetchSalesData = async () => {
    try {
      const salesRef = collection(db, 'sales');
      let salesQuery;
      
      if (dateRange === 'all') {
        salesQuery = query(salesRef, orderBy('timestamp', 'desc'), limit(100));
      } else {
        const daysBack = parseInt(dateRange.replace('days', ''));
        const startDate = startOfDay(subDays(new Date(), daysBack));
        salesQuery = query(
          salesRef,
          where('timestamp', '>=', Timestamp.fromDate(startDate)),
          orderBy('timestamp', 'desc')
        );
      }

      const snapshot = await getDocs(salesQuery);
      const sales = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        sales.push({ 
          id: doc.id, 
          ...data,
          timestamp: data.timestamp?.toDate() || new Date()
        });
      });
      
      setSalesData(sales);
      return sales;
    } catch (error) {
      console.error('Error fetching sales data:', error);
      return [];
    }
  };

  const fetchProductsData = async () => {
    try {
      const snapshot = await getDocs(query(collection(db, 'products')));
      const products = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!data.status || data.status !== 'archived') {
          products.push({
            id: doc.id,
            ...data,
            price: parseFloat(data.price) || 0
          });
        }
      });
      
      setProductsData(products);
      return products;
    } catch (error) {
      console.error('Error fetching products data:', error);
      return [];
    }
  };

  const setupRealTimeListeners = () => {
    // Set up sales listener
    const salesUnsubscribe = onSnapshot(
      query(collection(db, 'sales'), orderBy('timestamp', 'desc'), limit(100)),
      snapshot => {
        const sales = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          sales.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date()
          });
        });
        setSalesData(sales);
        calculateAnalytics(sales, productsData);
      },
      error => {
        console.error('Sales listener error:', error);
        toast.error('Error listening to sales updates');
      }
    );

    // Set up products listener
    const productsUnsubscribe = onSnapshot(
      query(collection(db, 'products')),
      snapshot => {
        const products = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          if (!data.status || data.status !== 'archived') {
            products.push({
              id: doc.id,
              ...data,
              price: parseFloat(data.price) || 0
            });
          }
        });
        setProductsData(products);
        calculateAnalytics(salesData, products);
      },
      error => {
        console.error('Products listener error:', error);
        toast.error('Error listening to product updates');
      }
    );

    return () => {
      salesUnsubscribe();
      productsUnsubscribe();
    };
  };

  const calculateAnalytics = (sales, products) => {
    if (!Array.isArray(sales)) return;

    try {
      // Filter sales by date range
      const daysBack = dateRange === 'all' ? 30 : parseInt(dateRange.replace('days', ''));
      const rangeStart = startOfDay(subDays(new Date(), daysBack));
      const periodSales = sales.filter(sale => sale.timestamp >= rangeStart);
      const previousSales = sales.filter(
        sale => sale.timestamp >= subDays(rangeStart, daysBack) && sale.timestamp < rangeStart
      );

      // Calculate sales metrics
      const totalSales = periodSales.length;
      const totalRevenue = periodSales.reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0);
      const prevRevenue = previousSales.reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0);

      // Calculate trends
      const salesTrend = previousSales.length ? 
        ((totalSales - previousSales.length) / previousSales.length) * 100 : 0;
      const revenueTrend = prevRevenue ? 
        ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

      // Calculate unique customers
      const uniqueCustomers = new Set(periodSales.map(sale => sale.customer)).size;

      // Calculate average order value
      const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

      // Calculate top products
      const productStats = periodSales.reduce((acc, sale) => {
        const productName = sale.productName;
        if (!productName) return acc;

        if (!acc[productName]) {
          acc[productName] = {
            name: productName,
            revenue: 0,
            quantity: 0,
            transactions: 0
          };
        }

        acc[productName].revenue += parseFloat(sale.total) || 0;
        acc[productName].quantity += parseInt(sale.quantity) || 0;
        acc[productName].transactions += 1;

        return acc;
      }, {});

      const topProducts = Object.values(productStats)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Get recent sales with complete information
      const recentSales = sales
        .filter(sale => sale.timestamp && sale.productName && sale.customer)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10)
        .map(sale => ({
          id: sale.id,
          productName: sale.productName,
          customer: sale.customer,
          quantity: parseInt(sale.quantity) || 0,
          total: parseFloat(sale.total) || 0,
          timestamp: sale.timestamp
        }));

      setAnalytics({
        totalSales,
        totalRevenue,
        totalCustomers: uniqueCustomers,
        avgOrderValue,
        salesTrend,
        revenueTrend,
        topProducts,
        recentSales
      });
    } catch (error) {
      console.error('Error calculating analytics:', error);
      toast.error('Error updating analytics');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [sales, products] = await Promise.all([
        fetchSalesData(),
        fetchProductsData()
      ]);
      calculateAnalytics(sales, products);
      toast.success('Reports refreshed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Failed to refresh reports');
    } finally {
      setRefreshing(false);
    }
  };

  const exportReport = (type) => {
    try {
      let csvContent = "";
      let filename = "";

      switch (type) {
        case 'sales':
          csvContent = "Date,Product,Customer,Quantity,Price,Total\n";
          salesData.forEach(sale => {
            csvContent += `${format(sale.timestamp, 'yyyy-MM-dd')},${sale.productName || ''},${sale.customer || ''},${sale.quantity || 0},${sale.price || 0},${sale.total || 0}\n`;
          });
          filename = `sales_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
          break;

        case 'inventory':
          csvContent = "Product,Price,Value\n";
          productsData.forEach(product => {
            csvContent += `${product.name || ''},${product.price || 0},${(product.price || 0) * (product.quantity || 0)}\n`;
          });
          filename = `inventory_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
          break;

        default:
          toast.error('Invalid report type');
          return;
      }

      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
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

  const formatCurrency = (amount) => {
    return `GH₵${Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getTrendIcon = (trend) => {
    if (trend > 0) return <TrendingUp className="w-4 h-4" />;
    if (trend < 0) return <TrendingDown className="w-4 h-4" />;
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-600 mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports & Analytics</h1>
          <p className="text-gray-600">Comprehensive business insights and performance metrics</p>
        </div>
        
        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
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

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total Revenue */}
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

        {/* Total Sales */}
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

        {/* Total Customers */}
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

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Top Products */}
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
                <div key={index} className="flex items-center justify-between p-4 bg-white bg-opacity-10 backdrop-blur-lg rounded-lg hover:bg-opacity-20 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold
                      ${index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-blue-400' : index === 2 ? 'bg-green-400' : 'bg-pink-400'}`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{product.name}</p>
                      <p className="text-sm text-purple-200">{product.transactions} sales</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white">{formatCurrency(product.revenue)}</p>
                    <p className="text-sm text-purple-200">Qty: {product.quantity}</p>
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

        {/* Recent Sales */}
        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-white">Recent Sales</h3>
            <div className="p-2 bg-white bg-opacity-20 rounded-lg">
              <LineChart className="w-5 h-5 text-blue-100" />
            </div>
          </div>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {analytics.recentSales.length > 0 ? (
              analytics.recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-3 bg-white bg-opacity-10 backdrop-blur-lg rounded-lg hover:bg-opacity-20 transition-colors">
                  <div>
                    <p className="font-medium text-white">{sale.productName}</p>
                    <div className="flex items-center space-x-2">
                      <p className="text-sm text-blue-100">
                        {sale.customer}
                      </p>
                      <span className="text-xs text-blue-200">•</span>
                      <p className="text-sm text-blue-100">
                        Qty: {sale.quantity}
                      </p>
                    </div>
                    <p className="text-xs text-blue-200">
                      {format(sale.timestamp, 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">{formatCurrency(sale.total)}</p>
                    <p className="text-xs text-blue-200">
                      {formatCurrency(sale.total / sale.quantity)} per unit
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-blue-200">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No recent sales</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Report Actions */}
      <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-semibold text-white mb-6">Export Reports</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Daily Sales Report */}
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

          {/* Inventory Report */}
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
    </div>
  );
};

export default Reports;