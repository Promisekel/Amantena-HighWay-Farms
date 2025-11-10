import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { updateProduct, auth } from '../../services/firebase';
import toast from 'react-hot-toast';
import {
  productTypes,
  productVariantsByType,
  getProductTypeLabel,
  getProductVariantMeta,
  getProductTypePlaceholder
} from './productTypes';

const EditProductModal = ({ isOpen, onClose, product, onProductUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
  stockQuantity: 0, // Displayed current stock level
    minStock: 0,
    maxStock: 0,
    unit: '',
    type: productTypes[0]?.value || '',
    imageUrl: '',
    newStock: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'newStock') {
      setFormData((prev) => ({
        ...prev,
        newStock: value
      }));
      return;
    }

    const numericFields = new Set(['price', 'stockQuantity', 'minStock', 'maxStock']);

    setFormData((prev) => ({
      ...prev,
      [name]: numericFields.has(name) ? Number(value) : value
    }));
  };

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price,
  stockQuantity: Number(product.stockQuantity ?? product.currentStock ?? 0) || 0,
        minStock: product.minStock,
        maxStock: product.maxStock,
        unit: product.unit,
        type: product.type,
        imageUrl: product.imageUrl || getProductTypePlaceholder(product.type),
        newStock: ''
      });
    }
  }, [product]);

  const currentVariants = productVariantsByType[formData.type] || [];
  const ensuredVariants = (() => {
    if (!formData.name) {
      return currentVariants;
    }
    const exists = currentVariants.some((variant) => variant.value === formData.name);
    if (exists) {
      return currentVariants;
    }
    return [
      { value: formData.name, label: formData.name },
      ...currentVariants
    ];
  })();

  const baseStock = Number(product?.stockQuantity ?? product?.currentStock ?? 0) || 0;
  const additionalStock = useMemo(() => {
    if (formData.newStock === '') {
      return null;
    }
    const parsed = Number(formData.newStock);
    return Number.isNaN(parsed) ? null : parsed;
  }, [formData.newStock]);

  const projectedStock = useMemo(() => {
    if (additionalStock === null) {
      return baseStock;
    }
    return Math.max(0, baseStock + additionalStock);
  }, [additionalStock, baseStock]);

  const wouldGoNegative = additionalStock !== null && baseStock + additionalStock < 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    console.log('[EditProductModal] Submit start', {
      productId: product?.id,
      formData,
      additionalStock,
      baseStock,
      projectedStock
    });

    try {
      const hasCustomImage = formData.imageUrl && /^https?:\/\//i.test(formData.imageUrl);
      const imageUrl = hasCustomImage ? formData.imageUrl : null;
      const previousStock = baseStock;
      if (additionalStock !== null) {
        const projectedRaw = baseStock + additionalStock;
        if (!Number.isFinite(projectedRaw)) {
          throw new Error('Invalid stock adjustment value');
        }
        if (projectedRaw < 0) {
          toast.error('Stock cannot be reduced below zero. Adjust the amount or restock first.');
          console.warn('[EditProductModal] Prevented negative stock adjustment', {
            baseStock,
            additionalStock
          });
          return;
        }
      }
      const updatedStock = additionalStock === null ? previousStock : projectedStock;
      const stockAdjusted = updatedStock !== previousStock;
      const stockTrendDelta = previousStock === 0
        ? (updatedStock > 0 ? 100 : 0)
        : ((updatedStock - previousStock) / (previousStock || 1)) * 100;

      // Update product in Firestore via service so stock history is recorded
      const { newStock, ...formValues } = formData;
      const categoryValue = formValues.type || product?.category || product?.type || 'uncategorized';

      const updatePayload = {
        ...formValues,
        category: categoryValue,
  stockQuantity: updatedStock,
  currentStock: updatedStock,
        imageUrl,
        lastUpdated: new Date(),
        stockTrend: stockTrendDelta,
        updatedBy: auth.currentUser?.uid,
        updatedByEmail: auth.currentUser?.email,
        stockReason: stockAdjusted
          ? additionalStock > 0
            ? `Restocked by ${additionalStock}`
            : `Reduced by ${Math.abs(additionalStock)}`
          : 'Manual update via edit form'
      };

      console.log('[EditProductModal] Submitting update payload', updatePayload);

      await updateProduct(product.id, updatePayload);

      toast.success('Product updated successfully');
      console.log('[EditProductModal] Update complete');
      onProductUpdated?.();
      onClose();
    } catch (error) {
      console.error('[EditProductModal] Error updating product:', error);
      const errorMessage = error?.message ? `Failed to update product: ${error.message}` : 'Failed to update product';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      console.log('[EditProductModal] Submit finished');
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center animate-fade-in modal-backdrop">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Edit Product</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image Upload */}
            <div className="md:col-span-2">
              <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center overflow-hidden bg-white">
                <img 
                  src={formData.imageUrl || getProductTypePlaceholder(formData.type)} 
                  alt="Product"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Images auto-select from the product type library. Uploads are disabled.
              </p>
            </div>

            {/* Product Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={(event) => {
                  const nextType = event.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    type: nextType,
                    name: '',
                    unit: '',
                    imageUrl: getProductTypePlaceholder(nextType)
                  }));
                }}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-gray-100"
              >
                {productTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                {!productTypes.some((option) => option.value === formData.type) && formData.type && (
                  <option value={formData.type}>{getProductTypeLabel(formData.type)}</option>
                )}
              </select>
            </div>

            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name
              </label>
              <select
                name="name"
                value={formData.name}
                onChange={(event) => {
                  const selectedValue = event.target.value;
                  const variantMeta = getProductVariantMeta(formData.type, selectedValue);
                  setFormData((prev) => ({
                    ...prev,
                    name: selectedValue,
                    unit: variantMeta?.size || prev.unit
                  }));
                }}
                required
                disabled={!formData.type}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                <option value="">Select {getProductTypeLabel(formData.type) || 'product'}</option>
                {ensuredVariants.map((variant) => (
                  <option key={variant.value} value={variant.value}>
                    {variant.label}
                    {variant.size ? ` (${variant.size})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price (GH₵)
              </label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                min="0"
                step="0.01"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit
              </label>
              <input
                type="text"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                required
                placeholder="e.g., kg, bag, piece"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Current Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Stock
              </label>
              <input
                type="number"
                name="stockQuantity"
                value={baseStock}
                min="0"
                required
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-gray-100"
              />
              <p className="mt-1 text-xs text-gray-500">Represents the quantity currently available in inventory.</p>
            </div>

            {/* Min Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Stock
              </label>
              <input
                type="number"
                name="minStock"
                value={formData.minStock}
                onChange={handleChange}
                min="0"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* Max Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Stock
              </label>
              <input
                type="number"
                name="maxStock"
                value={formData.maxStock}
                onChange={handleChange}
                min="0"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            {/* New Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Stock
              </label>
              <input
                type="number"
                name="newStock"
                value={formData.newStock}
                onChange={handleChange}
                step="any"
                placeholder="Enter units to add or remove"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Leave blank to keep current stock. Positive values add stock, negative values reduce it.
              </p>
            </div>

            {/* Projected Stock */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Projected Stock After Update
              </label>
              <input
                type="number"
                value={projectedStock}
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
              />
              {wouldGoNegative && (
                <p className="mt-1 text-xs text-red-600">
                  This adjustment would make stock negative. Reduce the deduction or add stock first.
                </p>
              )}
              {!wouldGoNegative && additionalStock !== null && Number.isFinite(additionalStock) && (
                <p className="mt-1 text-xs text-gray-500">
                  {additionalStock > 0
                    ? `Adding ${additionalStock} unit(s)`
                    : additionalStock < 0
                    ? `Reducing by ${Math.abs(additionalStock)} unit(s)`
                    : 'No change to stock.'}
                </p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="mr-4 px-6 py-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2 bg-emerald-600 text-white rounded-lg 
                ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-700'} 
                transition-colors flex items-center`}
            >
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                'Update Product'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProductModal;
