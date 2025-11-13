// Firebase Configuration and Services
import toast from 'react-hot-toast';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs,
  getDoc,
  setDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';

const DEFAULT_AUTHORIZED_EMAILS = ['admin@amantena.com', 'promisebansah12@gmail.com'];

const normalizeEmailList = (emails = []) => {
  if (!Array.isArray(emails)) return [];
  return Array.from(new Set(
    emails
      .map(email => email?.trim().toLowerCase())
      .filter(Boolean)
  ));
};

const UNAUTHORIZED_ERROR = 'Unauthorized email address';
const UNAUTHORIZED_TOAST_MESSAGE = 'Access Denied: Your email is not authorized to access this application. Please contact the administrator.';
const unauthorizedToastOptions = {
  duration: 6000,
  style: {
    border: '1px solid #991B1B',
    padding: '16px',
    color: '#991B1B',
    background: '#FEE2E2'
  },
  icon: '⚠️'
};

const rememberLastAttemptedEmail = (email) => {
  if (typeof window !== 'undefined' && email) {
    window.localStorage.setItem('lastAttemptedEmail', email);
  }
};

const signOutUnauthorized = async (email, { showToast = true } = {}) => {
  rememberLastAttemptedEmail(email);
  try {
    await signOut(auth);
  } catch (signOutError) {
    console.error('Error signing out unauthorized user:', signOutError);
  }
  if (showToast) {
    toast.error(UNAUTHORIZED_TOAST_MESSAGE, unauthorizedToastOptions);
  }
  throw new Error(UNAUTHORIZED_ERROR);
};

const ensureAuthorizedUser = async (user, { allowBootstrap = false, showToast = true } = {}) => {
  const profile = extractUserProfile(user);
  const normalizedEmail = profile.email;

  if (!normalizedEmail) {
    await signOutUnauthorized(user?.email || null, { showToast });
  }

  const settingsRef = doc(db, 'settings', 'app-settings');
  let settingsSnapshot;

  try {
    settingsSnapshot = await getDoc(settingsRef);
  } catch (error) {
    if (error?.code === 'permission-denied') {
      console.warn('Permission denied while checking authorization:', error);
      await signOutUnauthorized(normalizedEmail, { showToast });
    }
    throw error;
  }

  let authorizedEmails = [];

  if (!settingsSnapshot.exists()) {
    if (allowBootstrap) {
      authorizedEmails = normalizeEmailList([
        ...DEFAULT_AUTHORIZED_EMAILS,
        normalizedEmail
      ]);
      await setDoc(settingsRef, {
        authorizedEmails,
        autoLogout: 30,
        createdAt: serverTimestamp(),
        createdBy: user.uid
      }, { merge: true });
    } else {
      await signOutUnauthorized(normalizedEmail, { showToast });
    }
  } else {
    const settingsData = settingsSnapshot.data() || {};
    authorizedEmails = normalizeEmailList(settingsData.authorizedEmails);

    if (authorizedEmails.length === 0) {
      const defaultEmails = normalizeEmailList(DEFAULT_AUTHORIZED_EMAILS);
      if (allowBootstrap) {
        const bootstrapEmails = normalizeEmailList([
          ...defaultEmails,
          normalizedEmail
        ]);
        await setDoc(settingsRef, { authorizedEmails: bootstrapEmails }, { merge: true });
        authorizedEmails = bootstrapEmails;
      } else {
        authorizedEmails = defaultEmails;
      }
    }

    if (!authorizedEmails.includes(normalizedEmail)) {
      await signOutUnauthorized(normalizedEmail, { showToast });
    }
  }

  return { profile, authorizedEmails };
};

const extractUserProfile = (user) => {
  if (!user) return {};

  const providerInfo = Array.isArray(user.providerData)
    ? user.providerData.find(info => info?.email || info?.displayName || info?.photoURL)
    : null;

  const resolvedEmail = (user.email || providerInfo?.email || '').trim().toLowerCase();
  const profile = {};

  if (resolvedEmail) {
    profile.email = resolvedEmail;
  }
  const displayName = user.displayName || providerInfo?.displayName;
  if (displayName) {
    profile.displayName = displayName;
  }
  const photoURL = user.photoURL || providerInfo?.photoURL;
  if (photoURL) {
    profile.photoURL = photoURL;
  }

  return profile;
};

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:
    process.env.REACT_APP_FIREBASE_STORAGE_BUCKET ||
    `${process.env.REACT_APP_FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Authentication functions
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const { user } = result;
    const { profile } = await ensureAuthorizedUser(user, { allowBootstrap: true, showToast: true });
    
    // Update or create user document in Firestore
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      ...profile,
      role: 'admin', // Default role
      lastLogin: serverTimestamp()
    }, { merge: true }); // Use merge to preserve existing data
    
    toast.success('Welcome back!');
    return user;
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
    toast.success('You have been logged out successfully');
  } catch (error) {
    console.error('Sign-out error:', error);
    toast.error('Error logging out. Please try again.');
    throw error;
  }
};

// Product-related Firestore functions
export const addProduct = async (productData) => {
  try {
    const stockQuantity = Number(productData.stockQuantity ?? productData.currentStock ?? 0) || 0;
    const price = Number(productData.price) || 0;
    const sanitizedData = {
      ...productData,
      price,
      stockQuantity,
      currentStock: stockQuantity,
      inventoryValue: price * Math.max(stockQuantity, 0),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'products'), {
      ...sanitizedData
    });

    // create initial stock history entry
    try {
      const initialQty = Number(sanitizedData.stockQuantity ?? sanitizedData.currentStock ?? 0);
      const historyRef = doc(collection(db, `products/${docRef.id}/stockHistory`));
      await setDoc(historyRef, {
        previousQty: 0,
        newQty: initialQty,
        delta: initialQty,
        reason: 'Initial stock',
        userId: productData.createdBy || 'system',
        userEmail: productData.createdByEmail || null,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to write initial stock history:', err);
    }

    return docRef.id;
  } catch (error) {
    console.error('Error adding product:', error);
    throw error;
  }
};

export const updateProduct = async (productId, productData) => {
  try {
    const productRef = doc(db, 'products', productId);
    const incomingStockValue = productData?.stockQuantity ?? productData?.currentStock;
    const hasStockUpdate = incomingStockValue !== undefined && !Number.isNaN(Number(incomingStockValue));
    const stockReason = productData?.stockReason;
    const priceOverride = productData?.price;

    const skipKeys = new Set([
      'stockQuantity',
      'currentStock',
      'inventoryValue',
      'lastUpdated',
      'updatedAt',
      'stockTrend',
      'stockReason',
      'newStock'
    ]);

    const updatePayload = {};
    Object.keys(productData || {}).forEach((key) => {
      if (!skipKeys.has(key) && productData[key] !== undefined) {
        updatePayload[key] = productData[key];
      }
    });

    const ensureRequiredFields = (existing = {}) => {
      const requiredFields = ['name', 'category', 'description', 'minStock', 'maxStock', 'unit', 'type'];
      requiredFields.forEach((field) => {
        if (updatePayload[field] === undefined && existing[field] !== undefined) {
          updatePayload[field] = existing[field];
        }
      });
    };

    if (hasStockUpdate) {
      const incomingStock = Number(incomingStockValue);

      await runTransaction(db, async (transaction) => {
        const prodSnap = await transaction.get(productRef);
        if (!prodSnap.exists()) throw new Error('Product not found');

        const existing = prodSnap.data() || {};
        ensureRequiredFields(existing);

        const previousQty = Number(existing.stockQuantity ?? existing.currentStock ?? 0) || 0;
        const newQty = Number.isFinite(incomingStock) ? incomingStock : previousQty;
        const price = priceOverride !== undefined ? (Number(priceOverride) || 0) : (Number(existing.price) || 0);
        const delta = newQty - previousQty;

        updatePayload.price = price;
        updatePayload.stockQuantity = newQty;
        updatePayload.currentStock = newQty;
        updatePayload.inventoryValue = price * Math.max(newQty, 0);

        transaction.update(productRef, {
          ...updatePayload,
          updatedAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        });

        const historyRef = doc(collection(db, `products/${productId}/stockHistory`));
        transaction.set(historyRef, {
          previousQty,
          newQty,
          delta,
          reason: stockReason || 'Manual update',
          userId: productData.updatedBy || 'system',
          userEmail: productData.updatedByEmail || null,
          timestamp: serverTimestamp()
        });
      });
    } else {
      const prodSnap = await getDoc(productRef);
      if (!prodSnap.exists()) throw new Error('Product not found');
      const existing = prodSnap.data() || {};
      ensureRequiredFields(existing);

      const price = priceOverride !== undefined ? (Number(priceOverride) || 0) : (Number(existing.price) || 0);
      const stockQty = Number(existing.stockQuantity ?? existing.currentStock ?? 0) || 0;

      updatePayload.price = price;
      updatePayload.inventoryValue = price * Math.max(stockQty, 0);

      await updateDoc(productRef, {
        ...updatePayload,
        updatedAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};

export const deleteProduct = async (productId) => {
  try {
    const productRef = doc(db, 'products', productId);
    const productSnapshot = await getDoc(productRef);

    if (!productSnapshot.exists()) {
      throw new Error('Product not found');
    }

    const batch = writeBatch(db);
    batch.delete(productRef);

    const historySnapshot = await getDocs(collection(db, `products/${productId}/stockHistory`));
    historySnapshot.forEach((historyDoc) => {
      batch.delete(historyDoc.ref);
    });

    const relatedSales = await getDocs(query(collection(db, 'sales'), where('productId', '==', productId)));
    relatedSales.forEach((saleDoc) => {
      batch.update(saleDoc.ref, {
        productId: null,
        productDeleted: true
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
};

export const getAllProducts = async () => {
  try {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data() || {};
      const stockQuantity = Number(data.stockQuantity ?? data.currentStock ?? data.quantity ?? 0) || 0;
      const price = Number(data.price) || 0;
      const inventoryValue = price * Math.max(stockQuantity, 0);
      const minStock = Number(data.minStock) || 0;
      const maxStock = Number(data.maxStock) || 0;
      const createdAtDate = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt;
      const updatedAtDate = data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt;

      return {
        id: docSnapshot.id,
        ...data,
        price,
        stockQuantity,
        currentStock: stockQuantity,
        inventoryValue,
        minStock,
        maxStock,
        createdAt: createdAtDate ? (createdAtDate.toISOString?.() || createdAtDate) : null,
        updatedAt: updatedAtDate ? (updatedAtDate.toISOString?.() || updatedAtDate) : null
      };
    });
  } catch (error) {
    console.error('Error getting products:', error);
    throw error;
  }
};

export const getProduct = async (productId) => {
  try {
    const productDoc = await getDoc(doc(db, 'products', productId));
    if (productDoc.exists()) {
      const data = productDoc.data() || {};
      const stockQuantity = Number(data.stockQuantity ?? data.currentStock ?? data.quantity ?? 0) || 0;
      const price = Number(data.price) || 0;
      const inventoryValue = price * Math.max(stockQuantity, 0);
      const createdAtDate = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt;
      const updatedAtDate = data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt;

      return {
        id: productDoc.id,
        ...data,
        price,
        stockQuantity,
        currentStock: stockQuantity,
        inventoryValue,
        createdAt: createdAtDate ? (createdAtDate.toISOString?.() || createdAtDate) : null,
        updatedAt: updatedAtDate ? (updatedAtDate.toISOString?.() || updatedAtDate) : null
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting product:', error);
    throw error;
  }
};

// Sales-related Firestore functions
export const addSale = async (saleData) => {
  try {
    const docRef = await addDoc(collection(db, 'sales'), {
      ...saleData,
      saleDate: serverTimestamp(),
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding sale:', error);
    throw error;
  }
};

export const getAllSales = async () => {
  try {
    const q = query(collection(db, 'sales'), orderBy('saleDate', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      saleDate: doc.data().saleDate?.toDate()?.toISOString(),
      createdAt: doc.data().createdAt?.toDate()?.toISOString()
    }));
  } catch (error) {
    console.error('Error getting sales:', error);
    throw error;
  }
};

// Stock movement tracking
export const addStockMovement = async (movementData) => {
  try {
    // Add movement log
    const movementRef = await addDoc(collection(db, 'stockMovements'), {
      ...movementData,
      date: serverTimestamp(),
      createdAt: serverTimestamp()
    });

    // Update product stock and write product-specific stock history in a transaction
    const productId = movementData.productId;
    const qty = Number(movementData.quantity) || 0;
    const type = (movementData.type || 'in').toLowerCase();

    if (productId) {
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'products', productId);
        const prodSnap = await transaction.get(productRef);
        if (!prodSnap.exists()) return;
        const existing = prodSnap.data();
        const previousQty = Number(existing.stockQuantity ?? existing.currentStock ?? 0);
        const newQty = type === 'in' ? previousQty + qty : Math.max(0, previousQty - qty);
        const delta = newQty - previousQty;
        const price = Number(existing.price) || 0;

        transaction.update(productRef, {
          stockQuantity: newQty,
          currentStock: newQty,
          inventoryValue: price * Math.max(newQty, 0),
          lastUpdated: serverTimestamp(),
          updatedAt: serverTimestamp(),
          stockTrend: (previousQty === 0) ? 0 : ((newQty - previousQty) / (previousQty || 1)) * 100
        });

        const historyRef = doc(collection(db, `products/${productId}/stockHistory`));
        transaction.set(historyRef, {
          previousQty,
          newQty,
          delta,
          reason: movementData.reason || (type === 'in' ? 'Stock in' : 'Stock out'),
          movementType: type,
          userId: movementData.userId || 'system',
          userEmail: movementData.userEmail || null,
          timestamp: serverTimestamp(),
          movementRef: movementRef.id
        });
      });
    }

    return movementRef.id;
  } catch (error) {
    console.error('Error adding stock movement:', error);
    throw error;
  }
};

// Image upload function for Firebase Storage
export const uploadProductImage = async (file, productId) => {
  try {
    if (!file) return null;
    
    const imageRef = ref(storage, `products/${productId}/${file.name}`);
    const snapshot = await uploadBytes(imageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

// Auth state observer
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Utility function to check if user is admin
export const checkUserRole = async (userOrUid) => {
  try {
    const uid = typeof userOrUid === 'string' ? userOrUid : userOrUid?.uid;
    if (!uid) {
      throw new Error('Unable to determine user id for role check');
    }

    const authUser = typeof userOrUid === 'string' ? null : userOrUid;
    let profile = {};

    if (authUser) {
      const result = await ensureAuthorizedUser(authUser, { allowBootstrap: false, showToast: true });
      profile = result.profile;
    }

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      // Back-fill essential fields if they are missing
      const existing = userDoc.data() || {};
      const updates = {};
      if (profile.email && existing.email !== profile.email) {
        updates.email = profile.email;
      }
      if (profile.displayName && existing.displayName !== profile.displayName) {
        updates.displayName = profile.displayName;
      }
      if (profile.photoURL && existing.photoURL !== profile.photoURL) {
        updates.photoURL = profile.photoURL;
      }
      if (Object.keys(updates).length > 0) {
        updates.lastLogin = serverTimestamp();
        await updateDoc(userRef, updates);
      }
      return existing.role || 'admin';
    }

    // No user record yet; defer creation until authorization succeeds
    return 'admin';
  } catch (error) {
    if (error?.message === UNAUTHORIZED_ERROR) {
      throw error;
    }
    console.error('Error checking user role:', error);
    return 'admin'; // Default to admin role on error
  }
};
