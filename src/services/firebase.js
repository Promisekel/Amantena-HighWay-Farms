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
      const mergedAuthorized = Array.from(new Set([
        ...authorizedEmails.map(email => email?.trim()).filter(Boolean),
        ...DEFAULT_AUTHORIZED_EMAILS
      ]));
      if (mergedAuthorized.length !== authorizedEmails.length) {
        await setDoc(settingsRef, { authorizedEmails: mergedAuthorized }, { merge: true });
      }
      // Convert both the user's email and authorized emails to lowercase for comparison
      const normalizedUserEmail = user.email.toLowerCase();
      const normalizedAuthorizedEmails = mergedAuthorized.map(email => email.toLowerCase());
      
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
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
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
export const checkUserRole = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // If user document doesn't exist, create it with admin role
      await setDoc(userRef, {
        uid,
        role: 'admin',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
      return 'admin';
    }
    
    return userDoc.data().role || 'admin';
  } catch (error) {
    console.error('Error checking user role:', error);
    return 'admin'; // Default to admin role on error
  }
};
