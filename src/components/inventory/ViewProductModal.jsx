import React from 'react';
import { X, AlertTriangle, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getProductTypeLabel, getProductTypeStyles, getProductTypePlaceholder } from './productTypes';

const ViewProductModal = ({ isOpen, onClose, product }) => {
  if (!isOpen || !product) return null;

  // Calculate stock percentage
  const stockPercentage = Math.min(
    Math.round((product.stockQuantity / product.maxStock) * 100),
    100
  );
  const isLowStock = product.stockQuantity <= product.minStock;

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
  const inventoryValue = Number(product.inventoryValue) || price * Math.max(Number(product.stockQuantity) || 0, 0);

  const handleImageError = (event) => {
    if (!event?.target) return;
    if (!event.target.dataset.fallbackApplied) {
      event.target.dataset.fallbackApplied = 'true';
      event.target.src = fallbackImage;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-scale-in">
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
                <div className="flex gap-2">
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
                    className={`h-full rounded-full transition-all duration-300
                      ${stockPercentage <= 25 ? 'bg-red-500' : 
                        stockPercentage <= 50 ? 'bg-yellow-500' : 
                        'bg-green-500'}`}
                    style={{ width: `${Math.max(stockPercentage, 5)}%` }}
                  />
                </div>
              </div>

              {/* Stock Details */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-bold text-gray-900">{product.stockQuantity}</div>
                  <div className="text-xs text-gray-500">Current</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-bold text-gray-900">{product.minStock}</div>
                  <div className="text-xs text-gray-500">Minimum</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-bold text-gray-900">{product.maxStock}</div>
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
                  <h4 className="font-semibold mb-1">
                    {isLowStock ? 'Low Stock Alert' : 'Stock Status'}
                  </h4>
                  <p className="text-sm">
                    {isLowStock 
                      ? 'Current stock is below minimum threshold. Consider restocking soon.'
                      : 'Stock levels are healthy.'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Last Updated */}
            <div className="text-sm text-gray-500">
              Last updated {formatDistanceToNow(new Date(product.lastUpdated), { addSuffix: true })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewProductModal;
