import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertCircle,
  BarChart3,
  Calendar,
  Check,
  Cloud,
  Clock,
  CreditCard,
  Database,
  Download,
  Globe,
  HardDrive,
  Lock,
  Mail,
  MapPin,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  Shield,
  Sun,
  Trash2,
  TrendingUp,
  Upload,
  User
} from 'lucide-react';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { 
  sendPasswordResetEmail,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, db } from '../../services/firebase';
import { logOut } from '../../services/firebase';
import toast from 'react-hot-toast';

const Settings = () => {
  // Initialize all state variables at the top
  const [settings, setSettings] = useState({
    // App Settings
    appName: 'Amantena Highway Farms',
    appDescription: 'Inventory Management System',
    // General Settings
    farmName: 'Amantena Highway Farms',
    farmDescription: 'Premium agricultural products from Ghana',
    lowStockThreshold: 20,
    dateFormat: 'MM/dd/yyyy',
    authorizedEmails: ['admin@amantena.com'],
    // Security Settings
    autoLogout: 30, // Default 30 minutes
    // Other settings
    autoBackup: true,
    exportFormat: 'csv',
    auditLog: true
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('data');
  const [currentUser, setCurrentUser] = useState({ email: 'admin@amantena.com', uid: '123' });
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Toast utility function
  const showToast = (message, type = 'success') => {
    switch (type) {
      case 'success':
        toast.success(message);
        break;
      case 'error':
        toast.error(message);
        break;
      case 'info':
        toast.custom((t) => (
          <div className="bg-white rounded-lg shadow-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">{message}</p>
              </div>
            </div>
          </div>
        ));
        break;
      default:
        toast(message);
    }
  };

  // Function to convert data to CSV
  const convertToCSV = (items) => {
    const headers = ['Name', 'Category', 'Quantity', 'Price'];
    const rows = items.map(item => [
      item.name.replace(/,/g, ' '), 
      item.category.replace(/,/g, ' '), 
      item.quantity, 
      item.price
    ].join(','));
    return headers.join(',') + '\n' + rows.join('\n');
  };

  // Function to parse CSV
  const parseCSV = (text) => {
    const lines = text.split('\n');
    if (lines.length < 2) return []; // Need at least header and one data row
    
    const headers = lines[0].toLowerCase().split(',');
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',');
      const item = {};
      
      headers.forEach((header, index) => {
        const cleanHeader = header.trim();
        if (cleanHeader === 'quantity' || cleanHeader === 'price') {
          item[cleanHeader] = parseFloat(values[index]) || 0;
        } else {
          item[cleanHeader] = values[index]?.trim() || '';
        }
      });
      
      if (item.name && item.category) {
        result.push(item);
      }
    }
    
    return result;
  };

  // Function to handle data export - exports both inventory and sales
  const handleExportData = async () => {
    console.log('=== EXPORT STARTED ===');
    try {
      setIsExporting(true);
      const loadingToast = toast.loading('Preparing data for export...');
      
      console.log('Fetching data from Firestore...');
      
      // Fetch both inventory and sales data
      const inventoryRef = collection(db, 'inventory');
      const salesRef = collection(db, 'sales');
      
      console.log('Collections created, fetching documents...');
      
      const [inventorySnapshot, salesSnapshot] = await Promise.all([
        getDocs(inventoryRef),
        getDocs(salesRef)
      ]);
      
      console.log('Documents fetched successfully');
      console.log('Inventory docs:', inventorySnapshot.size);
      console.log('Sales docs:', salesSnapshot.size);
      
      // Process inventory data
      const inventoryItems = [];
      inventorySnapshot.forEach(docSnap => {
        try {
          const data = docSnap.data();
          inventoryItems.push({
            id: docSnap.id,
            name: data.name || '',
            category: data.category || '',
            quantity: data.quantity || 0,
            price: data.price || 0,
            description: data.description || '',
            unit: data.unit || '',
            createdAt: data.createdAt ? (data.createdAt.toDate ? new Date(data.createdAt.toDate()).toLocaleDateString() : '') : ''
          });
        } catch (err) {
          console.error('Error processing inventory item:', docSnap.id, err);
        }
      });
      
      // Process sales data
      const salesItems = [];
      salesSnapshot.forEach(docSnap => {
        try {
          const data = docSnap.data();
          salesItems.push({
            id: docSnap.id,
            date: data.date ? (data.date.toDate ? new Date(data.date.toDate()).toLocaleDateString() : '') : '',
            customerName: data.customerName || '',
            productName: data.productName || '',
            quantity: data.quantity || 0,
            unitPrice: data.unitPrice || 0,
            totalAmount: data.totalAmount || 0,
            paymentMethod: data.paymentMethod || '',
            status: data.status || ''
          });
        } catch (err) {
          console.error('Error processing sales item:', docSnap.id, err);
        }
      });
      
      console.log(`Processed ${inventoryItems.length} inventory items and ${salesItems.length} sales records`);
      
      if (inventoryItems.length === 0 && salesItems.length === 0) {
        toast.dismiss(loadingToast);
        toast.error('No data to export');
        console.log('=== EXPORT FAILED: No data ===');
        return;
      }

      const dateStamp = new Date().toISOString().split('T')[0];
      let exportedFiles = 0;

      // Export inventory data
      if (inventoryItems.length > 0) {
        try {
          console.log('Creating inventory CSV...');
          const inventoryHeaders = ['ID', 'Name', 'Category', 'Quantity', 'Price', 'Unit', 'Description', 'Created At'];
          const inventoryRows = inventoryItems.map(item => [
            item.id,
            `"${(item.name || '').replace(/"/g, '""')}"`,
            `"${(item.category || '').replace(/"/g, '""')}"`,
            item.quantity,
            item.price,
            `"${(item.unit || '').replace(/"/g, '""')}"`,
            `"${(item.description || '').replace(/"/g, '""')}"`,
            item.createdAt
          ].join(','));
          const inventoryCsv = inventoryHeaders.join(',') + '\n' + inventoryRows.join('\n');
          
          console.log('CSV created, length:', inventoryCsv.length);
          
          const inventoryBlob = new Blob([inventoryCsv], { type: 'text/csv;charset=utf-8;' });
          const inventoryUrl = window.URL.createObjectURL(inventoryBlob);
          const inventoryLink = document.createElement('a');
          inventoryLink.href = inventoryUrl;
          inventoryLink.download = `inventory-${dateStamp}.csv`;
          document.body.appendChild(inventoryLink);
          console.log('Clicking download link for inventory...');
          inventoryLink.click();
          document.body.removeChild(inventoryLink);
          window.URL.revokeObjectURL(inventoryUrl);
          console.log('Inventory file download triggered');
          exportedFiles++;
        } catch (err) {
          console.error('Error exporting inventory:', err);
          toast.error('Failed to export inventory: ' + err.message);
        }
      }

      // Export sales data
      if (salesItems.length > 0) {
        try {
          console.log('Creating sales CSV...');
          const salesHeaders = ['ID', 'Date', 'Customer Name', 'Product Name', 'Quantity', 'Unit Price', 'Total Amount', 'Payment Method', 'Status'];
          const salesRows = salesItems.map(item => [
            item.id,
            item.date,
            `"${(item.customerName || '').replace(/"/g, '""')}"`,
            `"${(item.productName || '').replace(/"/g, '""')}"`,
            item.quantity,
            item.unitPrice,
            item.totalAmount,
            `"${(item.paymentMethod || '').replace(/"/g, '""')}"`,
            `"${(item.status || '').replace(/"/g, '""')}"`,
          ].join(','));
          const salesCsv = salesHeaders.join(',') + '\n' + salesRows.join('\n');
          
          console.log('CSV created, length:', salesCsv.length);
          
          const salesBlob = new Blob([salesCsv], { type: 'text/csv;charset=utf-8;' });
          const salesUrl = window.URL.createObjectURL(salesBlob);
          const salesLink = document.createElement('a');
          salesLink.href = salesUrl;
          salesLink.download = `sales-${dateStamp}.csv`;
          document.body.appendChild(salesLink);
          console.log('Clicking download link for sales...');
          salesLink.click();
          document.body.removeChild(salesLink);
          window.URL.revokeObjectURL(salesUrl);
          console.log('Sales file download triggered');
          exportedFiles++;
        } catch (err) {
          console.error('Error exporting sales:', err);
          toast.error('Failed to export sales: ' + err.message);
        }
      }
      
      toast.dismiss(loadingToast);
      toast.success(`Successfully exported ${exportedFiles} file(s): ${inventoryItems.length} inventory items and ${salesItems.length} sales records`);
      console.log('=== EXPORT COMPLETED SUCCESSFULLY ===');
    } catch (error) {
      console.error('=== EXPORT FAILED ===');
      console.error('Error details:', error);
      console.error('Error stack:', error.stack);
      toast.error('Export failed: ' + error.message);
    } finally {
      setIsExporting(false);
      console.log('Export state reset');
    }
  };

  // Function to handle data import
  const handleImportData = async (event) => {
    console.log('Starting import process...');
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    let loadingToast;
    try {
      setIsImporting(true);
      loadingToast = toast.loading('Reading file...');

      const text = await file.text();
      console.log('File contents loaded');

      const items = parseCSV(text);
      console.log(`Parsed ${items.length} items from CSV`);

      if (items.length === 0) {
        toast.dismiss(loadingToast);
        toast.error('No valid data found in CSV');
        return;
      }

      // Save to Firestore
      console.log('Saving to Firestore...');
      const batch = writeBatch(db);

      items.forEach(item => {
        const ref = doc(collection(db, 'inventory'));
        batch.set(ref, {
          ...item,
          quantity: Number(item.quantity) || 0,
          price: Number(item.price) || 0,
          createdAt: serverTimestamp(),
          createdBy: currentUser?.uid
        });
      });

      await batch.commit();
      console.log('Data saved successfully');
      toast.dismiss(loadingToast);
      toast.success(`Imported ${items.length} items`);
    } catch (error) {
      console.error('Import failed:', error);
      toast.dismiss(loadingToast);
      toast.error('Import failed: ' + error.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Auto logout timer
  useEffect(() => {
    if (!settings?.autoLogout || !currentUser) return;

    const checkActivity = () => {
      const now = Date.now();
      const inactiveTime = now - lastActivity;
      const timeoutMinutes = settings.autoLogout;
      
      if (inactiveTime >= timeoutMinutes * 60 * 1000) {
        logOut();
        toast.error('You have been logged out due to inactivity');
      }
    };

    const resetTimer = () => setLastActivity(Date.now());
    const interval = setInterval(checkActivity, 60000); // Check every minute

    // Reset timer on user activity
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keypress', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keypress', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, [settings?.autoLogout, currentUser, lastActivity, logOut]);

  const handleAddEmail = async () => {
    if (!newEmail) {
      setEmailError('Please enter an email address');
      return;
    }
    if (!newEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    // Convert to lowercase for case-insensitive comparison
    const normalizedNewEmail = newEmail.toLowerCase();
    const normalizedExistingEmails = settings.authorizedEmails.map(email => email.toLowerCase());
    
    if (normalizedExistingEmails.includes(normalizedNewEmail)) {
      setEmailError('This email is already authorized');
      return;
    }
    setEmailError('');
    
    try {
      const updatedEmails = [...settings.authorizedEmails, normalizedNewEmail];
      
      // Save to database first
      const settingsRef = doc(db, 'settings', 'app-settings');
      await setDoc(settingsRef, {
        ...settings,
        authorizedEmails: updatedEmails,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || 'system'
      }, { merge: true });
      
      // Reload settings to ensure we have the latest data
      await loadSettingsAndUsers();
      
      setNewEmail('');
      toast.success('Email added successfully!');
    } catch (error) {
      console.error('Error adding email:', error);
      toast.error('Failed to add email');
    }
  };

  const handleRemoveEmail = async (emailToRemove) => {
    try {
      // Don't allow removing the last email
      if (settings.authorizedEmails.length <= 1) {
        toast.error('Cannot remove the last authorized email');
        return;
      }
      
      // Show warning when trying to remove your own email
      if (emailToRemove === currentUser?.email) {
        toast((t) => (
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-800">Cannot Remove Own Email</p>
              <p className="text-sm text-amber-700 mt-1">
                You cannot remove your own email while logged in. This is for security reasons.
              </p>
            </div>
          </div>
        ), { 
          duration: 5000,
          style: {
            background: '#FEF3C7',
            border: '1px solid #FCD34D',
            borderRadius: '0.5rem',
            padding: '1rem'
          }
        });
        return;
      }

      const updatedEmails = settings.authorizedEmails.filter(email => email !== emailToRemove);
      
      // Save to database first
      const settingsRef = doc(db, 'settings', 'app-settings');
      await updateDoc(settingsRef, {
        authorizedEmails: updatedEmails,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || 'system'
      });
      
      // Update local state after successful save
      setSettings(prev => ({
        ...prev,
        authorizedEmails: updatedEmails
      }));
      
      toast.success('Email removed successfully!');
    } catch (error) {
      console.error('Error removing email:', error);
      toast.error('Failed to remove email');
    }
  };
  // Check if email is authorized
  const checkEmailAuthorization = (email, authorizedEmails) => {
    if (!email || !authorizedEmails || authorizedEmails.length === 0) return false;
    return authorizedEmails.map(e => e.toLowerCase()).includes(email.toLowerCase());
  };

  // Effect to load settings and monitor auth state
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Get farm info
        const farmDoc = await getDoc(doc(db, 'farm', 'info'));
        if (farmDoc.exists()) {
          const farmData = farmDoc.data();
          setSettings(prev => ({
            ...prev,
            farmName: farmData.name,
            farmDescription: farmData.description
          }));
        }

        await loadSettingsAndUsers();
        
        // Check email authorization
        if (currentUser?.email) {
          const isAuthorized = checkEmailAuthorization(currentUser.email, settings.authorizedEmails);
          if (!isAuthorized) {
            toast.error('Warning: Your email is not authorized. Contact an administrator for access.', {
              duration: 10000, // Show for 10 seconds
              style: {
                border: '1px solid #991B1B',
                background: '#FEE2E2',
                padding: '16px',
                color: '#991B1B',
              },
            });
          }
        }
      } catch (error) {
        console.error('Error loading farm info:', error);
        toast.error('Failed to load farm information');
      } finally {
        setLoading(false);
      }
    };

    // Set up real-time listener for settings changes
    const settingsUnsubscribe = onSnapshot(doc(db, 'settings', 'app-settings'), (doc) => {
      if (doc.exists()) {
        const firestoreSettings = doc.data();
        const authorizedEmails = Array.from(new Set(
          Array.isArray(firestoreSettings.authorizedEmails) 
            ? firestoreSettings.authorizedEmails 
            : []
        )).filter(email => email && email.trim());

        setSettings(prev => ({
          ...prev,
          ...firestoreSettings,
          authorizedEmails
        }));
      }
    });
    
    // Listen for auth changes
    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Check if the user's email is authorized
        if (settings.authorizedEmails && !checkEmailAuthorization(user.email, settings.authorizedEmails)) {
          toast.error('Warning: Your email is not authorized. Contact an administrator for access.', {
            duration: 10000, // Show for 10 seconds
            style: {
              border: '1px solid #991B1B',
              background: '#FEE2E2',
              padding: '16px',
              color: '#991B1B',
            },
            icon: '⚠️',
          });
        }
        loadData(); // Reload settings when user auth state changes
      }
    });

    loadData(); // Initial load
    
    return () => {
      authUnsubscribe();
      settingsUnsubscribe();
    };
  }, []);

  const loadSettingsAndUsers = async () => {
    try {
      setLoading(true);
      
      // Load settings from Firestore
      const settingsDoc = await getDoc(doc(db, 'settings', 'app-settings'));
      if (settingsDoc.exists()) {
        const firestoreSettings = settingsDoc.data();
        // Ensure authorizedEmails is always an array and remove any duplicates
        const authorizedEmails = Array.from(new Set(
          Array.isArray(firestoreSettings.authorizedEmails) 
            ? firestoreSettings.authorizedEmails 
            : []
        )).filter(email => email && email.trim()); // Remove empty or whitespace-only emails
          
        const updatedSettings = {
          ...settings,
          ...firestoreSettings,
          authorizedEmails
        };
        
        setSettings(updatedSettings);
        localStorage.setItem('farmSettings', JSON.stringify(updatedSettings));

        // Check if current user's email is authorized
        if (currentUser?.email) {
          if (authorizedEmails.length === 0) {
            // If no emails are authorized, add current user's email
            const newSettings = {
              ...updatedSettings,
              authorizedEmails: [currentUser.email]
            };
            await setDoc(doc(db, 'settings', 'app-settings'), newSettings);
            setSettings(newSettings);
          } else if (!checkEmailAuthorization(currentUser.email, authorizedEmails)) {
            // Show warning for unauthorized users
            toast.error('Warning: Your email is not authorized. Contact an administrator for access.', {
              duration: 10000,
              style: {
                border: '1px solid #991B1B',
                background: '#FEE2E2',
                padding: '16px',
                color: '#991B1B',
              },
              icon: '⚠️',
            });
          }
        }
      } else {
        // Create default settings document with current user's email
        const defaultSettings = {
          ...settings,
          authorizedEmails: currentUser ? [currentUser.email] : [],
          autoLogout: 30 // Default 30 minutes
        };
        await setDoc(doc(db, 'settings', 'app-settings'), defaultSettings);
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };
  const saveSettings = async () => {
    try {
      setSaving(true);
      
      // Validate settings before saving
      if (settings.autoLogout < 1) {
        toast.error('Auto logout time must be at least 1 minute');
        return;
      }

      if (!Array.isArray(settings.authorizedEmails) || settings.authorizedEmails.length === 0) {
        if (currentUser) {
          settings.authorizedEmails = [currentUser.email];
        } else {
          toast.error('At least one authorized email is required');
          return;
        }
      }
      
      // Save to Firestore
      const settingsRef = doc(db, 'settings', 'app-settings');

      // Prepare the settings object
      const settingsToSave = {
        ...settings,
        appName: settings.appName || settings.farmName,
        appDescription: settings.appDescription || settings.farmDescription,
        farmName: settings.appName || settings.farmName,
        farmDescription: settings.appDescription || settings.farmDescription,
        autoLogout: Number(settings.autoLogout) || 30,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.uid || 'system'
      };

      // Update settings
      await setDoc(settingsRef, settingsToSave, { merge: true });

      // Dispatch event to update other components
      window.dispatchEvent(new CustomEvent('app-settings-updated', {
        detail: {
          appName: settingsToSave.appName,
          appDescription: settingsToSave.appDescription
        }
      }));

      // Save to localStorage as backup
      localStorage.setItem('farmSettings', JSON.stringify(settings));
      
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    try {
      // Fetch data from Firestore
      const salesRef = collection(db, 'sales');
      const inventoryRef = collection(db, 'inventory');
      
      const [salesSnapshot, inventorySnapshot] = await Promise.all([
        getDocs(salesRef),
        getDocs(inventoryRef)
      ]);

      // Convert to arrays
      const sales = salesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: new Date(doc.data().date?.toDate()).toLocaleDateString()
      }));

      const inventory = inventorySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Create CSV content
      const formatData = (data) => {
        if (settings.exportFormat === 'csv') {
          // Convert data to CSV
          const replacer = (key, value) => value === null ? '' : value;
          const header = Object.keys(data[0]);
          const csv = [
            header.join(','),
            ...data.map(row => header.map(fieldName => 
              JSON.stringify(row[fieldName], replacer)).join(','))
          ].join('\r\n');
          return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        } else {
          // For Excel, you'll need to implement XLSX conversion here
          // This is a placeholder - you should use a library like xlsx
          return new Blob([JSON.stringify(data)], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          });
        }
      };

      // Create multiple files
      const files = {
        sales: formatData(sales),
        inventory: formatData(inventory)
      };

      // Download each file
      for (const [type, blob] of Object.entries(files)) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `amantena-farms-${type}-${new Date().toISOString().split('T')[0]}.${settings.exportFormat}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
      toast.success('Data exported successfully!');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    }
  };

  const importData = async (file) => {
    try {
      const extension = file.name.split('.').pop().toLowerCase();
      
      if (extension !== 'csv' && extension !== 'xlsx' && extension !== 'xls') {
        toast.error('Please upload a valid Excel or CSV file');
        return;
      }

      // Read file content
      const text = await file.text();
      const rows = text.split('\n').map(row => row.split(','));
      const headers = rows[0];
      const data = rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header.trim()] = row[index]?.trim() || '';
        });
        return obj;
      });

      // Validate data structure
      if (!data.length) {
        toast.error('No data found in file');
        return;
      }

      // Determine data type from headers
      const isInventory = headers.includes('productName') || headers.includes('quantity');
      const isSales = headers.includes('saleDate') || headers.includes('totalAmount');

      // Import to appropriate collection
      const collectionName = isInventory ? 'inventory' : (isSales ? 'sales' : null);
      if (!collectionName) {
        toast.error('Unable to determine data type');
        return;
      }

      // Import data to Firestore
      const batch = writeBatch(db);
      const dbCollection = collection(db, collectionName);
      data.forEach((item) => {
        const docRef = doc(dbCollection);
        batch.set(docRef, item);
      });

      await batch.commit();

      // Log import action if audit logging is enabled
      if (settings.auditLog) {
        await addDoc(collection(db, 'audit-logs'), {
          action: 'data_imported',
          userId: currentUser?.uid || 'system',
          userEmail: currentUser?.email || 'system',
          timestamp: serverTimestamp(),
          details: `Imported ${data.length} records to ${collectionName}`
        });
      }

      toast.success(`${data.length} records imported successfully!`);
    } catch (error) {
      console.error('Error importing data:', error);
      toast.error('Failed to import data. Please check the file format.');
    }
  };

  // Return loading state UI
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 relative">
            <div className="w-20 h-20 border-4 border-emerald-200 rounded-full animate-spin"></div>
            <div className="w-16 h-16 border-4 border-emerald-500 rounded-full animate-spin absolute top-2 left-2 border-t-transparent"></div>
            <div className="w-12 h-12 border-4 border-blue-400 rounded-full animate-spin absolute top-4 left-4 border-t-transparent"></div>
          </div>
          <p className="text-gray-600 font-semibold mt-6 text-lg">Loading your settings...</p>
          <p className="text-gray-500 text-sm mt-2">Preparing your dashboard</p>
        </div>
      </div>
    );
  }

  // Navigation tabs configuration
  const navigationTabs = [
    { id: 'general', label: 'General', icon: SettingsIcon, color: 'emerald' },
    { id: 'security', label: 'Security', icon: Shield, color: 'red' },
    { id: 'data', label: 'Data & Backup', icon: Database, color: 'indigo' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-emerald-50 p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 space-y-4 lg:space-y-0">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
            Settings & Configuration
          </h1>
          <p className="text-gray-600 text-lg">Customize your farm management experience</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
          >
            {saving && (
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-emerald-700">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
              </div>
            )}
            {saving ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            <span className="font-semibold relative z-10">
              {saving ? 'Saving...' : 'Save All Settings'}
            </span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-8 bg-white p-3 rounded-2xl shadow-lg border border-gray-200">
        {navigationTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex items-center space-x-2 px-4 py-3 rounded-xl transition-all duration-300 font-medium ${
              activeSection === tab.id
                ? 'bg-emerald-100 text-emerald-700 shadow-md scale-105'
                : 'text-gray-600 hover:bg-gray-100 hover:scale-102'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content Sections */}
      <div className="space-y-8">
        {/* App Settings */}
        {activeSection === 'app' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
            <div className="border-b pb-6">
              <h3 className="text-xl font-semibold mb-4">Application Settings</h3>
              <div className="grid gap-6">
                {/* App Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Application Name
                  </label>
                  <input
                    type="text"
                    value={settings.appName || settings.farmName}
                    onChange={(e) => setSettings({
                      ...settings,
                      appName: e.target.value,
                      farmName: e.target.value // Keep farmName in sync
                    })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Enter application name"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    This name will appear throughout the application
                  </p>
                </div>

                {/* App Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Application Description
                  </label>
                  <textarea
                    value={settings.appDescription || settings.farmDescription}
                    onChange={(e) => setSettings({
                      ...settings,
                      appDescription: e.target.value,
                      farmDescription: e.target.value // Keep farmDescription in sync
                    })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Enter application description"
                    rows={3}
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Brief description of your application
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* General Settings */}
        {activeSection === 'general' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-500">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900">Farm Information</h3>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Application Name</label>
                  <input
                    type="text"
                    value={settings.appName || settings.farmName}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      appName: e.target.value,
                      farmName: e.target.value // Keep in sync
                    }))}
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Application Description</label>
                  <textarea
                    value={settings.appDescription || settings.farmDescription}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      appDescription: e.target.value,
                      farmDescription: e.target.value // Keep in sync
                    }))}
                    rows="3"
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Settings */}
        {activeSection === 'security' && (
          <div className="grid grid-cols-1 gap-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <div className="space-y-6">
                {/* Email Authorization */}
                <div className="bg-white rounded-xl border border-gray-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Authorized Email Access</h3>
                      <p className="text-sm text-gray-600 mt-1">Add email addresses that are allowed to access the system</p>
                    </div>
                  </div>
                  
                  {/* Add Email Form */}
                  <div className="flex gap-4 mt-4">
                    <div className="flex-1">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Enter email address"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                      {emailError && (
                        <p className="mt-1 text-sm text-red-500">{emailError}</p>
                      )}
                    </div>
                    <button
                      onClick={handleAddEmail}
                      className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>

                  {/* Authorized Emails List */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-gray-800">Authorized Emails</h4>
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-sm rounded-full">
                        {settings.authorizedEmails?.length || 0} Email(s)
                      </span>
                    </div>
                    
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <h5 className="font-medium text-gray-700">Email List</h5>
                          <span className="text-xs text-gray-500">Click email to copy</span>
                        </div>
                      </div>
                      
                      <div className="divide-y divide-gray-100">
                        {settings.authorizedEmails?.length > 0 ? (
                          settings.authorizedEmails.map((email, index) => (
                            <div 
                              key={index} 
                              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors duration-150"
                            >
                              <div className="flex items-center space-x-3 flex-1">
                                <Mail className={`w-5 h-5 ${email === currentUser?.email ? 'text-emerald-500' : 'text-gray-400'}`} />
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(email);
                                    toast.success('Email copied to clipboard');
                                  }}
                                  className="text-gray-700 hover:text-emerald-600 font-medium truncate"
                                >
                                  {email}
                                </button>
                                {email === currentUser?.email && (
                                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                                    Current User
                                  </span>
                                )}
                              </div>
                              {email !== currentUser?.email && (
                                <button
                                  onClick={() => handleRemoveEmail(email)}
                                  className="ml-2 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-150"
                                  title="Remove email"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center">
                            <Mail className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500">
                              No authorized emails added yet
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                              Add emails using the form above
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Security Notice */}
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-800">Security Notice</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        Only users with authorized email addresses will be able to log in to the system.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <div className="space-y-6">
                {/* Auto Logout Slider */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Auto Logout (minutes)</label>
                  <input
                    type="range"
                    min="5"
                    max="120"
                    value={settings.autoLogout}
                    onChange={(e) => setSettings(prev => ({ ...prev, autoLogout: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>5 min</span>
                    <span className="font-medium text-emerald-600">{settings.autoLogout} minutes</span>
                    <span>120 min</span>
                  </div>
                  <p className="text-xs text-gray-500">Automatically log out after period of inactivity</p>
                </div>

                {/* Session Management Notice */}
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <h4 className="font-medium text-red-800 mb-2">Active Session</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-red-700">Current Device</span>
                      <span className="text-red-600 font-medium">Active Now</span>
                    </div>
                    <p className="text-xs text-red-700">
                      For security reasons, you will be automatically logged out after {settings.autoLogout} minutes of inactivity.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Data & Backup Settings */}
        {activeSection === 'data' && (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <div className="space-y-6">
                {/* Export/Import Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Export Button */}
                  <button
                    onClick={handleExportData}
                    disabled={isExporting}
                    className="group p-6 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 hover:scale-105 hover:shadow-xl disabled:opacity-70 disabled:cursor-wait disabled:hover:scale-100"
                  >
                    <Download className={`h-8 w-8 mx-auto mb-3 ${isExporting ? 'animate-bounce' : 'group-hover:animate-bounce'}`} />
                    <h4 className="font-semibold mb-1">Export to CSV</h4>
                    <p className="text-xs opacity-90">
                      {isExporting ? 'Preparing export...' : 'Download inventory data as CSV file'}
                    </p>
                  </button>

                  {/* Import Button */}
                  <div className="relative">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        console.log('File selected:', e.target.files?.[0]?.name);
                        handleImportData(e);
                      }}
                      accept=".csv"
                      className="hidden"
                      disabled={isImporting}
                    />
                    <button
                      onClick={() => {
                        console.log('Import button clicked');
                        fileInputRef.current?.click();
                      }}
                      disabled={isImporting}
                      className="w-full group p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300 hover:scale-105 hover:shadow-xl disabled:opacity-70 disabled:cursor-wait disabled:hover:scale-100"
                    >
                      <Upload className={`h-8 w-8 mx-auto mb-3 ${isImporting ? 'animate-bounce' : 'group-hover:animate-bounce'}`} />
                      <h4 className="font-semibold mb-1">Import from CSV</h4>
                      <p className="text-xs opacity-90">
                        {isImporting ? 'Importing data...' : 'Import inventory data from CSV file'}
                      </p>
                    </button>
                  </div>
                </div>

                {/* Data Protection Notice */}
                <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-800">Data Protection</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        Your data is automatically backed up daily to ensure no loss of important information.
                        We recommend manually exporting backups before making major changes.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Backup Settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-emerald-300 transition-all duration-300 hover:shadow-md group">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 group-hover:text-emerald-700 transition-colors">Automatic Backups</p>
                      <p className="text-sm text-gray-500 mt-1">Create daily backups of your data</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input 
                        type="checkbox"
                        checked={settings.autoBackup}
                        onChange={(e) => setSettings(prev => ({ ...prev, autoBackup: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:bg-emerald-600 hover:scale-110 transition-transform"></div>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Export Format</label>
                    <select
                      value={settings.exportFormat}
                      onChange={(e) => setSettings(prev => ({ ...prev, exportFormat: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="csv">CSV (Spreadsheet)</option>
                      <option value="xlsx">Excel (XLSX)</option>
                    </select>
                  </div>
                </div>

                {/* Security Notice */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-800">Data Protection</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        Your data is automatically backed up daily to ensure no loss of important information.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
