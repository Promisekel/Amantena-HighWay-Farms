import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { 
    LayoutDashboard, 
    Package, 
    ShoppingCart, 
    BarChart3, 
    Settings, 
    HelpCircle,
    X,
    MessageCircle,
    Mail,
    Phone,
    Send
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import { sendSupportRequestEmail } from '../services/emailNotifications';

const Sidebar = ({ activeSection, setActiveSection, isOpen }) => {
    const { currentUser } = useAuth();
    const [showSupportModal, setShowSupportModal] = useState(false);
    const [supportForm, setSupportForm] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    });
    const [sendingSupport, setSendingSupport] = useState(false);
    const [appName, setAppName] = useState('Amantena Highway Farms');
    const [appDescription, setAppDescription] = useState('Inventory Management System');

    useEffect(() => {
        let isMounted = true;

        const fetchSettings = async () => {
            try {
                const settingsDoc = await getDoc(doc(db, 'settings', 'app-settings'));
                if (!isMounted) return;

                if (settingsDoc.exists()) {
                    const data = settingsDoc.data();
                    setAppName(data.appName || data.farmName || 'Amantena Highway Farms');
                    setAppDescription(data.appDescription || data.farmDescription || 'Inventory Management System');
                }
            } catch (error) {
                console.error('Failed to load app settings for sidebar:', error);
            }
        };

        const handleSettingsUpdate = (event) => {
            const { appName: newName, appDescription: newDesc } = event.detail || {};
            if (newName) setAppName(newName);
            if (newDesc) setAppDescription(newDesc);
        };

        fetchSettings();
        window.addEventListener('app-settings-updated', handleSettingsUpdate);

        return () => {
            isMounted = false;
            window.removeEventListener('app-settings-updated', handleSettingsUpdate);
        };
    }, []);

    useEffect(() => {
        if (!currentUser) {
            return;
        }

        setSupportForm((prev) => ({
            ...prev,
            name: prev.name || currentUser.displayName || '',
            email: prev.email || currentUser.email || ''
        }));
    }, [currentUser]);

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'inventory', label: 'Inventory', icon: Package },
        { id: 'sales', label: 'Sales', icon: ShoppingCart },
        { id: 'reports', label: 'Reports', icon: BarChart3 },
        { id: 'settings', label: 'Settings', icon: Settings }
    ];

    const handleSupportSubmit = async (event) => {
        event.preventDefault();

        setSendingSupport(true);
        try {
            const sendPromise = (async () => {
                await sendSupportRequestEmail({
                    fromEmail: supportForm.email,
                    fromName: supportForm.name,
                    subject: supportForm.subject,
                    message: supportForm.message
                });
            })();

            await toast.promise(sendPromise, {
                loading: 'Sending support request...',
                success: 'Support request sent successfully.',
                error: (error) => error?.message || 'Failed to send support request. Please try again.'
            });

            setShowSupportModal(false);
            setSupportForm({
                name: currentUser?.displayName || '',
                email: currentUser?.email || '',
                subject: '',
                message: ''
            });
        } catch (error) {
            console.error('Failed to send support request:', error);
        } finally {
            setSendingSupport(false);
        }
    };

    const handleInputChange = (field, value) => {
        setSupportForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <>
            <aside className={`fixed left-0 top-0 h-full w-72 bg-gradient-to-b from-emerald-50 via-white to-green-50 shadow-xl z-30 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 border-r border-emerald-200/50`}>
                {/* Header */}
                <div className="p-6 border-b border-emerald-200/30">
                    <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                            {appName?.charAt(0) || 'A'}
                        </div>
                        <div>
                            <h2 className="font-bold text-emerald-900 truncate" title={appName}>{appName}</h2>
                            <p className="text-sm text-emerald-600/70 truncate" title={appDescription}>{appDescription}</p>
                        </div>
                    </div>
                </div>
                
                {/* Navigation */}
                <nav className="mt-6 px-4 flex-1">
                    {menuItems.map((item, index) => {
                        const Icon = item.icon;
                        const isActive = activeSection === item.id;
                        
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveSection(item.id)}
                                className={`w-full flex items-center space-x-3 px-4 py-3 mb-2 rounded-xl transition-all duration-300 group relative ${
                                    isActive
                                        ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25 scale-105'
                                        : 'text-emerald-700 hover:bg-emerald-100/70 hover:text-emerald-800 hover:shadow-md hover:scale-102'
                                }`}
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                {/* Active indicator */}
                                {isActive && (
                                    <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 bg-white rounded-r-full"></div>
                                )}
                                
                                <Icon size={20} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                <span className="font-medium">{item.label}</span>
                                
                                {/* Hover effect */}
                                {!isActive && (
                                    <div className="absolute right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Support Section */}
                <div className="absolute bottom-6 left-4 right-4">
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-emerald-200/50 shadow-lg">
                        <div className="flex items-center space-x-3 mb-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
                                <HelpCircle size={16} className="text-white" />
                            </div>
                            <span className="font-semibold text-emerald-900">Need Help?</span>
                        </div>
                        <p className="text-sm text-emerald-700/80 mb-4">Contact our support team</p>
                        <button 
                            onClick={() => {
                                setSupportForm({
                                    name: currentUser?.displayName || '',
                                    email: currentUser?.email || '',
                                    subject: '',
                                    message: ''
                                });
                                setShowSupportModal(true);
                            }}
                            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 flex items-center justify-center space-x-2"
                        >
                            <MessageCircle size={16} />
                            <span>Get Support</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Support Modal */}
            {showSupportModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform animate-in slide-in-from-bottom-4 duration-300">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl flex items-center justify-center">
                                    <HelpCircle size={20} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Need Help?</h3>
                                    <p className="text-sm text-gray-600">Contact our support team</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowSupportModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6">
                            {/* Quick Contact Options */}
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <a
                                    href={`mailto:classiqcode@gmail.com?subject=${encodeURIComponent(`Support request from ${currentUser?.displayName || currentUser?.email || 'Highway Farm User'}`)}&body=${encodeURIComponent(`Sender: ${currentUser?.displayName || 'Highway Farm User'}\nEmail: ${currentUser?.email || 'Not provided'}\n\nPlease describe your issue here...`)}`}
                                    className="flex items-center space-x-3 p-3 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors group"
                                >
                                    <Mail size={18} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                                    <div>
                                        <p className="text-sm font-medium text-emerald-900">Email</p>
                                        <p className="text-xs text-emerald-600">Quick response</p>
                                    </div>
                                </a>
                                <a
                                    href="tel:+233543622590"
                                    className="flex items-center space-x-3 p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors group"
                                >
                                    <Phone size={18} className="text-blue-600 group-hover:scale-110 transition-transform" />
                                    <div>
                                        <p className="text-sm font-medium text-blue-900">Call</p>
                                        <p className="text-xs text-blue-600">Immediate help</p>
                                    </div>
                                </a>
                            </div>

                            {/* Support Form */}
                            <div className="border-t border-gray-100 pt-6">
                                <h4 className="text-sm font-semibold text-gray-900 mb-4">Send us a message</h4>
                                <form onSubmit={handleSupportSubmit} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="text"
                                            placeholder="Your name"
                                            value={supportForm.name}
                                            onChange={(e) => handleInputChange('name', e.target.value)}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                            required
                                        />
                                        <input
                                            type="email"
                                            placeholder="Email address"
                                            value={supportForm.email}
                                            onChange={(e) => handleInputChange('email', e.target.value)}
                                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                            required
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Subject"
                                        value={supportForm.subject}
                                        onChange={(e) => handleInputChange('subject', e.target.value)}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                        required
                                    />
                                    <textarea
                                        placeholder="Describe your issue or question..."
                                        rows="4"
                                        value={supportForm.message}
                                        onChange={(e) => handleInputChange('message', e.target.value)}
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                                        required
                                    ></textarea>
                                    
                                    <div className="flex space-x-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowSupportModal(false)}
                                            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={sendingSupport}
                                            className={`flex-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-4 py-2.5 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2 shadow-md hover:shadow-lg ${sendingSupport ? 'opacity-60 cursor-not-allowed' : 'hover:from-emerald-600 hover:to-green-700'}`}
                                        >
                                            <Send size={16} />
                                            <span>{sendingSupport ? 'Sending...' : 'Send Message'}</span>
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;