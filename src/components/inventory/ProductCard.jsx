import React from 'react';
import { Eye, Edit3, MoreVertical, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getProductTypeLabel, getProductTypeStyles, getProductTypePlaceholder } from './productTypes';

const ProductCard = ({ product, onView, onEdit, onDelete }) => {
  // Calculate stock percentage safely - use stockQuantity as primary field
  const maxStock = product.maxStock || 100;
  const minStock = product.minStock || 10;
  const currentStock = product.stockQuantity || 0; // Use stockQuantity consistently
  
  const stockPercentage = Math.min(100, Math.max(0, Math.round((currentStock / maxStock) * 100)));
  const isLowStock = currentStock <= minStock;
  const isMediumStock = currentStock <= maxStock * 0.7;
  
  // Determine stock status color
  const getProgressColor = () => {
    if (stockPercentage <= 25) return 'from-red-500 to-red-600';
    if (stockPercentage <= 50) return 'from-yellow-500 to-orange-500';
    return 'from-green-500 to-green-600';
  };

  // Stock status styling
  const getStockStatus = () => {
    if (isLowStock) {
      return {
        text: 'Low Stock',
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
        dotColor: 'bg-red-500'
      };
    }
    if (isMediumStock) {
      return {
        text: 'Reorder Soon',
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200',
        dotColor: 'bg-yellow-500'
      };
    }
    return {
      text: 'In Stock',
      bgColor: 'bg-green-100',
      textColor: 'text-green-700',
      borderColor: 'border-green-200',
      dotColor: 'bg-green-500'
    };
  };

  const stockStatus = getStockStatus();

  const typeLabel = getProductTypeLabel(product.type);
  const { badgeClass } = getProductTypeStyles(product.type);

  const fallbackImage = getProductTypePlaceholder(product.type);
  const imageSrc = product.imageUrl || fallbackImage;
  const price = Number(product.price) || 0;
  const inventoryValue = Number(product.inventoryValue) || price * Math.max(currentStock, 0);

  const handleImageError = (event) => {
    if (!event?.target) return;
    if (!event.target.dataset.fallbackApplied) {
      event.target.dataset.fallbackApplied = 'true';
      event.target.src = fallbackImage;
    }
  };

  return (
    <div className={`rounded-xl shadow-sm border transition-all duration-200 overflow-hidden h-full flex flex-col hover:shadow-lg
      ${isLowStock 
        ? 'bg-red-50 border-red-200 ring-1 ring-red-200' 
        : 'bg-white border-gray-200 hover:border-emerald-300'}`}>
      
      {/* Product Image */}
      <div className="relative w-full h-56 overflow-hidden bg-gray-50">
        <img 
          src={imageSrc} 
          alt={product.name}
          className="w-full h-full object-cover transition-all duration-300 hover:scale-105"
          style={{ imageRendering: 'crisp-edges' }}
          onError={handleImageError}
        />
        
        {/* Overlay controls */}
        <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start">
          <div className="flex items-center space-x-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full shadow-sm">
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-gray-700">LIVE</span>
            </div>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(product);
            }}
            className="p-1.5 bg-white/90 backdrop-blur-sm rounded-full shadow-sm hover:bg-red-50 transition-colors"
          >
            <MoreVertical size={16} className="text-gray-600 hover:text-red-600" />
          </button>
        </div>

        {/* Type badge */}
        <div className="absolute bottom-3 left-3">
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${badgeClass}`}>
            {typeLabel || product.type || 'Unknown Type'}
          </span>
        </div>
      </div>

      <div className="p-4 flex-1">
        {/* Product Info */}
        <div className="mb-4">
          <h3 className="font-semibold text-gray-900 text-lg mb-1 line-clamp-1">{product.name}</h3>
          <p className="text-gray-600 text-sm line-clamp-2">{product.description || 'No description available'}</p>
        </div>

        {/* Stock Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">Stock Level</span>
            <span className="font-medium text-gray-700">{currentStock}/{maxStock}</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full bg-gradient-to-r ${getProgressColor()} 
                transition-all duration-500 ease-out`}
              style={{ width: `${Math.max(stockPercentage, 3)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1 text-gray-500">
            <span>Min: {minStock}</span>
            <span>{stockPercentage}%</span>
          </div>
        </div>

        {/* Price and Stock Info */}
        <div className="flex justify-between items-end mb-4">
          <div>
            <span className="text-2xl font-bold text-emerald-600">GH₵{price.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}</span>
            <p className="text-sm text-gray-500">{product.unit}</p>
            <p className="text-xs text-gray-500 mt-1">Total Value: GH₵{inventoryValue.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}</p>
          </div>
          <div className="text-right">
            <span className="text-xl font-bold text-gray-900">{currentStock}</span>
            <div className={`inline-flex items-center px-2 py-1 mt-1 rounded-full text-xs font-medium
              ${stockStatus.bgColor} ${stockStatus.textColor}`}>
              <div className={`w-1.5 h-1.5 rounded-full mr-1 ${stockStatus.dotColor}`}></div>
              {stockStatus.text}
            </div>
          </div>
        </div>

        {/* Stock Trend and Last Updated */}
        <div className="flex justify-between text-sm text-gray-500 mb-4">
          <div className="flex items-center space-x-1">
            {(product.stockTrend || 0) >= 0 ? (
              <TrendingUp size={14} className="text-green-500" />
            ) : (
              <TrendingDown size={14} className="text-red-500" />
            )}
            <span className={(product.stockTrend || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
              {Math.abs(product.stockTrend || 0).toFixed(1)}%
            </span>
          </div>
          <span className="text-xs">
            {product.lastUpdated ? 
              `Updated ${formatDistanceToNow(product.lastUpdated, { addSuffix: true })}` :
              'No updates yet'
            }
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onView(product);
            }}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 hover:scale-[1.02] shadow-sm"
          >
            <Eye size={16} />
            <span>View</span>
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onEdit(product);
            }}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 hover:scale-[1.02] shadow-sm"
          >
            <Edit3 size={16} />
            <span>Edit</span>
          </button>
        </div>

        {/* Low Stock Warning */}
        {isLowStock && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-center space-x-2">
            <AlertTriangle size={16} className="text-red-600" />
            <span className="text-sm font-medium text-red-600">
              Urgent: Stock below minimum level!
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductCard;