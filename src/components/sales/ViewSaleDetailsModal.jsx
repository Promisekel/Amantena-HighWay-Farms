import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import toast from 'react-hot-toast';

const ViewSaleDetailsModal = ({ isOpen, onClose, sale }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSale, setEditedSale] = useState(null);
  const [loading, setLoading] = useState(false);

  // Update editedSale when sale changes
  useEffect(() => {
    if (sale) {
      setEditedSale(sale);
    }
  }, [sale]);

  if (!isOpen || !sale) return null;

  const handleEdit = async () => {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }

    setLoading(true);
    try {
      const saleRef = doc(db, 'sales', sale.id);
      const totalAmount = (editedSale.price || 0) * (editedSale.quantity || 0);
      await updateDoc(saleRef, {
        salesperson: editedSale.salesperson,
        customer: editedSale.customer,
        product: editedSale.product,
        productName: editedSale.productName || editedSale.product,
        quantity: editedSale.quantity,
        price: editedSale.price,
        unitPrice: editedSale.price,
        total: totalAmount,
        verifiedTotal: totalAmount
      });
      toast.success('Sale updated successfully');
      onClose();
    } catch (error) {
      console.error('Error updating sale:', error);
      toast.error('Failed to update sale');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this sale?')) return;

    setLoading(true);
    try {
      const saleRef = doc(db, 'sales', sale.id);
      await deleteDoc(saleRef);
      toast.success('Sale deleted successfully');
      onClose();
    } catch (error) {
      console.error('Error deleting sale:', error);
      toast.error('Failed to delete sale');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
        {/* Modal Header */}
        <div className="bg-emerald-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Sale Details</h2>
              <p className="text-emerald-100 mt-1">View and manage sale information</p>
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
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Salesperson</label>
              <input
                type="text"
                value={isEditing ? editedSale.salesperson : sale.salesperson}
                onChange={(e) => setEditedSale({ ...editedSale, salesperson: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={!isEditing}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
              <input
                type="text"
                value={isEditing ? editedSale.product : sale.product}
                onChange={(e) => {
                  const value = e.target.value;
                  setEditedSale({ ...editedSale, product: value, productName: value });
                }}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={!isEditing}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <input
                type="text"
                value={isEditing ? editedSale.customer : sale.customer}
                onChange={(e) => setEditedSale({ ...editedSale, customer: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                disabled={!isEditing}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (GH₵)</label>
                <input
                  type="number"
                  value={isEditing ? editedSale.price : sale.price}
                  onChange={(e) => setEditedSale({ ...editedSale, price: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  disabled={!isEditing}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  value={isEditing ? editedSale.quantity : sale.quantity}
                  onChange={(e) => setEditedSale({ ...editedSale, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (GH₵)</label>
              <input
                type="number"
                value={(isEditing ? editedSale.price * editedSale.quantity : sale.total).toFixed(2)}
                className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg"
                disabled
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-between">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-6 py-2.5 border border-red-600 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors"
          >
            Delete Sale
          </button>
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEdit}
              disabled={loading}
              className={`px-6 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors
                ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Edit Sale'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewSaleDetailsModal;
