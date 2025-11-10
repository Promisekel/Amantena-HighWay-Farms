import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, TrendingUp, History, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getProductTypeLabel, getProductTypeStyles, getProductTypePlaceholder } from './productTypes';

const ViewProductModal = ({ isOpen, onClose, product }) => {
  const [stockHistory, setStockHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  useEffect(() => {
    if (!isOpen || !product?.id) {
      setStockHistory([]);
      setHistoryError(null);
      setHistoryLoading(false);
      return;
    }

    setHistoryLoading(true);

    const historyRef = collection(db, 'products', product.id, 'stockHistory');
    const historyQuery = query(historyRef, orderBy('timestamp', 'desc'), limit(25));

    const unsubscribe = onSnapshot(
      historyQuery,
      (snapshot) => {
        const entries = snapshot.docs.map((docSnapshot) => {
          const data = docSnapshot.data() || {};
          const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : data.timestamp || null;

          return {
            id: docSnapshot.id,
            ...data,
            timestamp,
            previousQty: Number(data.previousQty ?? 0),
            newQty: Number(data.newQty ?? 0),
            delta: Number(data.delta ?? 0)
          };
        });

        setStockHistory(entries);
        setHistoryError(null);
        setHistoryLoading(false);
      },
      (error) => {
        console.error('Error loading stock history:', error);
        setStockHistory([]);
        setHistoryError('Unable to load stock history right now.');
        setHistoryLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen, product?.id]);

  if (!isOpen || !product) return null;

  const stockQuantity = Number(product.stockQuantity ?? product.currentStock ?? 0) || 0;
  const minStock = Number(product.minStock ?? 0) || 0;
  const maxStock = Number(product.maxStock ?? 0) || 0;
  const stockPercentage = maxStock > 0
    ? Math.min(Math.round((stockQuantity / maxStock) * 100), 100)
    : 0;
  const isLowStock = maxStock > 0 ? stockQuantity <= minStock : stockQuantity <= minStock && stockQuantity > 0;

  const getStockColor = () => {
    if (stockPercentage <= 25) return 'text-red-600 bg-red-50 border-red-200';
    if (stockPercentage <= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const typeLabel = getProductTypeLabel(product.type);
  const { badgeClass } = getProductTypeStyles(product.type);

  const fallbackImage = getProductTypePlaceholder(product.type);
  const imageSrc = product.imageUrl || fallbackImage;
  const price = Number(product.price) || 0;
  const inventoryValue = Number(product.inventoryValue) || price * Math.max(stockQuantity, 0);

  const handleImageError = (event) => {
    if (!event?.target) return;
    if (!event.target.dataset.fallbackApplied) {
      event.target.dataset.fallbackApplied = 'true';
      event.target.src = fallbackImage;
    }
  };

  const lastUpdated = (() => {
    if (!product.lastUpdated) return null;
    if (product.lastUpdated instanceof Date) return product.lastUpdated;
    const parsed = new Date(product.lastUpdated);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  })();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-emerald-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Product Details</h2>
              <p className="text-emerald-100 mt-1">View detailed information about this product</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-emerald-700 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column - Image and Basic Info */}
            <div className="space-y-6">
              {/* Product Image */}
              <div className="aspect-square bg-gray-50 rounded-xl overflow-hidden shadow-inner">
                <img
                  src={imageSrc}
                  alt={product.name}
                  className="w-full h-full object-contain"
                  onError={handleImageError}
                />
              </div>

              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${badgeClass}`}>
                      {typeLabel || product.type || 'Unknown Type'}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStockColor()}`}>
                      {isLowStock ? 'Low Stock' : 'In Stock'}
                    </span>
                  </div>
                </div>
                <p className="text-gray-600">{product.description || 'No description available.'}</p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-3xl font-bold text-emerald-600 mb-1">
                    GH₵{price.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </div>
                  <div className="text-gray-500 text-sm">{product.unit}</div>
                  <div className="text-gray-500 text-sm mt-1">
                    Total value: GH₵{inventoryValue.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Stock Info */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg border p-4 space-y-4">
                <h4 className="font-semibold text-gray-900">Stock Information</h4>

                {/* Stock Level */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Current Stock</span>
                    <span className="font-semibold">{stockPercentage}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        stockPercentage <= 25
                          ? 'bg-red-500'
                          : stockPercentage <= 50
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.max(stockPercentage, 5)}%` }}
                    />
                  </div>
                </div>

                {/* Stock Details */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{stockQuantity}</div>
                    <div className="text-xs text-gray-500">Current</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{minStock}</div>
                    <div className="text-xs text-gray-500">Minimum</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold text-gray-900">{maxStock}</div>
                    <div className="text-xs text-gray-500">Maximum</div>
                  </div>
                </div>
              </div>

              {/* Stock Status */}
              <div className={`p-4 rounded-lg border ${getStockColor()}`}>
                <div className="flex items-start space-x-3">
                  {isLowStock ? (
                    <AlertTriangle className="flex-shrink-0 mt-0.5" />
                  ) : (
                    <TrendingUp className="flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="font-semibold mb-1">{isLowStock ? 'Low Stock Alert' : 'Stock Status'}</h4>
                    <p className="text-sm">
                      {isLowStock
                        ? 'Current stock is below minimum threshold. Consider restocking soon.'
                        : 'Stock levels are healthy.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stock History */}
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-600" />
                    Stock History
                  </h4>
                  {historyLoading && <span className="text-xs text-gray-400">Loading...</span>}
                </div>

                {historyError ? (
                  <p className="text-sm text-red-600 mt-3">{historyError}</p>
                ) : stockHistory.length === 0 && !historyLoading ? (
                  <p className="text-sm text-gray-500 mt-3">No stock movements recorded yet.</p>
                ) : (
                  <div className="mt-4 space-y-3 max-h-60 overflow-y-auto pr-1">
                    {stockHistory.map((entry) => {
                      const delta = Number(entry.delta || 0);
                      const formattedDelta = `${delta > 0 ? '+' : ''}${delta}`;
                      const isIncrease = delta >= 0;
                      const timestampLabel = entry.timestamp
                        ? formatDistanceToNow(entry.timestamp, { addSuffix: true })
                        : 'Awaiting time update';

                      return (
                        <div
                          key={entry.id}
                          className="border border-gray-100 rounded-lg p-3 bg-gray-50"
                        >
                          <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                            <span>{`${entry.previousQty} -> ${entry.newQty}`}</span>
                            <span className={isIncrease ? 'text-emerald-600' : 'text-red-600'}>
                              {formattedDelta}
                            </span>
                          </div>
                          {entry.reason && (
                            <div className="text-xs text-gray-600 mt-1">Reason: {entry.reason}</div>
                          )}
                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{timestampLabel}</span>
                            {entry.userEmail && <span>- {entry.userEmail}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Last Updated */}
              <div className="text-sm text-gray-500">
                {lastUpdated
                  ? `Last updated ${formatDistanceToNow(lastUpdated, { addSuffix: true })}`
                  : 'Last updated information unavailable'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewProductModal;
