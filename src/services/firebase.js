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
  deleteDoc, 
  getDocs, 
  getDoc,
  setDoc,
  query,
  orderBy,
  where,
  serverTimestamp 
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

    if (typeof window !== 'undefined' && user?.email) {
      window.localStorage.setItem('lastAttemptedEmail', user.email);
    }
    const profile = extractUserProfile(user);
    
    // Check if email is authorized
    const settingsRef = doc(db, 'settings', 'app-settings');
    const settingsDoc = await getDoc(settingsRef);
    if (!settingsDoc.exists()) {
      // If settings don't exist, create them with the first user as authorized
      await setDoc(settingsRef, {
        authorizedEmails: Array.from(new Set([
          ...DEFAULT_AUTHORIZED_EMAILS,
          user.email.toLowerCase()
        ])),
        autoLogout: 30,
        createdAt: serverTimestamp(),
        createdBy: user.uid
      });
      toast.success('Welcome! You have been set as the first authorized user.');
    } else {
      const { authorizedEmails = [] } = settingsDoc.data();
      let normalizedAuthorizedEmails = normalizeEmailList(authorizedEmails);

      if (normalizedAuthorizedEmails.length === 0) {
        normalizedAuthorizedEmails = normalizeEmailList([
          ...DEFAULT_AUTHORIZED_EMAILS,
          user.email
        ]);
        if (normalizedAuthorizedEmails.length > 0) {
          await setDoc(settingsRef, { authorizedEmails: normalizedAuthorizedEmails }, { merge: true });
        }
      } else if (authorizedEmails.length !== normalizedAuthorizedEmails.length) {
        await setDoc(settingsRef, { authorizedEmails: normalizedAuthorizedEmails }, { merge: true });
      }
      // Convert both the user's email and authorized emails to lowercase for comparison
      const normalizedUserEmail = user.email.toLowerCase();
      if (!normalizedAuthorizedEmails.includes(normalizedUserEmail)) {
        await signOut(auth); // Sign out unauthorized user
        toast.error('Access Denied: Your email is not authorized to access this application. Please contact the administrator.');
        throw new Error('Unauthorized email address');
      }
    }
    
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
    if (!error.message.includes('Unauthorized email')) {
      toast.error('Login failed. Please try again.');
    }
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
    const docRef = await addDoc(collection(db, 'products'), {
      ...productData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding product:', error);
    throw error;
  }
};

export const updateProduct = async (productId, productData) => {
  try {
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      ...productData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};

export const deleteProduct = async (productId) => {
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
};

export const getAllProducts = async () => {
  try {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()?.toISOString(),
      updatedAt: doc.data().updatedAt?.toDate()?.toISOString()
    }));
  } catch (error) {
    console.error('Error getting products:', error);
    throw error;
  }
};

export const getProduct = async (productId) => {
  try {
    const productDoc = await getDoc(doc(db, 'products', productId));
    if (productDoc.exists()) {
      return {
        id: productDoc.id,
        ...productDoc.data(),
        createdAt: productDoc.data().createdAt?.toDate()?.toISOString(),
        updatedAt: productDoc.data().updatedAt?.toDate()?.toISOString()
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
    const docRef = await addDoc(collection(db, 'stockMovements'), {
      ...movementData,
      date: serverTimestamp(),
      createdAt: serverTimestamp()
    });
    return docRef.id;
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
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    const profile = extractUserProfile(authUser);
    
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
    console.error('Error checking user role:', error);
    return 'admin'; // Default to admin role on error
  }
};
