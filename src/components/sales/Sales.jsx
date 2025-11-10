import React from 'react';
import { Plus, Eye } from 'lucide-react';
import { mockSales } from '../../data/mockData';
import toast from 'react-hot-toast';

const Sales = () => {
    const handleRecordSaleClick = () => {
        toast('Sale recording flow coming soon');
    };
    
    return (
        <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Sales Management</h2>
                    <p className="text-gray-600">Track and manage your daily sales transactions</p>
                </div>
                <button 
                    onClick={handleRecordSaleClick}
                    className="mt-4 md:mt-0 gradient-primary text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center space-x-2"
                >
                    <Plus className="h-5 w-5" />
                    <span>Record Sale</span>
                </button>
            </div>

            <div className="glass-effect rounded-2xl p-6 mb-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Sales Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                        <p className="text-3xl font-bold text-green-600">₵2,430</p>
                        <p className="text-gray-600">Today's Sales</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-bold text-blue-600">15</p>
                        <p className="text-gray-600">Transactions</p>
                    </div>
                    <div className="text-center">
                        <p className="text-3xl font-bold text-orange-600">₵162</p>
                        <p className="text-gray-600">Average Sale</p>
                    </div>
                </div>
            </div>

            <div className="glass-effect rounded-2xl p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-6">Recent Transactions</h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Product</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Customer</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Quantity</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Amount</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {mockSales.map(sale => (
                                <tr key={sale.id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-4 px-4">
                                        <div>
                                            <p className="font-semibold text-gray-800">{sale.productName}</p>
                                            <p className="text-sm text-gray-600">₵{sale.unitPrice} each</p>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <p className="text-gray-800">{sale.customerName}</p>
                                    </td>
                                    <td className="py-4 px-4">
                                        <p className="text-gray-800">{sale.quantity}</p>
                                    </td>
                                    <td className="py-4 px-4">
                                        <p className="font-bold text-green-600">₵{sale.totalAmount}</p>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div>
                                            <p className="text-gray-800">{sale.date}</p>
                                            <p className="text-sm text-gray-600">{sale.time}</p>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <button className="text-blue-600 hover:text-blue-800 transition-colors">
                                            <Eye className="h-5 w-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Sales;
