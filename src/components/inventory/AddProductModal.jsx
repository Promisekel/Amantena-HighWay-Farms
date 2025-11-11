import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import toast from 'react-hot-toast';
import {
  productTypes,
  productVariantsByType,
  productCatalog,
  getProductTypePlaceholder,
  getProductVariantMeta
} from './productTypes';

const normaliseValue = (value = '') => value.trim().toLowerCase();

const AddProductModal = ({ isOpen, onClose, onProductAdded }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: '',
    price: '',
    unit: '',
    currentStock: '',
    minStock: '',
    maxStock: ''
  });

  const [typeInputFocused, setTypeInputFocused] = useState(false);
  const [nameInputFocused, setNameInputFocused] = useState(false);

  const typeBlurTimeout = useRef(null);
  const nameBlurTimeout = useRef(null);

  useEffect(() => {
    return () => {
      if (typeBlurTimeout.current) {
        clearTimeout(typeBlurTimeout.current);
      }
      if (nameBlurTimeout.current) {
        clearTimeout(nameBlurTimeout.current);
      }
    };
  }, []);

  const productTypeOptions = useMemo(() => productTypes || [], []);

  const matchedType = useMemo(() => {
    if (!formData.type) {
      return null;
    }
    const normalisedInput = normaliseValue(formData.type);
    return (
      productTypeOptions.find((option) => {
        const normalisedValue = normaliseValue(option.value);
        const normalisedLabel = normaliseValue(option.label);
        return normalisedValue === normalisedInput || normalisedLabel === normalisedInput;
      }) || null
    );
  }, [formData.type, productTypeOptions]);

  const variantOptions = useMemo(() => {
    if (!matchedType) {
      return [];
    }
    const variants = productVariantsByType[matchedType.value] || [];
    return variants.map((variant) => ({
      ...variant,
      parentType: matchedType.value,
      parentLabel: matchedType.label
    }));
  }, [matchedType]);

  const allVariantSuggestions = useMemo(() => {
    const seen = new Map();
    productCatalog.forEach((catalogItem) => {
      const variants = productVariantsByType[catalogItem.value] || [];
      variants.forEach((variant) => {
        if (!seen.has(variant.value)) {
          seen.set(variant.value, {
            ...variant,
            parentType: catalogItem.value,
            parentLabel: catalogItem.label
          });
        }
      });
    });
    return Array.from(seen.values());
  }, []);

  const productNameSuggestionSource = useMemo(() => {
    return variantOptions.length > 0 ? variantOptions : allVariantSuggestions;
  }, [variantOptions, allVariantSuggestions]);

  const typeSuggestions = useMemo(() => {
    if (!formData.type) {
      return productTypeOptions.slice(0, 6);
    }

    const normalisedInput = normaliseValue(formData.type);
    return productTypeOptions
      .filter((option) => {
        const valueMatch = normaliseValue(option.value).includes(normalisedInput);
        const labelMatch = normaliseValue(option.label).includes(normalisedInput);
        return valueMatch || labelMatch;
      })
      .slice(0, 6);
  }, [formData.type, productTypeOptions]);

  const productNameSuggestions = useMemo(() => {
    if (!formData.type) {
      return [];
    }

    if (!formData.name) {
      return productNameSuggestionSource.slice(0, 8);
    }

    const normalisedInput = normaliseValue(formData.name);
    return productNameSuggestionSource
      .filter((variant) => {
        const valueMatch = normaliseValue(variant.value).includes(normalisedInput);
        const labelMatch = normaliseValue(variant.label || '').includes(normalisedInput);
        return valueMatch || labelMatch;
      })
      .slice(0, 8);
  }, [formData.type, formData.name, productNameSuggestionSource]);

  const selectedTypeLabel = matchedType ? matchedType.label : (formData.type || '');
  const previewPlaceholderSrc = getProductTypePlaceholder(matchedType?.value);
  const previewLabel = selectedTypeLabel ? selectedTypeLabel.toLowerCase() : 'product';
  const productNamePlaceholder = !formData.type
    ? 'Enter product type first'
    : matchedType
      ? `Search or add ${selectedTypeLabel} products`
      : 'Enter product name';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate form
      if (!formData.type || !formData.name || !formData.price || !formData.currentStock) {
        toast.error('Please fill in all required fields');
        return;
      }

      // Convert numeric strings to numbers with proper validation
      const price = parseFloat(formData.price);
      const currentStock = parseInt(formData.currentStock);
      const minStock = parseInt(formData.minStock) || 0;
      const maxStock = parseInt(formData.maxStock) || 1000;

      // Validation
      if (isNaN(price) || price <= 0) {
        toast.error('Please enter a valid price');
        return;
      }
      if (isNaN(currentStock) || currentStock < 0) {
        toast.error('Please enter a valid current stock');
        return;
      }
      if (minStock < 0) {
        toast.error('Minimum stock cannot be negative');
        return;
      }
      if (maxStock <= minStock) {
        toast.error('Maximum stock must be greater than minimum stock');
        return;
      }
      if (currentStock > maxStock) {
        toast.error('Current stock cannot exceed maximum stock');
        return;
      }

      const canonicalType = matchedType ? matchedType.value : formData.type.trim();
      const productName = formData.name.trim();

      if (!canonicalType) {
        toast.error('Please enter a valid product type');
        return;
      }

      if (!productName) {
        toast.error('Please enter a valid product name');
        return;
      }

      const canonicalCategory = canonicalType;

      // Prepare product data
      const productData = {
        name: productName,
        description: formData.description.trim(),
        type: canonicalType,
        category: canonicalCategory,
        typeLabel: matchedType ? matchedType.label : formData.type.trim(),
        price,
        unit: formData.unit.trim(),
        stockQuantity: currentStock, // Primary stock field
        currentStock, // Keep for backward compatibility
        minStock,
        maxStock,
        inventoryValue: price * currentStock,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        stockTrend: 0
      };

      // Add product to Firestore
      const productRef = await addDoc(collection(db, 'products'), productData);

      console.log('Product added with ID:', productRef.id);
      toast.success(`${formData.name} added successfully!`);
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        type: '',
        price: '',
        unit: '',
        currentStock: '',
        minStock: '',
        maxStock: ''
      });

      onProductAdded();
      onClose();
      
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Failed to add product: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTypeInputChange = (e) => {
    const { value } = e.target;
    setFormData(prev => ({
      ...prev,
      type: value,
      // reset dependent fields when type changes
      name: '',
      unit: ''
    }));
  };

  const handleTypeSuggestionSelect = (option) => {
    setFormData(prev => ({
      ...prev,
      type: option.label,
      name: '',
      unit: ''
    }));
    setTypeInputFocused(false);
  };

  const handleProductNameInputChange = (e) => {
    const { value } = e.target;
    setFormData(prev => ({
      ...prev,
      name: value
    }));
  };

  const handleProductSuggestionSelect = (variant) => {
    const effectiveTypeValue = variant.parentType || matchedType?.value || null;
    const effectiveTypeLabel = variant.parentLabel || matchedType?.label || formData.type;
    const variantMeta = effectiveTypeValue ? getProductVariantMeta(effectiveTypeValue, variant.value) : null;

    setFormData(prev => ({
      ...prev,
      type: effectiveTypeLabel || prev.type,
      name: variant.value,
      unit: variantMeta?.size || variant.size || prev.unit
    }));
    setNameInputFocused(false);
  };

  const handleTypeInputFocus = () => {
    if (typeBlurTimeout.current) {
      clearTimeout(typeBlurTimeout.current);
    }
    setTypeInputFocused(true);
  };

  const handleTypeInputBlur = () => {
    typeBlurTimeout.current = setTimeout(() => {
      setTypeInputFocused(false);
    }, 150);
  };

  const handleNameInputFocus = () => {
    if (nameBlurTimeout.current) {
      clearTimeout(nameBlurTimeout.current);
    }
    setNameInputFocused(true);
  };

  const handleNameInputBlur = () => {
    nameBlurTimeout.current = setTimeout(() => {
      setNameInputFocused(false);
    }, 150);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Add New Product</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isSubmitting}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Product Image Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Product Image Preview
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 rounded-lg">
              {formData.type ? (
                <div className="relative w-40 h-40">
                  <img
                    src={previewPlaceholderSrc || getProductTypePlaceholder(formData.type)}
                    alt={selectedTypeLabel ? `${selectedTypeLabel} preview` : 'Product preview'}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs py-1 px-2 text-center">
                    Default {previewLabel} image
                  </div>
                </div>
              ) : (
                <div className="relative w-40 h-40 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500 text-sm text-center">
                    Select a product type<br />to see preview
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Product Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Type <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="type"
                  value={formData.type}
                  onChange={handleTypeInputChange}
                  onFocus={handleTypeInputFocus}
                  onBlur={handleTypeInputBlur}
                  required
                  autoComplete="off"
                  placeholder="Start typing to search or add"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                {typeInputFocused && typeSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    <ul className="py-1">
                      {typeSuggestions.map((option) => (
                        <li key={option.value}>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleTypeSuggestionSelect(option)}
                            className="w-full text-left px-3 py-2 hover:bg-emerald-50 focus:bg-emerald-50"
                          >
                            <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                            <span className="block text-xs text-gray-500">{option.value}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleProductNameInputChange}
                  onFocus={handleNameInputFocus}
                  onBlur={handleNameInputBlur}
                  required
                  disabled={!formData.type}
                  autoComplete="off"
                  placeholder={productNamePlaceholder}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-gray-100"
                />
                {nameInputFocused && productNameSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    <ul className="py-1">
                      {productNameSuggestions.map((variant) => (
                        <li key={variant.value}>
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleProductSuggestionSelect(variant)}
                            className="w-full text-left px-3 py-2 hover:bg-emerald-50 focus:bg-emerald-50"
                          >
                            <span className="block text-sm font-medium text-gray-900">{variant.label || variant.value}</span>
                            {variant.size && (
                              <span className="block text-xs text-gray-500">{variant.size}</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Enter product description..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price (GH₵) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                required
                placeholder="e.g., per 50kg bag, per piece"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Stock <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="currentStock"
                value={formData.currentStock}
                onChange={handleChange}
                required
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Stock Level <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="minStock"
                value={formData.minStock}
                onChange={handleChange}
                required
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Stock Level <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="maxStock"
                value={formData.maxStock}
                onChange={handleChange}
                required
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="1000"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 flex items-center"
            >
              {isSubmitting ? (
                <>
                  <Loader className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Adding Product...
                </>
              ) : (
                'Add Product'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProductModal;