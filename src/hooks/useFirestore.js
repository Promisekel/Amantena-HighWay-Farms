import { useState, useEffect } from 'react';
import {
  getAllProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getAllSales,
  addSale,
  uploadProductImage,
  addStockMovement
} from '../services/firebase';

export const useProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const productsData = await getAllProducts();
      setProducts(productsData);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const addNewProduct = async (productData, imageFile = null) => {
    try {
      // First add product to get ID
      const productId = await addProduct(productData);
      
      // Upload image if provided
      let imageUrl = productData.imageUrl || null;
      if (imageFile) {
        imageUrl = await uploadProductImage(imageFile, productId);
        // Update product with image URL
        await updateProduct(productId, { ...productData, imageUrl });
      }

      // Add stock movement for initial stock
      // initial stock already recorded by addProduct as initial stockHistory entry

      // Refresh products list
      await fetchProducts();
      return productId;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  const updateExistingProduct = async (productId, productData, imageFile = null) => {
    try {
      let imageUrl = productData.imageUrl;
      
      // Upload new image if provided
      if (imageFile) {
        imageUrl = await uploadProductImage(imageFile, productId);
      }

      await updateProduct(productId, { ...productData, imageUrl });
      
      // Refresh products list
      await fetchProducts();
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  const removeProduct = async (productId) => {
    try {
      await deleteProduct(productId);
      await fetchProducts();
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  return {
    products,
    loading,
    error,
    addNewProduct,
    updateExistingProduct,
    removeProduct,
    refreshProducts: fetchProducts
  };
};

export const useSales = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const salesData = await getAllSales();
      setSales(salesData);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching sales:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const addNewSale = async (saleData) => {
    try {
      // Add sale record
      const saleId = await addSale(saleData);

      // Add stock movement for sale
      await addStockMovement({
        productId: saleData.productId,
        productName: saleData.productName,
        type: 'out',
        quantity: saleData.quantity,
        reason: `Sale recorded${saleData.productName ? ` - ${saleData.productName}` : ''}`,
        userId: saleData.soldBy || 'system'
      });

      // addStockMovement updates the product stock and records history transactionally,
      // so no separate call to updateProduct is required here.

      await fetchSales();
      return saleId;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  return {
    sales,
    loading,
    error,
    addNewSale,
    refreshSales: fetchSales
  };
};
