import React, { useState, useEffect, useMemo } from 'react';
import { Grid, List as ListIcon, Search, Package, AlertTriangle, Plus, DollarSign } from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, deleteProduct } from '../../services/firebase';
import InventoryTabs from './InventoryTabs';
import './inventory.css';
import ProductCard from './ProductCard';
import ProductCardList from './ProductCardList';
import AddProductModal from './AddProductModal';
import ViewProductModal from './ViewProductModal';
import EditProductModal from './EditProductModal';
import toast from 'react-hot-toast';
import { productTypes, getProductTypeLabel } from './productTypes';

const InventoryPage = () => {
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('live');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState('ALL');
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);

  // Fetch products from Firestore with real-time updates
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const productsData = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data() || {};

          const rawStock = data.stockQuantity ?? data.currentStock ?? data.quantity ?? 0;
          const stockQuantity = Number(rawStock) || 0;
          const price = Number(data.price) || 0;
          const minStock = Number(data.minStock) || 0;
          const maxStock = Number(data.maxStock) || 100;
          const inventoryValue = price * Math.max(stockQuantity, 0);
          const stockTrend = Number(data.stockTrend) || 0;

          return {
            id: docSnapshot.id,
            ...data,
            price,
            stockQuantity,
            currentStock: stockQuantity,
            minStock,
            maxStock,
            inventoryValue,
            stockTrend,
            lastUpdated: data.lastUpdated?.toDate() || data.createdAt?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date()
          };
        });
        
        console.log('Real-time products update:', productsData.length, 'products');
        setProducts(productsData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching products:', err);
        setError(err.message);
        setLoading(false);
        toast.error('Failed to load inventory data');
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const knownTypeValues = productTypes.map((item) => item.value);
  const liveTypeValues = Array.from(new Set(
    products.map((product) => product.type).filter(Boolean)
  ));
  const allTypeValues = Array.from(new Set([...knownTypeValues, ...liveTypeValues]));
  const typeFilterOptions = allTypeValues.map((value) => ({
    value,
    label: getProductTypeLabel(value)
  }));

  // Filter products based on search term and type
  const filteredProducts = products?.filter(product => {
    const matchesSearch = 
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'ALL' || product.type === selectedType;
    return matchesSearch && matchesType;
  }) || [];

  // Handle view/edit/delete actions
  const handleViewProduct = (product) => {
    try {
      setSelectedProductId(product?.id || null);
      setShowViewModal(true);
    } catch (err) {
      console.error('Error viewing product:', err);
      toast.error('Failed to view product');
    }
  };

  const handleEditProduct = (product) => {
    try {
      setSelectedProductId(product?.id || null);
      setShowEditModal(true);
    } catch (err) {
      console.error('Error editing product:', err);
      toast.error('Failed to edit product');
    }
  };

  const handleDeleteProduct = async (product) => {
    if (window.confirm(`Are you sure you want to delete ${product.name}? This action cannot be undone.`)) {
      try {
        await deleteProduct(product.id);
        toast.success(`${product.name} deleted successfully`);
      } catch (err) {
        console.error('Error deleting product:', err);
        toast.error('Failed to delete product');
      }
    }
  };

  const handleProductAdded = () => {
    // The real-time listener will automatically update the products list
    console.log('Product added - inventory will update automatically');
  };

  const handleProductUpdated = () => {
    console.log('Product updated - inventory will update automatically');
  };
  const selectedProduct = useMemo(() => {
    if (!selectedProductId) {
      return null;
    }

    return products.find((product) => product.id === selectedProductId) || null;
  }, [products, selectedProductId]);


  const inventorySummary = useMemo(() => {
    return (products || []).reduce((acc, product) => {
      if (!product || !product.name) {
        return acc;
      }

      const status = (product.status || '').toLowerCase();
      if (status === 'archived' || status === 'inactive') {
        return acc;
      }

      const stockQuantity = Number(product.stockQuantity ?? product.currentStock ?? 0) || 0;
      const minStock = Number(product.minStock) || 0;
  const inventoryValue = (Number(product.price) || 0) * Math.max(stockQuantity, 0);
      const unitPrice = Number(product.price) || 0;

      acc.totalProducts += 1;

      if (minStock > 0 && stockQuantity <= minStock) {
        acc.lowStockCount += 1;
      }

      acc.totalInventoryValue += inventoryValue;
      acc.totalUnitPriceSum += unitPrice;
      return acc;
    }, {
      totalProducts: 0,
      lowStockCount: 0,
      totalInventoryValue: 0,
      totalUnitPriceSum: 0
    });
  }, [products]);

  const totalProducts = inventorySummary.totalProducts;
  const lowStockProducts = inventorySummary.lowStockCount;
  const formattedInventoryValue = Number(inventorySummary.totalInventoryValue || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const formattedUnitPriceSum = Number(inventorySummary.totalUnitPriceSum || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
              <div className="flex items-center mt-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                <span className="text-sm text-gray-600">Live Updates Active</span>
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors flex items-center shadow-lg hover:shadow-xl"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add New Product
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100">
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-blue-900">Total Products</p>
                  <p className="text-2xl font-bold text-blue-600">{totalProducts}</p>
                  <p className="text-xs text-gray-500 mt-1">Active in inventory</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className={`p-3 rounded-full ${lowStockProducts > 0 ? 'bg-red-100' : 'bg-amber-100'}`}>
                  <AlertTriangle className={`h-8 w-8 ${lowStockProducts > 0 ? 'text-red-600' : 'text-amber-600'}`} />
                </div>
                <div className="ml-4">
                  <p className={`text-sm font-medium ${lowStockProducts > 0 ? 'text-red-900' : 'text-amber-900'}`}>
                    Low Stock Alerts
                  </p>
                  <p className={`text-2xl font-bold ${lowStockProducts > 0 ? 'text-red-600' : 'text-amber-600'}`}>
                    {lowStockProducts}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {lowStockProducts > 0 ? 'Needs attention' : 'All good'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-emerald-100">
                  <DollarSign className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-emerald-900">Sum of Unit Prices</p>
                  <p className="text-2xl font-bold text-emerald-600">GH₵{formattedUnitPriceSum}</p>
                  <p className="text-xs text-gray-500 mt-1">Aggregated list price total</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100">
                  <span className="text-2xl">💰</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-green-900">Total Inventory Value</p>
                  <p className="text-2xl font-bold text-green-600">GH₵{formattedInventoryValue}</p>
                  <p className="text-xs text-gray-500 mt-1">Current stock value</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search, Filter and View Toggle */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 mb-6">
            <div className="flex flex-1 gap-4 max-w-3xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search products by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                />
              </div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white shadow-sm"
              >
                <option value="ALL">All Types</option>
                {typeFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors duration-200 ${
                    viewMode === 'grid'
                      ? 'bg-white text-emerald-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Grid size={18} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors duration-200 ${
                    viewMode === 'list'
                      ? 'bg-white text-emerald-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <ListIcon size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <InventoryTabs activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        {/* Products Grid/List */}
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
              <p className="text-gray-600">Loading inventory...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Inventory</h3>
              <p className="text-red-700">{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {products?.length === 0 ? 'No products in inventory' : 'No products found'}
            </h3>
            <p className="text-gray-500 mb-6">
              {products?.length === 0 
                ? 'Add your first product to get started with inventory management' 
                : 'Try adjusting your search filters or add new products'}
            </p>
            {products?.length === 0 && (
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Add Your First Product
              </button>
            )}
          </div>
        ) : (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6'
              : 'space-y-4'
          }>
            {filteredProducts.map((product) =>
              viewMode === 'grid' ? (
                <ProductCard
                  key={product.id}
                  product={product}
                  onView={() => handleViewProduct(product)}
                  onEdit={() => handleEditProduct(product)}
                  onDelete={() => handleDeleteProduct(product)}
                />
              ) : (
                <ProductCardList
                  key={product.id}
                  product={product}
                  onView={() => handleViewProduct(product)}
                  onEdit={() => handleEditProduct(product)}
                  onDelete={() => handleDeleteProduct(product)}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onProductAdded={handleProductAdded}
      />
      <ViewProductModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedProductId(null);
        }}
        product={selectedProduct}
      />
      <EditProductModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedProductId(null);
        }}
        product={selectedProduct}
        onProductUpdated={handleProductUpdated}
      />
    </div>
  );
};

export default InventoryPage;