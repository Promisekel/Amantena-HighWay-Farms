import React, { Fragment, useState, useEffect } from 'react';
import { Combobox, Transition } from '@headlessui/react';
import { X, Plus, Minus, ChevronDown } from 'lucide-react';
import {
  collection,
  serverTimestamp,
  doc,
  getDocs,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import toast from 'react-hot-toast';
import { normaliseProductRecord } from '../reports/reportUtils';
import { getProductTypeLabel } from '../inventory/productTypes';

const normaliseValue = (value = '') => value.trim().toLowerCase();

const createEmptyItem = () => ({
  productId: '',
  productName: '',
  productType: '',
  typeLabel: '',
  price: 0,
  quantity: 1,
  total: 0,
  maxStock: 0,
  searchTerm: ''
});

const SalesModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [salesperson, setSalesperson] = useState('');
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([createEmptyItem()]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsRef = collection(db, 'products');
        const productsSnap = await getDocs(productsRef);
        const productsList = productsSnap.docs
          .map((document) => normaliseProductRecord({ id: document.id, ...document.data() }))
          .filter((product) => product.status !== 'archived');
        setProducts(productsList);
      } catch (error) {
        console.error('Error fetching products:', error);
        toast.error('Failed to load products');
      }
    };

    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  const resolveProductTypeLabel = (product) => {
    return product?.typeLabel || product?.raw?.typeLabel || getProductTypeLabel(product?.type);
  };

  const handleProductSearchChange = (index, value) => {
    setItems((prevItems) => {
      const nextItems = [...prevItems];
      const current = nextItems[index] || createEmptyItem();
      nextItems[index] = {
        ...current,
        searchTerm: value,
        productId: '',
        productName: '',
        productType: '',
        typeLabel: '',
        price: 0,
        total: 0,
        maxStock: 0
      };
      return nextItems;
    });
  };

  const handleProductSelect = (index, product) => {
    if (!product) {
      return;
    }

    if (product.stockQuantity <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }

    setItems((prevItems) => {
      const nextItems = [...prevItems];
      const existing = nextItems[index] || createEmptyItem();
      const currentQuantity = existing.quantity || 1;
      const safeQuantity = Math.min(currentQuantity, product.stockQuantity);

      if (currentQuantity > product.stockQuantity) {
        toast.warning(`Quantity adjusted to available stock: ${product.stockQuantity}`);
      }

      const unitPrice = Number(product.price) || 0;
      const typeLabel = resolveProductTypeLabel(product);

      nextItems[index] = {
        ...existing,
        productId: product.id,
        productName: product.name,
        searchTerm: product.name,
        productType: product.type,
        typeLabel,
        price: unitPrice,
        quantity: safeQuantity,
        total: unitPrice * safeQuantity,
        maxStock: product.stockQuantity
      };

      return nextItems;
    });
  };

  const handleQuantityChange = (index, quantityValue) => {
    const quantity = Math.max(1, quantityValue);
    setItems((prevItems) => {
      const nextItems = [...prevItems];
      const targetItem = nextItems[index];
      if (!targetItem?.productId) {
        nextItems[index] = {
          ...targetItem,
          quantity,
          total: (targetItem?.price || 0) * quantity
        };
        return nextItems;
      }

      const selectedProduct = products.find((product) => product.id === targetItem.productId);
      if (!selectedProduct) {
        return nextItems;
      }

      let safeQuantity = quantity;
      if (safeQuantity > selectedProduct.stockQuantity) {
        toast.error(`Only ${selectedProduct.stockQuantity} units available in stock`);
        safeQuantity = selectedProduct.stockQuantity;
      }

      const unitPrice = Number(targetItem.price) || 0;

      nextItems[index] = {
        ...targetItem,
        quantity: safeQuantity,
        total: unitPrice * safeQuantity,
        maxStock: selectedProduct.stockQuantity
      };

      return nextItems;
    });
  };

  const addRow = () => {
    setItems((prevItems) => [...prevItems, createEmptyItem()]);
  };

  const removeRow = (index) => {
    setItems((prevItems) => (prevItems.length > 1 ? prevItems.filter((_, i) => i !== index) : prevItems));
  };

  const calculateTotals = () =>
    items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

  const resetForm = () => {
    setSalesperson('');
    setItems([createEmptyItem()]);
  };

  const validateForm = () => {
    if (!salesperson.trim()) {
      toast.error('Please enter salesperson name');
      return false;
    }

    const allocation = new Map();

    for (const item of items) {
      if (!item.productId) {
        toast.error('Please select a product for all items');
        return false;
      }
      if (!item.quantity || item.quantity <= 0) {
        toast.error('Please enter a valid quantity for all items');
        return false;
      }
      if (!item.price || item.price <= 0) {
        toast.error('Please enter a valid price for all items');
        return false;
      }
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        toast.error('Selected product not found');
        return false;
      }

      const allocatedSoFar = allocation.get(item.productId) || 0;
      const newAllocation = allocatedSoFar + item.quantity;

      if (newAllocation > product.stockQuantity) {
        toast.error(`Not enough stock for ${product.name}. Available: ${product.stockQuantity}`);
        return false;
      }

      allocation.set(item.productId, newAllocation);
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();

    if (loading) return;
    if (!validateForm()) return;

    setLoading(true);

    try {
      const batch = writeBatch(db);
      const timestamp = serverTimestamp();
      const salesCollection = collection(db, 'sales');
      const productUsage = new Map();

      items.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (!product) {
          throw new Error('Product not found during submission');
        }

        const entry = productUsage.get(product.id) || {
          product,
          totalQuantity: 0,
          sales: []
        };

        entry.totalQuantity += item.quantity;
        entry.sales.push({ ...item });
        productUsage.set(product.id, entry);
      });

      productUsage.forEach(({ product, totalQuantity, sales }) => {
        const productRef = doc(db, 'products', product.id);

        batch.update(productRef, {
          stockQuantity: increment(-totalQuantity),
          currentStock: increment(-totalQuantity),
          lastUpdated: timestamp
        });

        let runningStock = product.stockQuantity;

        sales.forEach((saleItem) => {
          const saleRef = doc(salesCollection);
          const newStockLevel = runningStock - saleItem.quantity;
          const baseTotal = Number(saleItem.total) || 0;

          batch.set(saleRef, {
            productId: product.id,
            productName: product.name,
            productType: product.type || 'UNSPECIFIED',
            product: product.name,
            quantity: saleItem.quantity,
            unitPrice: saleItem.price,
            price: saleItem.price,
            total: baseTotal,
            verifiedTotal: baseTotal,
            salesperson,
            timestamp,
            previousStock: runningStock,
            newStock: newStockLevel,
            status: 'completed',
            createdAt: timestamp
          });

          runningStock = newStockLevel;
        });
      });

      await batch.commit();
      toast.success('Sales recorded successfully! Inventory updated.');

      resetForm();
      onClose();
    } catch (error) {
      console.error('Error recording sales:', error);
      toast.error(error.message || 'Failed to record sales');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  const grandTotal = calculateTotals();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        <div className="bg-emerald-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Record New Sales</h2>
              <p className="text-emerald-100 mt-1">Enter the sales transaction details below</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-emerald-700 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Salesperson Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={salesperson}
              onChange={(e) => setSalesperson(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Enter salesperson name"
              required
            />
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg mb-4">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product *</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity *</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price (GH₵)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total (GH₵)</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => {
                  const searchTerm = item.searchTerm || '';
                  const normalisedSearch = normaliseValue(searchTerm);
                  const filteredProducts = products
                    .filter((product) => {
                      const typeLabel = resolveProductTypeLabel(product);
                      const searchHaystack = `${product.name} ${typeLabel}`.toLowerCase();
                      if (!normalisedSearch) {
                        return true;
                      }
                      return searchHaystack.includes(normalisedSearch);
                    })
                    .slice(0, 8);

                  const selectedProduct = products.find((product) => product.id === item.productId) || null;

                  return (
                    <tr key={index}>
                      <td className="relative px-4 py-3 align-top" style={{ minWidth: '22rem', overflow: 'visible' }}>
                        <Combobox
                          value={selectedProduct}
                          nullable
                          onChange={(product) => handleProductSelect(index, product)}
                        >
                          <div className="relative min-w-[22rem]">
                            <Combobox.Input
                              className="w-full min-w-[18rem] sm:min-w-[22rem] p-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                              displayValue={(product) => product?.name || searchTerm}
                              onChange={(event) => handleProductSearchChange(index, event.target.value)}
                              placeholder="Select product from inventory"
                              autoComplete="off"
                            />
                            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
                              <ChevronDown size={16} aria-hidden="true" />
                            </Combobox.Button>
                            <Transition
                              as={Fragment}
                              leave="transition ease-in duration-100"
                              leaveFrom="opacity-100"
                              leaveTo="opacity-0"
                            >
                              <Combobox.Options className="absolute left-0 top-full z-30 mt-1 w-full min-w-[22rem] max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white py-2 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                                {filteredProducts.length === 0 ? (
                                  <div className="px-3 py-2 text-sm text-gray-500">No products found</div>
                                ) : (
                                  filteredProducts.map((product) => {
                                    const typeLabel = resolveProductTypeLabel(product);
                                    const outOfStock = product.stockQuantity <= 0;
                                    return (
                                      <Combobox.Option
                                        key={product.id}
                                        value={product}
                                        disabled={outOfStock}
                                        className={({ active, disabled }) =>
                                          `relative cursor-default select-none px-3 py-2 ${
                                            disabled
                                              ? 'text-gray-400 cursor-not-allowed'
                                              : active
                                                ? 'bg-emerald-50 text-emerald-900'
                                                : 'text-gray-900'
                                          }`
                                        }
                                      >
                                        <div>
                                          <p className="text-sm font-medium">{product.name}</p>
                                          <p className="text-xs text-gray-500">
                                            {typeLabel} • GH₵{Number(product.price || 0).toFixed(2)} •{' '}
                                            {outOfStock ? 'Out of stock' : `${product.stockQuantity} in stock`}
                                          </p>
                                        </div>
                                      </Combobox.Option>
                                    );
                                  })
                                )}
                              </Combobox.Options>
                            </Transition>
                          </div>
                        </Combobox>
                        {item.typeLabel && (
                          <p className="mt-1 text-xs text-gray-500">{item.typeLabel}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(index, parseInt(e.target.value, 10) || 0)}
                          min="1"
                          max={item.maxStock || undefined}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          required
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={(item.price || 0).toFixed(2)}
                          readOnly
                          className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50"
                          step="0.01"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={(item.total || 0).toFixed(2)}
                          readOnly
                          className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          disabled={items.length === 1}
                          className={`p-1.5 rounded-lg transition-colors ${
                            items.length === 1
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-red-600 hover:bg-red-50'
                          }`}
                        >
                          <Minus size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={addRow}
            className="mb-6 flex items-center text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            <Plus size={16} className="mr-1" />
            Add Another Item
          </button>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <div>
              <div className="text-xl font-bold text-gray-900">
                Grand Total: GH₵{grandTotal.toFixed(2)}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-gray-700 hover:text-gray-900 font-medium"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium flex items-center space-x-2 ${
                  loading
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-emerald-700'
                }`}
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Recording...</span>
                  </>
                ) : (
                  'Record Sales'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SalesModal;