import React from 'react';
import { Eye, Edit3, Trash, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getProductTypeLabel, getProductTypeStyles, getProductTypePlaceholder } from './productTypes';

const ProductCardList = ({ product, onView, onEdit, onDelete }) => {
  const stockPercentage = Math.round((product.stockQuantity / product.maxStock) * 100);
  const isLowStock = product.stockQuantity <= product.minStock;
  const isMediumStock = product.stockQuantity <= product.maxStock * 0.7;
  const stockTrend = Number(product.stockTrend) || 0;

  // Stock status colors and text
  const getStatusColor = () => {
    if (isLowStock) return 'text-red-600';
    if (isMediumStock) return 'text-amber-600';
    return 'text-green-600';
  };

  const getProgressColor = () => {
    if (stockPercentage <= 39) return 'from-red-500 to-red-600';
    if (stockPercentage <= 69) return 'from-yellow-500 to-orange-500';
    return 'from-green-500 to-green-600';
  };

  const typeLabel = getProductTypeLabel(product.type);
  const { badgeClass } = getProductTypeStyles(product.type);

  const fallbackImage = getProductTypePlaceholder(product.type);
  const imageSrc = product.imageUrl || fallbackImage;
  const price = Number(product.price) || 0;
  const inventoryValue = Number(product.inventoryValue) || price * Math.max(product.stockQuantity || 0, 0);

  const handleImageError = (event) => {
    if (!event?.target) return;
    if (!event.target.dataset.fallbackApplied) {
      event.target.dataset.fallbackApplied = 'true';
      event.target.src = fallbackImage;
    }
  };

  return (
    <div 
      onClick={() => onView(product)}
      className={`bg-white rounded-xl shadow-sm border transition-all duration-300 transform hover:scale-[1.01] cursor-pointer
      ${isLowStock ? 'border-red-200 animate-pulse-subtle' : 'border-gray-100 hover:shadow-lg'}`}>
      <div className="p-4 flex items-center space-x-4">
        {/* Product Image/Letter */}
        <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
          <img 
            src={imageSrc} 
            alt={product.name} 
            className="w-full h-full object-cover rounded-lg"
            onError={handleImageError}
          />
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              <span className="text-xs font-medium text-gray-600">LIVE</span>
            </div>
            <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
              {typeLabel || product.type || 'Unknown Type'}
            </span>
          </div>
          
          <p className="text-gray-600 text-sm truncate mb-2">{product.description}</p>
          
          {/* Stock Progress Bar */}
          <div className="w-full max-w-xs">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">Stock Level</span>
              <span className="font-medium">{stockPercentage}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full bg-gradient-to-r ${getProgressColor()} 
                  transition-all duration-300 ease-out`}
                style={{ width: `${Math.max(stockPercentage, 5)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center space-x-4 mt-2 text-sm">
            <span className="text-gray-500">{product.unit}</span>
            <div className="flex items-center space-x-1">
              {stockTrend > 0 ? (
                <TrendingUp size={14} className="text-green-500" />
              ) : (
                <TrendingDown size={14} className="text-red-500" />
              )}
              <span className={stockTrend > 0 ? 'text-green-600' : 'text-red-600'}>
                {Math.abs(stockTrend)}%
              </span>
            </div>
            <span className="text-gray-500">
              {product.lastUpdated ? 
                `Updated ${formatDistanceToNow(new Date(product.lastUpdated), { addSuffix: true })}` :
                'No updates yet'
              }
            </span>
          </div>
        </div>

        {/* Price & Stock */}
        <div className="text-right flex-shrink-0 mr-4">
          <div className="text-xl font-bold text-green-600">GH₵{price.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}</div>
          <div className="text-sm text-gray-500">Total Value: GH₵{inventoryValue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })}</div>
          <div className="text-lg font-bold text-gray-900">{product.stockQuantity}</div>
          <div className={`text-sm font-medium ${getStatusColor()}`}>
            {isLowStock ? 'Low Stock' : isMediumStock ? 'Medium Stock' : 'In Stock'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onView(product);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-1 hover:scale-[1.02]"
          >
            <Eye size={14} />
            <span>View</span>
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onEdit(product);
            }}
            className="bg-amber-500 hover:bg-amber-600 text-white py-2 px-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-1 hover:scale-[1.02]"
          >
            <Edit3 size={14} />
            <span>Edit</span>
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Are you sure you want to delete this product?')) {
                onDelete(product);
              }
            }}
            className="bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-1 hover:scale-[1.02]"
          >
            <Trash size={14} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Low Stock Warning */}
      {isLowStock && (
        <div className="px-4 pb-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-center justify-center space-x-2">
            <AlertTriangle size={14} className="text-red-600" />
            <span className="text-xs font-medium text-red-600">Low stock alert</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductCardList;
