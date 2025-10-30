import React, { useState, useRef, useEffect } from 'react';
import { Menu, X, Bell, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const Header = ({ user, onMenuToggle, sidebarOpen }) => {
    const { signOut } = useAuth();
    const [showDropdown, setShowDropdown] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [appName, setAppName] = useState('Amantena Highway Farms');
    const [appDescription, setAppDescription] = useState('Inventory Management System');
    const dropdownRef = useRef(null);
    const notificationRef = useRef(null);

    // Fetch app settings
    useEffect(() => {
        const fetchAppSettings = async () => {
            try {
                const settingsDoc = await getDoc(doc(db, 'settings', 'app-settings'));
                if (settingsDoc.exists()) {
                    const settings = settingsDoc.data();
                    setAppName(settings.appName || settings.farmName || 'Amantena Highway Farms');
                    setAppDescription(settings.appDescription || settings.farmDescription || 'Inventory Management System');
                }
            } catch (error) {
                console.error('Error fetching app settings:', error);
            }
        };

        fetchAppSettings();

        // Listen for settings updates
        const handleSettingsUpdate = (event) => {
            const { appName: newName, appDescription: newDesc } = event.detail;
            if (newName) setAppName(newName);
            if (newDesc) setAppDescription(newDesc);
        };

        window.addEventListener('app-settings-updated', handleSettingsUpdate);
        return () => window.removeEventListener('app-settings-updated', handleSettingsUpdate);
    }, []);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSignOut = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const notifications = [
        { id: 1, message: "Low stock alert: Tomatoes", time: "2 min ago", type: "warning" },
        { id: 2, message: "New harvest recorded", time: "1 hour ago", type: "success" },
        { id: 3, message: "Equipment maintenance due", time: "3 hours ago", type: "info" },
    ];

    return (
        <header className="bg-gradient-to-r from-emerald-50 via-white to-green-50 backdrop-blur-sm border-b border-emerald-200/30 sticky top-0 z-40 shadow-sm">
            {/* Subtle top accent line */}
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500"></div>
            
            <div className="flex items-center justify-between px-6 py-4">
                {/* Left Section */}
                <div className="flex items-center space-x-4">
                    <button 
                        onClick={onMenuToggle}
                        className="lg:hidden p-2.5 rounded-xl hover:bg-emerald-100/70 transition-all duration-300 hover:shadow-md group"
                    >
                        <div className="transform transition-transform duration-300 group-hover:scale-110">
                            {sidebarOpen ? (
                                <X size={22} className="text-emerald-700" />
                            ) : (
                                <Menu size={22} className="text-emerald-700" />
                            )}
                        </div>
                    </button>
                    
                    <div className="flex items-center space-x-3">
                        {/* Logo/Icon */}
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                            <div className="w-6 h-6 bg-white rounded-md opacity-90 flex items-center justify-center">
                                <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                            </div>
                        </div>
                        
                        <div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-700 via-green-600 to-teal-600 bg-clip-text text-transparent">
                                {appName}
                            </h1>
                            <p className="text-emerald-600/70 text-sm font-medium">
                                {appDescription}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Section */}
                <div className="flex items-center space-x-3">
                    {/* Notifications */}
                    <div className="relative" ref={notificationRef}>
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className="relative p-2.5 rounded-xl hover:bg-emerald-100/70 transition-all duration-300 hover:shadow-md group"
                        >
                            <Bell className="h-5 w-5 text-emerald-700 group-hover:text-emerald-800 transition-colors" />
                            {notifications.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold animate-pulse">
                                    {notifications.length}
                                </span>
                            )}
                        </button>

                        {/* Notifications Dropdown */}
                        {showNotifications && (
                            <div className="absolute right-0 mt-3 w-80 bg-white/95 backdrop-blur-lg rounded-2xl shadow-xl py-2 z-50 border border-emerald-200/50 animate-in slide-in-from-top-2 duration-200">
                                <div className="px-4 py-3 border-b border-emerald-100">
                                    <h3 className="text-sm font-semibold text-emerald-900">Notifications</h3>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    {notifications.map((notification) => (
                                        <div key={notification.id} className="px-4 py-3 hover:bg-emerald-50/70 transition-colors cursor-pointer border-b border-emerald-50 last:border-b-0">
                                            <div className="flex items-start space-x-3">
                                                <div className={`w-2 h-2 rounded-full mt-2 ${
                                                    notification.type === 'warning' ? 'bg-amber-400' :
                                                    notification.type === 'success' ? 'bg-emerald-400' : 'bg-blue-400'
                                                }`}></div>
                                                <div className="flex-1">
                                                    <p className="text-sm text-gray-800">{notification.message}</p>
                                                    <p className="text-xs text-emerald-600 mt-1">{notification.time}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* User Profile */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setShowDropdown(!showDropdown)}
                            className="flex items-center space-x-3 p-2 rounded-xl hover:bg-emerald-100/70 transition-all duration-300 hover:shadow-md group"
                        >
                            <div className="relative">
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center text-white font-semibold shadow-lg ring-2 ring-white">
                                    {user?.name?.charAt(0) || 'A'}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white"></div>
                            </div>
                            
                            <div className="hidden md:block text-left">
                                <p className="font-semibold text-emerald-900 text-sm">
                                    {user?.name || 'Administrator'}
                                </p>
                                <p className="text-xs text-emerald-600/70">
                                    {user?.role || 'Admin'}
                                </p>
                            </div>
                            
                            <ChevronDown 
                                className={`h-4 w-4 text-emerald-600 transition-transform duration-200 ${
                                    showDropdown ? 'rotate-180' : ''
                                }`} 
                            />
                        </button>

                        {/* User Dropdown */}
                        {showDropdown && (
                            <div className="absolute right-0 mt-3 w-56 bg-white/95 backdrop-blur-lg rounded-2xl shadow-xl py-2 z-50 border border-emerald-200/50 animate-in slide-in-from-top-2 duration-200">
                                <div className="px-4 py-3 border-b border-emerald-100">
                                    <p className="text-sm font-semibold text-emerald-900">
                                        {user?.name || 'Administrator'}
                                    </p>
                                    <p className="text-xs text-emerald-600/70 mt-1">
                                        {user?.email || 'admin@amantena.com'}
                                    </p>
                                </div>
                                
                                <div className="py-1">
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full flex items-center px-4 py-2.5 text-sm text-red-600 hover:bg-red-50/70 transition-colors"
                                    >
                                        <LogOut className="mr-3 h-4 w-4" />
                                        Sign out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
