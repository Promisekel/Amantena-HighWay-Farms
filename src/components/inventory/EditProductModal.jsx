import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { Combobox, Transition } from '@headlessui/react';
import { X, ChevronDown } from 'lucide-react';
import { updateProduct, auth } from '../../services/firebase';
import toast from 'react-hot-toast';
import {
  productTypes,
  productVariantsByType,
  getProductTypeLabel,
  getProductVariantMeta,
  getProductTypePlaceholder
} from './productTypes';

const normaliseValue = (value = '') => value.trim().toLowerCase();

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
  const [typeSelection, setTypeSelection] = useState(null);
  const [nameSelection, setNameSelection] = useState(null);

  const productTypeOptions = useMemo(() => productTypes || [], []);

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
      const matchedTypeOption = productTypeOptions.find((option) => option.value === product.type) || null;

      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price,
        stockQuantity: Number(product.stockQuantity ?? product.currentStock ?? 0) || 0,
        minStock: product.minStock,
        maxStock: product.maxStock,
        unit: product.unit,
        type: matchedTypeOption?.label || product.type || '',
        imageUrl: product.imageUrl || getProductTypePlaceholder(product.type),
        newStock: ''
      });

      setTypeSelection(matchedTypeOption);
      setNameSelection({
        value: product.name,
        label: product.name,
        parentType: matchedTypeOption?.value || product.type,
        parentLabel: matchedTypeOption?.label || getProductTypeLabel(product.type)
      });
    }
  }, [product, productTypeOptions]);

  const matchedType = useMemo(() => {
    if (typeSelection) {
      return typeSelection;
    }
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
  }, [formData.type, typeSelection, productTypeOptions]);

  const variantOptions = useMemo(() => {
    if (!matchedType) {
      return [];
    }
    const variants = productVariantsByType[matchedType.value] || [];
    const mapped = variants.map((variant) => ({
      ...variant,
      parentType: matchedType.value,
      parentLabel: matchedType.label
    }));

    if (formData.name && !mapped.some((variant) => normaliseValue(variant.value) === normaliseValue(formData.name))) {
      mapped.unshift({
        value: formData.name,
        label: formData.name,
        parentType: matchedType.value,
        parentLabel: matchedType.label
      });
    }

    return mapped;
  }, [matchedType, formData.name]);

  const allVariantSuggestions = useMemo(() => {
    const seen = new Map();
    productTypeOptions.forEach((catalogItem) => {
      const variants = productVariantsByType[catalogItem.value] || [];
      variants.forEach((variant) => {
        const key = `${catalogItem.value}-${variant.value}`;
        if (!seen.has(key)) {
          seen.set(key, {
            ...variant,
            parentType: catalogItem.value,
            parentLabel: catalogItem.label
          });
        }
      });
    });
    return Array.from(seen.values());
  }, [productTypeOptions]);

  const productNameSuggestionSource = useMemo(() => {
    return variantOptions.length > 0 ? variantOptions : allVariantSuggestions;
  }, [variantOptions, allVariantSuggestions]);

  const typeSuggestions = useMemo(() => {
    if (!formData.type) {
      return productTypeOptions.slice(0, 8);
    }

    const normalisedInput = normaliseValue(formData.type);
    return productTypeOptions
      .filter((option) => {
        const valueMatch = normaliseValue(option.value).includes(normalisedInput);
        const labelMatch = normaliseValue(option.label).includes(normalisedInput);
        return valueMatch || labelMatch;
      })
      .slice(0, 8);
  }, [formData.type, productTypeOptions]);

  const productNameSuggestions = useMemo(() => {
    const source = formData.type ? productNameSuggestionSource : allVariantSuggestions;

    if (!formData.name) {
      return source.slice(0, 8);
    }

    const normalisedInput = normaliseValue(formData.name);
    return source
      .filter((variant) => {
        const valueMatch = normaliseValue(variant.value).includes(normalisedInput);
        const labelMatch = normaliseValue(variant.label || '').includes(normalisedInput);
        return valueMatch || labelMatch;
      })
      .slice(0, 8);
  }, [formData.type, formData.name, productNameSuggestionSource, allVariantSuggestions]);

  const selectedTypeLabel = matchedType ? matchedType.label : (formData.type || '');
  const previewPlaceholderSrc = getProductTypePlaceholder(matchedType?.value);
  const previewImageSrc = formData.imageUrl || previewPlaceholderSrc || getProductTypePlaceholder(formData.type);
  const previewLabel = selectedTypeLabel ? selectedTypeLabel.toLowerCase() : 'product';
  const hasCustomImage = useMemo(() => formData.imageUrl && /^https?:\/\//i.test(formData.imageUrl), [formData.imageUrl]);
  const productNamePlaceholder = !formData.type
    ? 'Enter product type first'
    : matchedType
      ? `Search or add ${selectedTypeLabel} products`
      : 'Enter product name';
  const resolvedProductNamePlaceholder = formData.type
    ? productNamePlaceholder
    : 'Search or add product name';
  const typeInputPlaceholder = 'Search or add product type';

  const handleTypeInputChange = (value) => {
    setTypeSelection(null);
    setNameSelection(null);
    setFormData((prev) => ({
      ...prev,
      type: value,
      name: '',
      unit: prev.unit
    }));
  };

  const handleTypeSelect = (option) => {
    setTypeSelection(option);
    setNameSelection(null);
    setFormData((prev) => ({
      ...prev,
      type: option?.label || '',
      name: '',
      unit: '',
      imageUrl: option ? getProductTypePlaceholder(option.value) : prev.imageUrl
    }));
  };

  const handleProductNameInputChange = (value) => {
    setNameSelection(null);
    setFormData((prev) => ({
      ...prev,
      name: value
    }));
  };

  const handleProductSuggestionSelect = (variant) => {
    const effectiveTypeValue = variant.parentType || matchedType?.value || null;
    const variantMeta = effectiveTypeValue ? getProductVariantMeta(effectiveTypeValue, variant.value) : null;

    if (variant.parentType && variant.parentLabel) {
      setTypeSelection({ value: variant.parentType, label: variant.parentLabel });
    }

    setNameSelection(variant);
    setFormData((prev) => ({
      ...prev,
      type: variant.parentLabel || prev.type,
      name: variant.value,
      unit: variantMeta?.size || variant.size || prev.unit,
      imageUrl: effectiveTypeValue ? getProductTypePlaceholder(effectiveTypeValue) : prev.imageUrl
    }));
  };

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

      const { newStock, ...formValues } = formData;

      const canonicalType = matchedType ? matchedType.value : (formData.type || '').trim();
      const typeLabel = matchedType ? matchedType.label : (formData.type || '').trim();
      const productName = (formData.name || '').trim();

      if (!canonicalType) {
        toast.error('Please enter a valid product type');
        return;
      }

      if (!productName) {
        toast.error('Please enter a valid product name');
        return;
      }

      const { type: _typeInput, ...restValues } = formValues;
      const categoryValue = canonicalType || product?.category || product?.type || 'uncategorized';

      const updatePayload = {
        ...restValues,
        name: productName,
        type: canonicalType,
        typeLabel,
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

      // Update product in Firestore via service so stock history is recorded

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
              <div className="relative w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center overflow-hidden bg-white">
                <img
                  src={previewImageSrc}
                  alt={selectedTypeLabel ? `${selectedTypeLabel} preview` : 'Product preview'}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] font-medium tracking-wide uppercase text-center py-1">
                  {hasCustomImage ? 'Custom product image' : `Default ${previewLabel} image`}
                </div>
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
              <Combobox
                value={typeSelection}
                nullable
                onChange={(option) => {
                  if (option) {
                    handleTypeSelect(option);
                  } else {
                    setTypeSelection(null);
                  }
                }}
              >
                <div className="relative">
                  <Combobox.Input
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    displayValue={(option) => option?.label || option?.value || formData.type}
                    onChange={(event) => handleTypeInputChange(event.target.value)}
                    placeholder={typeInputPlaceholder}
                    autoComplete="off"
                    name="type"
                    required
                  />
                  <Combobox.Button className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <ChevronDown size={16} aria-hidden="true" />
                  </Combobox.Button>
                  <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    {typeSuggestions.length === 0 && formData.type ? (
                      <Combobox.Options className="absolute left-0 top-full z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-2 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        <div className="px-3 py-2 text-gray-500">No matching types. Press enter to keep typing.</div>
                      </Combobox.Options>
                    ) : typeSuggestions.length > 0 ? (
                      <Combobox.Options className="absolute left-0 top-full z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-2 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        {typeSuggestions.map((option) => (
                          <Combobox.Option
                            key={option.value}
                            value={option}
                            className={({ active }) =>
                              `cursor-pointer select-none px-3 py-2 ${
                                active ? 'bg-emerald-50 text-emerald-900' : 'text-gray-900'
                              }`
                            }
                          >
                            <span className="block text-sm font-medium">{option.label}</span>
                            <span className="block text-xs text-gray-500">{option.value}</span>
                          </Combobox.Option>
                        ))}
                      </Combobox.Options>
                    ) : null}
                  </Transition>
                </div>
              </Combobox>
            </div>

            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name
              </label>
              <Combobox
                value={nameSelection}
                nullable
                onChange={(variant) => {
                  if (variant) {
                    handleProductSuggestionSelect(variant);
                  } else {
                    setNameSelection(null);
                  }
                }}
              >
                <div className="relative">
                  <Combobox.Input
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    displayValue={(variant) => variant?.label || variant?.value || formData.name}
                    onChange={(event) => handleProductNameInputChange(event.target.value)}
                    placeholder={resolvedProductNamePlaceholder}
                    autoComplete="off"
                    name="name"
                    required
                  />
                  <Combobox.Button className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <ChevronDown size={16} aria-hidden="true" />
                  </Combobox.Button>
                  <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    {formData.name && productNameSuggestions.length === 0 ? (
                      <Combobox.Options className="absolute left-0 top-full z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-2 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        <div className="px-3 py-2 text-gray-500">No matching products. Press enter to keep typing.</div>
                      </Combobox.Options>
                    ) : productNameSuggestions.length > 0 ? (
                      <Combobox.Options className="absolute left-0 top-full z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-2 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        {productNameSuggestions.map((variant) => (
                          <Combobox.Option
                            key={`${variant.parentType || 'global'}-${variant.value}`}
                            value={variant}
                            className={({ active }) =>
                              `cursor-pointer select-none px-3 py-2 ${
                                active ? 'bg-emerald-50 text-emerald-900' : 'text-gray-900'
                              }`
                            }
                          >
                            <span className="block text-sm font-medium">
                              {variant.label || variant.value}
                            </span>
                            {variant.size && (
                              <span className="block text-xs text-gray-500">{variant.size}</span>
                            )}
                            {variant.parentLabel && (
                              <span className="block text-xs text-gray-400">{variant.parentLabel}</span>
                            )}
                          </Combobox.Option>
                        ))}
                      </Combobox.Options>
                    ) : null}
                  </Transition>
                </div>
              </Combobox>
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
