import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  ShoppingCart, 
  DollarSign,
  Users,
  Calendar,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Activity,
  Target,
  Zap
} from 'lucide-react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { format, isToday, subDays, startOfDay } from 'date-fns';
import { normaliseSaleRecord, normaliseProductRecord } from '../reports/reportUtils';
import { getProductTypeLabel } from '../inventory/productTypes';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [salesData, setSalesData] = useState([]);
  const [productsData, setProductsData] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    todaySales: 0,
    totalRevenue: 0,
    uniqueCustomers: 0,
    averageOrderValue: 0,
    salesTrend: 0,
    revenueTrend: 0,
    recentSales: [],
    topProducts: []
  });

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Set up real-time data listeners
  useEffect(() => {
    const setupListeners = () => {
      // Products listener
      const productsQuery = query(collection(db, 'products'));
      const productsUnsubscribe = onSnapshot(productsQuery, (snapshot) => {
        const products = snapshot.docs
          .map((docSnapshot) => normaliseProductRecord({ id: docSnapshot.id, ...docSnapshot.data() }))
          .filter((product) => product.status !== 'archived');
        setProductsData(products);
        calculateStats(salesData, products);
      });

      // Sales listener - last 30 days for trend analysis
      const thirtyDaysAgo = startOfDay(subDays(new Date(), 30));
      const salesQuery = query(
        collection(db, 'sales'),
        where('timestamp', '>=', Timestamp.fromDate(thirtyDaysAgo)),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      
      const salesUnsubscribe = onSnapshot(salesQuery, (snapshot) => {
        const sales = snapshot.docs.map((docSnapshot) => normaliseSaleRecord({ id: docSnapshot.id, ...docSnapshot.data() }));
        setSalesData(sales);
        calculateStats(sales, productsData);
        setLoading(false);
      });

      return () => {
        productsUnsubscribe();
        salesUnsubscribe();
      };
    };

    return setupListeners();
  }, []);

  const calculateStats = (sales, products) => {
    const productIndex = new Map(products.map((product) => [product.id, product]));

    const todaySales = sales.filter((sale) => isToday(sale.timestamp));
    const yesterdaySales = sales.filter((sale) => {
      const yesterday = subDays(new Date(), 1);
      return format(sale.timestamp, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd');
    });

    const todayRevenue = todaySales.reduce((sum, sale) => sum + (sale.verifiedTotal || sale.total || 0), 0);
    const yesterdayRevenue = yesterdaySales.reduce((sum, sale) => sum + (sale.verifiedTotal || sale.total || 0), 0);

    const salesTrend = yesterdaySales.length > 0
      ? ((todaySales.length - yesterdaySales.length) / yesterdaySales.length) * 100
      : todaySales.length > 0 ? 100 : 0;

    const revenueTrend = yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
      : todayRevenue > 0 ? 100 : 0;

    const customerNames = sales
      .map((sale) => sale.customer)
      .filter((customer) => customer && customer !== 'Unknown');
    const uniqueCustomers = new Set(customerNames).size;

    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.verifiedTotal || sale.total || 0), 0);
    const averageOrderValue = sales.length > 0 ? totalRevenue / sales.length : 0;

    const productAggregation = new Map();
    sales.forEach((sale) => {
      const productId = sale.productId;
      const name = sale.productName || sale.raw?.product || 'Unknown Product';
      const relatedProduct = productId ? productIndex.get(productId) : undefined;
      const key = productId || name;

      if (!productAggregation.has(key)) {
        productAggregation.set(key, {
          name,
          revenue: 0,
          quantity: 0,
          productId: productId || relatedProduct?.id || null,
          type: relatedProduct?.type || sale.raw?.productType || null
        });
      }

      const entry = productAggregation.get(key);
      entry.revenue += sale.verifiedTotal || sale.total || 0;
      entry.quantity += sale.quantity || 0;
    });

    const topProducts = Array.from(productAggregation.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)
      .map((entry) => ({
        name: entry.name,
        revenue: entry.revenue,
        quantity: entry.quantity,
        typeLabel: entry.type ? getProductTypeLabel(entry.type) : null
      }));

    const recentSales = sales
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)
      .map((sale) => ({
        id: sale.id,
        productName: sale.productName || sale.raw?.product || 'Unknown Product',
        customer: sale.customer,
        quantity: sale.quantity,
        total: sale.verifiedTotal || sale.total || 0,
        timestamp: sale.timestamp,
        unitPrice: sale.unitPrice || sale.price || 0
      }));

    setDashboardStats({
      todaySales: todaySales.length,
      totalRevenue: todayRevenue,
      uniqueCustomers,
      averageOrderValue,
      salesTrend,
      revenueTrend,
      recentSales,
      topProducts
    });
  };

  const formatCurrency = (amount) => {
    return `GH₵${Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const StatsCard = ({ title, value, icon: Icon, gradient, trend, onClick, description }) => {
    const isPositive = trend >= 0;
    
    return (
      <div 
        onClick={onClick}
        className={`group relative bg-white rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-xl hover:border-emerald-300 transition-all duration-300 transform hover:-translate-y-1 ${onClick ? 'cursor-pointer' : ''}`}
      >
        {/* Background gradient overlay on hover */}
        <div className={`absolute inset-0 ${gradient} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300`} />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-14 h-14 rounded-2xl ${gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
              <Icon className="h-7 w-7 text-white" />
            </div>
            {trend !== undefined && (
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
                isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                <span className="text-sm font-semibold">{Math.abs(trend).toFixed(1)}%</span>
              </div>
            )}
          </div>
          
          <h3 className="text-3xl font-bold text-gray-900 mb-2 group-hover:text-emerald-700 transition-colors">
            {value}
          </h3>
          <p className="text-gray-600 font-medium text-sm">{title}</p>
          {description && (
            <p className="text-gray-500 text-xs mt-1">{description}</p>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-emerald-200 rounded-full animate-spin border-t-emerald-600 mx-auto mb-4"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-blue-200 rounded-full animate-ping mx-auto opacity-20"></div>
          </div>
          <p className="text-gray-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-emerald-50 p-6">
      {/* Welcome Header */}
      <div className="mb-8 text-center md:text-left">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent mb-2">
              Welcome Back! 👋
            </h1>
            <p className="text-gray-600 text-lg">Here's what's happening with Amantena Highway Farms today</p>
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <Calendar size={16} />
                <span>{format(currentTime, 'EEEE, MMMM dd, yyyy')}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock size={16} />
                <span>{format(currentTime, 'HH:mm')}</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Live Data</span>
              </div>
            </div>
          </div>
          
          <div className="mt-4 md:mt-0">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center space-x-2 px-6 py-3 bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-200 hover:border-emerald-300 transition-all duration-200 text-gray-700 hover:text-emerald-600"
            >
              <RefreshCw size={18} />
              <span>Refresh Data</span>
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Today's Revenue */}
        <StatsCard
          title="Today's Revenue"
          value={formatCurrency(dashboardStats.totalRevenue)}
          icon={DollarSign}
          gradient="bg-gradient-to-r from-emerald-500 to-emerald-600"
          trend={dashboardStats.revenueTrend}
          description="Total sales value today"
        />

        {/* Today's Sales */}
        <StatsCard
          title="Today's Sales"
          value={dashboardStats.todaySales}
          icon={ShoppingCart}
          gradient="bg-gradient-to-r from-blue-500 to-blue-600"
          trend={dashboardStats.salesTrend}
          description="Total transactions today"
        />
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Unique Customers */}
        <StatsCard
          title="Unique Customers"
          value={dashboardStats.uniqueCustomers}
          icon={Users}
          gradient="bg-gradient-to-r from-orange-500 to-orange-600"
          description="Total unique buyers"
        />

        {/* Average Order Value */}
        <StatsCard
          title="Average Order Value"
          value={formatCurrency(dashboardStats.averageOrderValue)}
          icon={Target}
          gradient="bg-gradient-to-r from-pink-500 to-pink-600"
          description="Average transaction amount"
        />
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Recent Sales</h3>
            <Zap className="w-5 h-5 text-emerald-500" />
          </div>
          
          <div className="space-y-4">
            {dashboardStats.recentSales.length > 0 ? (
              dashboardStats.recentSales.map((sale, index) => (
                <div
                  key={sale.id || index}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <ShoppingCart className="w-5 h-5 text-emerald-600" />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{sale.productName}</p>
                      <p className="text-sm text-gray-500">
                        {sale.customer} • Qty: {sale.quantity}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(sale.total)}</p>
                    <p className="text-xs text-gray-500">
                      {sale.timestamp ? format(sale.timestamp, 'MMM dd, HH:mm') : '—'}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No recent sales</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Top Products</h3>
            <Target className="w-5 h-5 text-emerald-500" />
          </div>
          
          <div className="space-y-4">
            {dashboardStats.topProducts.length > 0 ? (
              dashboardStats.topProducts.map((product, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center
                        ${index === 0 ? 'bg-yellow-100' : index === 1 ? 'bg-gray-100' : 'bg-orange-100'}`}>
                        <span className={`text-lg font-bold
                          ${index === 0 ? 'text-yellow-600' : index === 1 ? 'text-gray-600' : 'text-orange-600'}`}>
                          {index + 1}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{product.name}</p>
                      <p className="text-sm text-gray-500">
                        {product.typeLabel ? `${product.typeLabel} • ` : ''}Qty sold: {product.quantity}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(product.revenue)}</p>
                    <p className="text-xs text-gray-500">Total revenue</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No product data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;