import { 
  collection,
  getDocs,
  query,
  where,
  writeBatch,
  doc,
  serverTimestamp,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';

// Export all data
export const exportData = async () => {
  try {
    const data = {
      settings: {},
      products: [],
      sales: [],
      users: [],
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    // Get settings
    const settingsDoc = await doc(db, 'settings', 'app-settings').get();
    data.settings = settingsDoc.data();

    // Get products
    const productsSnapshot = await getDocs(collection(db, 'products'));
    productsSnapshot.forEach(doc => {
      data.products.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Get sales
    const salesSnapshot = await getDocs(collection(db, 'sales'));
    salesSnapshot.forEach(doc => {
      data.sales.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // Get users (excluding sensitive data)
    const usersSnapshot = await getDocs(collection(db, 'users'));
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      delete userData.password;
      delete userData.authTokens;
      data.users.push({
        id: doc.id,
        ...userData
      });
    });

    // Convert to desired format
    let formattedData;
    switch (data.settings.exportFormat) {
      case 'csv':
        formattedData = convertToCSV(data);
        break;
      case 'xml':
        formattedData = convertToXML(data);
        break;
      default:
        formattedData = JSON.stringify(data, null, 2);
    }

    // Log export in audit trail
    await setDoc(doc(collection(db, 'audit-logs')), {
      action: 'data_exported',
      timestamp: serverTimestamp(),
      details: `Data exported in ${data.settings.exportFormat} format`
    });

    return formattedData;
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
};

// Import data
export const importData = async (data) => {
  try {
    const batch = writeBatch(db);

    // Validate data format
    if (!data.version || !data.settings || !data.products) {
      throw new Error('Invalid data format');
    }

    // Update settings
    batch.set(doc(db, 'settings', 'app-settings'), {
      ...data.settings,
      importedAt: serverTimestamp()
    }, { merge: true });

    // Import products
    for (const product of data.products) {
      const { id, ...productData } = product;
      batch.set(doc(db, 'products', id), {
        ...productData,
        importedAt: serverTimestamp()
      }, { merge: true });
    }

    // Import sales if present
    if (data.sales) {
      for (const sale of data.sales) {
        const { id, ...saleData } = sale;
        batch.set(doc(db, 'sales', id), {
          ...saleData,
          importedAt: serverTimestamp()
        }, { merge: true });
      }
    }

    // Import users if present (excluding sensitive data)
    if (data.users) {
      for (const user of data.users) {
        const { id, password, authTokens, ...userData } = user;
        batch.set(doc(db, 'users', id), {
          ...userData,
          importedAt: serverTimestamp()
        }, { merge: true });
      }
    }

    // Commit all changes
    await batch.commit();

    // Log import in audit trail
    await setDoc(doc(collection(db, 'audit-logs')), {
      action: 'data_imported',
      timestamp: serverTimestamp(),
      details: `Data imported from backup dated ${data.exportDate}`
    });

    return { success: true };
  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  }
};

// Backup data
export const createBackup = async () => {
  try {
    const data = await exportData();
    
    // Save backup to Firestore
    const backupRef = doc(collection(db, 'backups'));
    await setDoc(backupRef, {
      data,
      createdAt: serverTimestamp(),
      size: new Blob([data]).size,
      type: 'manual'
    });

    return { success: true, backupId: backupRef.id };
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
};

// Restore from backup
export const restoreBackup = async (backupId) => {
  try {
    const backupDoc = await doc(db, 'backups', backupId).get();
    if (!backupDoc.exists()) {
      throw new Error('Backup not found');
    }

    const backupData = backupDoc.data();
    await importData(JSON.parse(backupData.data));

    return { success: true };
  } catch (error) {
    console.error('Error restoring backup:', error);
    throw error;
  }
};

// Delete old backups
export const cleanupOldBackups = async (retentionDays) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const oldBackupsQuery = query(
      collection(db, 'backups'),
      where('createdAt', '<', cutoffDate)
    );

    const snapshot = await getDocs(oldBackupsQuery);
    const batch = writeBatch(db);

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return { success: true, deletedCount: snapshot.size };
  } catch (error) {
    console.error('Error cleaning up old backups:', error);
    throw error;
  }
};

// Format converters
const convertToCSV = (data) => {
  // Implement CSV conversion logic
  const sections = [];
  
  // Convert settings
  const settingsCSV = Object.entries(data.settings)
    .map(([key, value]) => `${key},${value}`)
    .join('\n');
  sections.push('SETTINGS\n' + settingsCSV);

  // Convert products
  const productHeaders = Object.keys(data.products[0] || {}).join(',');
  const productsCSV = data.products
    .map(product => Object.values(product).join(','))
    .join('\n');
  sections.push('PRODUCTS\n' + productHeaders + '\n' + productsCSV);

  // Convert sales
  if (data.sales.length) {
    const salesHeaders = Object.keys(data.sales[0] || {}).join(',');
    const salesCSV = data.sales
      .map(sale => Object.values(sale).join(','))
      .join('\n');
    sections.push('SALES\n' + salesHeaders + '\n' + salesCSV);
  }

  return sections.join('\n\n');
};

const convertToXML = (data) => {
  // Implement XML conversion logic
  const xml = ['<?xml version="1.0" encoding="UTF-8"?>'];
  xml.push('<export>');

  // Add settings
  xml.push('  <settings>');
  Object.entries(data.settings).forEach(([key, value]) => {
    xml.push(`    <${key}>${value}</${key}>`);
  });
  xml.push('  </settings>');

  // Add products
  xml.push('  <products>');
  data.products.forEach(product => {
    xml.push('    <product>');
    Object.entries(product).forEach(([key, value]) => {
      xml.push(`      <${key}>${value}</${key}>`);
    });
    xml.push('    </product>');
  });
  xml.push('  </products>');

  // Add sales
  xml.push('  <sales>');
  data.sales.forEach(sale => {
    xml.push('    <sale>');
    Object.entries(sale).forEach(([key, value]) => {
      xml.push(`      <${key}>${value}</${key}>`);
    });
    xml.push('    </sale>');
  });
  xml.push('  </sales>');

  xml.push('</export>');
  return xml.join('\n');
};

// Get backup metrics
export const getBackupMetrics = async () => {
  try {
    const backupsSnapshot = await getDocs(collection(db, 'backups'));
    const backups = [];
    let totalSize = 0;

    backupsSnapshot.forEach(doc => {
      const backup = doc.data();
      backups.push({
        id: doc.id,
        ...backup
      });
      totalSize += backup.size || 0;
    });

    return {
      totalBackups: backups.length,
      totalSize,
      lastBackup: backups.sort((a, b) => b.createdAt - a.createdAt)[0],
      backupsByType: backups.reduce((acc, backup) => {
        acc[backup.type] = (acc[backup.type] || 0) + 1;
        return acc;
      }, {})
    };
  } catch (error) {
    console.error('Error getting backup metrics:', error);
    throw error;
  }
};