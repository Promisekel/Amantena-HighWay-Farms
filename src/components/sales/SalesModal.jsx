import React, { useState, useEffect } from 'react';
import { X, Plus, Minus } from 'lucide-react';
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

const createEmptyItem = () => ({
  productId: '',
  productName: '',
  productType: '',
  typeLabel: '',
  customer: '',
  price: 0,
  quantity: 1,
  total: 0,
  maxStock: 0
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

  const handleProductChange = (index, productId) => {
    const selectedProduct = products.find((product) => product.id === productId);
    if (!selectedProduct) {
      return;
    }

    if (selectedProduct.stockQuantity <= 0) {
      toast.error(`${selectedProduct.name} is out of stock`);
      return;
    }

    setItems((prevItems) => {
      const nextItems = [...prevItems];
      const currentQuantity = nextItems[index]?.quantity || 1;
      const adjustedQuantity = Math.min(currentQuantity, selectedProduct.stockQuantity);

      if (currentQuantity > selectedProduct.stockQuantity) {
        toast.warning(`Quantity adjusted to available stock: ${selectedProduct.stockQuantity}`);
      }

      nextItems[index] = {
        ...nextItems[index],
        productId,
        productName: selectedProduct.name,
        productType: selectedProduct.type,
        typeLabel: getProductTypeLabel(selectedProduct.type),
        price: selectedProduct.price || 0,
        quantity: adjustedQuantity,
        total: (selectedProduct.price || 0) * adjustedQuantity,
        maxStock: selectedProduct.stockQuantity
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

      nextItems[index] = {
        ...targetItem,
        quantity: safeQuantity,
        total: (targetItem.price || 0) * safeQuantity,
        maxStock: selectedProduct.stockQuantity
      };

      return nextItems;
    });
  };

  const handleCustomerChange = (index, customer) => {
    setItems((prevItems) => {
      const nextItems = [...prevItems];
      nextItems[index] = { ...nextItems[index], customer };
      return nextItems;
    });
  };

  const addRow = () => {
    setItems((prevItems) => [...prevItems, createEmptyItem()]);
  };

  const removeRow = (index) => {
    setItems((prevItems) => (prevItems.length > 1 ? prevItems.filter((_, i) => i !== index) : prevItems));
  };

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => sum + (item.total || 0), 0);
  };

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
      if (!item.customer.trim()) {
        toast.error('Please enter customer name for all items');
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

          batch.set(saleRef, {
            productId: product.id,
            productName: product.name,
            productType: product.type || 'UNSPECIFIED',
            product: product.name,
            customer: saleItem.customer,
            quantity: saleItem.quantity,
            unitPrice: saleItem.price,
            price: saleItem.price,
            total: saleItem.total,
            verifiedTotal: saleItem.total,
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer *</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price (GH₵)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity *</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total (GH₵)</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3">
                      <select
                        value={item.productId}
                        onChange={(e) => handleProductChange(index, e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        required
                      >
                        <option value="">Select Product</option>
                        {products.map((product) => (
                          <option
                            key={product.id}
                            value={product.id}
                            disabled={product.stockQuantity <= 0}
                          >
                            {product.name} • {getProductTypeLabel(product.type)} ({product.stockQuantity} in stock)
                          </option>
                        ))}
                      </select>
                      {item.typeLabel && (
                        <p className="mt-1 text-xs text-gray-500">{item.typeLabel}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={item.customer}
                        onChange={(e) => handleCustomerChange(index, e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Customer name"
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
                ))}
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
            <div className="text-xl font-bold text-gray-900">
              Grand Total: GH₵{calculateGrandTotal().toFixed(2)}
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