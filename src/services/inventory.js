import { 
  doc, 
  updateDoc, 
  increment, 
  addDoc, 
  collection, 
  getDoc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Records multiple sales and automatically updates inventory using batch operations
 * Ensures data consistency across all operations
 */
export const recordBatchSalesWithInventoryUpdate = async (salesItems, salesperson) => {
  try {
    console.log('Starting batch sales recording:', { salesItems, salesperson });
    
    const batch = writeBatch(db);
    const timestamp = serverTimestamp();
    const results = [];

    // Validate all items first
    for (const item of salesItems) {
      const { productName, customer, quantity, price } = item;
      
      if (!productName || !customer || !quantity || !price) {
        throw new Error('Missing required fields in sales item');
      }

      // Get product by name
      const productsRef = collection(db, 'products');
      const productQuery = query(productsRef, where('name', '==', productName));
      const productSnapshot = await getDocs(productQuery);
      
      if (productSnapshot.empty) {
        throw new Error(`Product "${productName}" not found`);
      }
      
      const productDoc = productSnapshot.docs[0];
      const productData = productDoc.data();
      const currentStock = productData.stockQuantity || 0;
      
      if (currentStock < quantity) {
        throw new Error(`Insufficient stock for ${productName}. Available: ${currentStock}, Requested: ${quantity}`);
      }
    }

    // Process all sales items
    for (const item of salesItems) {
      const { productName, customer, quantity, price } = item;
      
      // Get product data again for batch operations
      const productsRef = collection(db, 'products');
      const productQuery = query(productsRef, where('name', '==', productName));
      const productSnapshot = await getDocs(productQuery);
      const productDoc = productSnapshot.docs[0];
      const productData = productDoc.data();
      const currentStock = productData.stockQuantity || 0;
      
      const productRef = doc(db, 'products', productDoc.id);
      const newStockLevel = currentStock - quantity;
      const totalAmount = quantity * price;

      // Update product stock in batch
      batch.update(productRef, {
        stockQuantity: newStockLevel,
        currentStock: newStockLevel, // Keep both for compatibility
        lastUpdated: timestamp,
        stockTrend: ((newStockLevel - currentStock) / currentStock) * 100
      });

      // Create sale record in batch
      const salesRef = collection(db, 'sales');
      const saleRef = doc(salesRef);
      
      batch.set(saleRef, {
        productId: productDoc.id,
        productName,
        product: productName, // Keep for compatibility
        customer,
        quantity,
        price,
        total: totalAmount,
        salesperson,
        timestamp,
        previousStock: currentStock,
        newStock: newStockLevel,
        status: 'completed',
        createdAt: timestamp
      });

      results.push({
        saleId: saleRef.id,
        productId: productDoc.id,
        productName,
        newStockLevel,
        totalAmount,
        previousStock: currentStock
      });
    }

    // Commit all changes atomically
    await batch.commit();
    console.log('Batch sales recorded successfully:', results);
    
    return {
      success: true,
      salesRecorded: results.length,
      totalAmount: results.reduce((sum, r) => sum + r.totalAmount, 0),
      results
    };
    
  } catch (error) {
    console.error('Error recording batch sales:', error);
    throw new Error(`Sales recording failed: ${error.message}`);
  }
};

/**
 * Updates inventory stock level for a single product
 */
export const updateInventoryStock = async (productId, newStockLevel, reason = 'manual_adjustment') => {
  try {
    const productRef = doc(db, 'products', productId);
    const productDoc = await getDoc(productRef);
    
    if (!productDoc.exists()) {
      throw new Error('Product not found');
    }
    
    const currentData = productDoc.data();
    const previousStock = currentData.stockQuantity || 0;
    const stockChange = newStockLevel - previousStock;
    const stockTrend = previousStock > 0 ? (stockChange / previousStock) * 100 : 0;
    
    await updateDoc(productRef, {
      stockQuantity: newStockLevel,
      currentStock: newStockLevel, // Keep both for compatibility
      lastUpdated: serverTimestamp(),
      stockTrend
    });
    
    // Record stock movement
    await addStockMovement({
      productId,
      productName: currentData.name,
      type: stockChange >= 0 ? 'restock' : 'adjustment',
      quantity: Math.abs(stockChange),
      previousStock,
      newStock: newStockLevel,
      reason,
      timestamp: serverTimestamp()
    });
    
    console.log(`Inventory updated for ${currentData.name}: ${previousStock} → ${newStockLevel}`);
    return {
      success: true,
      previousStock,
      newStock: newStockLevel,
      stockChange,
      stockTrend
    };
    
  } catch (error) {
    console.error('Error updating inventory:', error);
    throw error;
  }
};

/**
 * Add stock to inventory (for restocking)
 */
export const addToInventoryStock = async (productId, quantityToAdd, reason = 'restock') => {
  try {
    const productRef = doc(db, 'products', productId);
    const productDoc = await getDoc(productRef);
    
    if (!productDoc.exists()) {
      throw new Error('Product not found');
    }
    
    const currentData = productDoc.data();
    const previousStock = currentData.stockQuantity || 0;
    const newStock = previousStock + quantityToAdd;
    const stockTrend = previousStock > 0 ? (quantityToAdd / previousStock) * 100 : 100;
    
    await updateDoc(productRef, {
      stockQuantity: increment(quantityToAdd),
      currentStock: increment(quantityToAdd), // Keep both for compatibility
      lastUpdated: serverTimestamp(),
      stockTrend
    });
    
    // Record stock movement
    await addStockMovement({
      productId,
      productName: currentData.name,
      type: 'restock',
      quantity: quantityToAdd,
      previousStock,
      newStock,
      reason,
      timestamp: serverTimestamp()
    });
    
    console.log(`Stock added to ${currentData.name}: +${quantityToAdd} (${previousStock} → ${newStock})`);
    return {
      success: true,
      previousStock,
      newStock,
      quantityAdded: quantityToAdd
    };
    
  } catch (error) {
    console.error('Error adding stock:', error);
    throw error;
  }
};

/**
 * Record stock movement for tracking purposes
 */
export const addStockMovement = async (movementData) => {
  try {
    const movementRef = await addDoc(collection(db, 'stockMovements'), {
      ...movementData,
      createdAt: serverTimestamp()
    });
    
    return movementRef.id;
    
  } catch (error) {
    console.error('Error recording stock movement:', error);
    throw error;
  }
};

/**
 * Get low stock products
 */
export const getLowStockProducts = async () => {
  try {
    const productsRef = collection(db, 'products');
    const productsSnapshot = await getDocs(productsRef);
    
    const lowStockProducts = [];
    
    productsSnapshot.forEach(doc => {
      const data = doc.data();
      const stockQuantity = data.stockQuantity || 0;
      const minStock = data.minStock || 0;
      
      if (stockQuantity <= minStock) {
        lowStockProducts.push({
          id: doc.id,
          ...data,
          stockQuantity,
          minStock
        });
      }
    });
    
    return lowStockProducts;
    
  } catch (error) {
    console.error('Error getting low stock products:', error);
    throw error;
  }
};

/**
 * Calculate inventory statistics
 */
export const calculateInventoryStats = async () => {
  try {
    const productsRef = collection(db, 'products');
    const productsSnapshot = await getDocs(productsRef);
    
    let totalProducts = 0;
    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    
    productsSnapshot.forEach(doc => {
      const data = doc.data();
      const stockQuantity = data.stockQuantity || 0;
      const price = data.price || 0;
      const minStock = data.minStock || 0;
      
      totalProducts++;
      totalValue += (price * stockQuantity);
      
      if (stockQuantity === 0) {
        outOfStockCount++;
      } else if (stockQuantity <= minStock) {
        lowStockCount++;
      }
    });
    
    return {
      totalProducts,
      totalValue,
      lowStockCount,
      outOfStockCount,
      averageValue: totalProducts > 0 ? totalValue / totalProducts : 0
    };
    
  } catch (error) {
    console.error('Error calculating inventory stats:', error);
    throw error;
  }
};

/**
 * Bulk update stock levels (for mass inventory updates)
 */
export const bulkUpdateStock = async (updates) => {
  try {
    const batch = writeBatch(db);
    const timestamp = serverTimestamp();
    
    for (const update of updates) {
  const { productId, newStockLevel } = update;
      const productRef = doc(db, 'products', productId);
      
      // Get current data for stock trend calculation
      const productDoc = await getDoc(productRef);
      if (productDoc.exists()) {
        const currentData = productDoc.data();
        const previousStock = currentData.stockQuantity || 0;
        const stockTrend = previousStock > 0 ? ((newStockLevel - previousStock) / previousStock) * 100 : 0;
        
        batch.update(productRef, {
          stockQuantity: newStockLevel,
          currentStock: newStockLevel,
          lastUpdated: timestamp,
          stockTrend
        });
      }
    }
    
    await batch.commit();
    console.log(`Bulk updated ${updates.length} products`);
    
    return { success: true, updatedCount: updates.length };
    
  } catch (error) {
    console.error('Error bulk updating stock:', error);
    throw error;
  }
};