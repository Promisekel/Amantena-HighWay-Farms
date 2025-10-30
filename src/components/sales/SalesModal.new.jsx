import React, { useState, useEffect } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { addDoc, collection, serverTimestamp, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import toast from 'react-hot-toast';

const SalesModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [salesperson, setSalesperson] = useState('');
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([{
    product: '',
    customer: '',
    price: 0,
    quantity: 1,
    total: 0
  }]);

  // Fetch products and their stock levels from Firestore
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsRef = collection(db, 'products');
        const productsSnap = await getDocs(productsRef);
        const productsList = [];
        productsSnap.forEach(doc => {
          productsList.push({
            id: doc.id,
            ...doc.data()
          });
        });
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

  const handleProductChange = (index, product) => {
    const newItems = [...items];
    const selectedProduct = products.find(p => p.name === product);
    
    if (selectedProduct) {
      if (selectedProduct.stockQuantity === 0) {
        toast.error(`${product} is out of stock`);
        return;
      }
      
      newItems[index].product = product;
      newItems[index].price = selectedProduct.price || 0;
      
      // Adjust quantity if it exceeds available stock
      if (newItems[index].quantity > selectedProduct.stockQuantity) {
        newItems[index].quantity = selectedProduct.stockQuantity;
        toast.warning(`Quantity adjusted to available stock: ${selectedProduct.stockQuantity}`);
      }
      
      newItems[index].total = newItems[index].price * newItems[index].quantity;
      setItems(newItems);
    }
  };

  const handleQuantityChange = (index, quantity) => {
    const newItems = [...items];
    const selectedProduct = products.find(p => p.name === newItems[index].product);
    
    if (selectedProduct && quantity > selectedProduct.stockQuantity) {
      toast.error(`Only ${selectedProduct.stockQuantity} units available in stock`);
      quantity = selectedProduct.stockQuantity;
    }
    
    newItems[index].quantity = quantity;
    newItems[index].total = newItems[index].price * quantity;
    setItems(newItems);
  };

  const handleCustomerChange = (index, customer) => {
    const newItems = [...items];
    newItems[index].customer = customer;
    setItems(newItems);
  };

  const addRow = () => {
    setItems([...items, {
      product: '',
      customer: '',
      price: 0,
      quantity: 1,
      total: 0
    }]);
  };

  const removeRow = (index) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
    }
  };

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const resetForm = () => {
    setSalesperson('');
    setItems([{
      product: '',
      customer: '',
      price: 0,
      quantity: 1,
      total: 0
    }]);
  };

  const handleSubmit = async () => {
    if (!salesperson.trim()) {
      toast.error('Please enter salesperson name');
      return;
    }

    if (items.some(item => !item.product || !item.customer || !item.quantity)) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate stock levels before proceeding
    for (const item of items) {
      const product = products.find(p => p.name === item.product);
      if (!product) {
        toast.error(`Product ${item.product} not found`);
        return;
      }
      if (item.quantity > product.stockQuantity) {
        toast.error(`Not enough stock for ${item.product}. Available: ${product.stockQuantity}`);
        return;
      }
    }

    setLoading(true);
    try {
      const salesRef = collection(db, 'sales');
      const timestamp = serverTimestamp();

      // Update stock levels and record sales
      for (const item of items) {
        const product = products.find(p => p.name === item.product);
        const productRef = doc(db, 'products', product.id);
        
        // Update stock level
        await updateDoc(productRef, {
          stockQuantity: product.stockQuantity - item.quantity
        });

        // Record sale
        await addDoc(salesRef, {
          ...item,
          salesperson,
          timestamp,
          previousStock: product.stockQuantity,
          newStock: product.stockQuantity - item.quantity
        });
      }

      toast.success('Sales recorded successfully');
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error recording sales:', error);
      toast.error('Failed to record sales');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
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

        {/* Modal Body */}
        <div className="p-6 max-h-[calc(90vh-200px)] overflow-y-auto">
          {/* Salesperson Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Salesperson Name
            </label>
            <input
              type="text"
              value={salesperson}
              onChange={(e) => setSalesperson(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Enter salesperson name"
            />
          </div>

          {/* Sales Items Table */}
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price (GH₵)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total (GH₵)</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3">
                      <select
                        value={item.product}
                        onChange={(e) => handleProductChange(index, e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        <option value="">Select Product</option>
                        {products.map(product => (
                          <option 
                            key={product.id} 
                            value={product.name}
                            disabled={product.stockQuantity === 0}
                          >
                            {product.name} ({product.stockQuantity} in stock)
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={item.customer}
                        onChange={(e) => handleCustomerChange(index, e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Customer name"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].price = parseFloat(e.target.value) || 0;
                          newItems[index].total = newItems[index].price * newItems[index].quantity;
                          setItems(newItems);
                        }}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.quantity}
                        min="1"
                        onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 0)}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={item.total}
                        readOnly
                        className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeRow(index)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Minus size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Row Button */}
          <button
            onClick={addRow}
            className="mt-4 flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium"
          >
            <Plus size={20} />
            Add Another Item
          </button>

          {/* Grand Total */}
          <div className="mt-6 text-right">
            <div className="text-lg font-medium text-gray-700">
              Grand Total: <span className="text-2xl font-bold text-emerald-600">GH₵{calculateGrandTotal().toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors
              ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Recording...' : 'Record Sales'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesModal;
