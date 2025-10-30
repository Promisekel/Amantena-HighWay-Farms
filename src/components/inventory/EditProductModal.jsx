import React, { useState, useRef, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { uploadProductImage } from '../../services/cloudinary';
import toast from 'react-hot-toast';
import {
  productTypes,
  productVariantsByType,
  getProductTypeLabel,
  getProductVariantMeta
} from './productTypes';

const EditProductModal = ({ isOpen, onClose, product, onProductUpdated }) => {
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    stockQuantity: 0, // Changed from currentStock to stockQuantity
    minStock: 0,
    maxStock: 0,
    unit: '',
    type: productTypes[0]?.value || '',
    imageUrl: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name.includes('Stock') || name === 'price' ? Number(value) : value
    }));
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price,
        stockQuantity: product.stockQuantity, // Changed from currentStock
        minStock: product.minStock,
        maxStock: product.maxStock,
        unit: product.unit,
        type: product.type,
        imageUrl: product.imageUrl
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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      // Preview image
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({ ...prev, imageUrl: e.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let imageUrl = product.imageUrl;

      // Upload new image if changed
      if (imageFile) {
        imageUrl = await uploadProductImage(imageFile);
      }

      // Update product in Firestore
      const productRef = doc(db, 'products', product.id);
      await updateDoc(productRef, {
        ...formData,
        imageUrl,
        lastUpdated: new Date(),
        stockTrend: ((formData.stockQuantity - product.stockQuantity) / product.stockQuantity) * 100,
        currentStock: formData.stockQuantity // Keep for backward compatibility
      });

      toast.success('Product updated successfully');
      onProductUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Failed to update product');
    } finally {
      setLoading(false);
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
              <div 
                onClick={handleImageClick}
                className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 transition-colors"
              >
                {formData.imageUrl ? (
                  <img 
                    src={formData.imageUrl} 
                    alt="Product" 
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <>
                    <Upload size={24} className="text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">Upload Image</span>
                  </>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
              />
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
                    unit: ''
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
                value={formData.stockQuantity}
                onChange={handleChange}
                min="0"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
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
