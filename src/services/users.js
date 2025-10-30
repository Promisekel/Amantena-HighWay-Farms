import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  deleteUser as firebaseDeleteUser
} from 'firebase/auth';
import {
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';
import toast from 'react-hot-toast';

// Create a new user
export const createUser = async (userData) => {
  try {
    // Create user in Firebase Auth
    const { user } = await createUserWithEmailAndPassword(
      auth,
      userData.email,
      userData.temporaryPassword
    );

    // Update user profile
    await updateProfile(user, {
      displayName: userData.name,
      photoURL: userData.photoURL || null
    });

    // Send email verification
    await sendEmailVerification(user);

    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      displayName: userData.name,
      email: userData.email,
      role: userData.role || 'user',
      permissions: userData.permissions || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLogin: null,
      active: true,
      photoURL: userData.photoURL || null
    });

    // Log user creation in audit log
    await setDoc(doc(collection(db, 'audit-logs')), {
      action: 'user_created',
      targetUser: user.uid,
      performedBy: auth.currentUser?.uid || 'system',
      timestamp: serverTimestamp(),
      details: `New user created: ${userData.email}`
    });

    return { success: true, userId: user.uid };
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

// Delete a user
export const deleteUser = async (userId) => {
  try {
    // Delete from Firestore first
    await deleteDoc(doc(db, 'users', userId));

    // Try to delete from Firebase Auth
    // This might fail if the user is not found in Auth
    try {
      const user = auth.currentUser;
      if (user && user.uid === userId) {
        await firebaseDeleteUser(user);
      }
    } catch (authError) {
      console.warn('User not found in Auth:', authError);
    }

    // Log deletion in audit log
    await setDoc(doc(collection(db, 'audit-logs')), {
      action: 'user_deleted',
      targetUser: userId,
      performedBy: auth.currentUser?.uid || 'system',
      timestamp: serverTimestamp(),
      details: `User deleted: ${userId}`
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

// Update user role and permissions
export const updateUserRole = async (userId, newRole, newPermissions = []) => {
  try {
    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      role: newRole,
      permissions: newPermissions,
      updatedAt: serverTimestamp()
    });

    // Log role update in audit log
    await setDoc(doc(collection(db, 'audit-logs')), {
      action: 'user_role_updated',
      targetUser: userId,
      performedBy: auth.currentUser?.uid || 'system',
      timestamp: serverTimestamp(),
      details: `User role updated to: ${newRole}`
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

// Get all users with optional filters
export const getUsers = async (filters = {}) => {
  try {
    let q = collection(db, 'users');
    
    // Apply filters
    if (filters.role) {
      q = query(q, where('role', '==', filters.role));
    }
    if (filters.active !== undefined) {
      q = query(q, where('active', '==', filters.active));
    }

    const snapshot = await getDocs(q);
    const users = [];
    
    snapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

// Check if user has required permissions
export const checkPermission = (user, requiredPermission) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'manager' && requiredPermission !== 'admin') return true;
  return user.permissions?.includes(requiredPermission) || false;
};

// Update user active status
export const updateUserStatus = async (userId, isActive) => {
  try {
    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      active: isActive,
      updatedAt: serverTimestamp()
    });

    // Log status update in audit log
    await setDoc(doc(collection(db, 'audit-logs')), {
      action: 'user_status_updated',
      targetUser: userId,
      performedBy: auth.currentUser?.uid || 'system',
      timestamp: serverTimestamp(),
      details: `User status updated to: ${isActive ? 'active' : 'inactive'}`
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  }
};

// Update user profile
export const updateUserProfile = async (userId, profileData) => {
  try {
    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      ...profileData,
      updatedAt: serverTimestamp()
    });

    // Update Firebase Auth profile if it's the current user
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === userId) {
      await updateProfile(currentUser, {
        displayName: profileData.displayName,
        photoURL: profileData.photoURL
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// Generate temporary password
export const generateTemporaryPassword = () => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// Track user activity
export const trackUserActivity = async (userId, action) => {
  try {
    await setDoc(doc(collection(db, 'user-activity')), {
      userId,
      action,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent,
      ipAddress: 'REDACTED' // Should be set by server
    });
  } catch (error) {
    console.error('Error tracking user activity:', error);
  }
};

// Get user permissions map
export const PERMISSIONS = {
  MANAGE_USERS: 'manage_users',
  MANAGE_INVENTORY: 'manage_inventory',
  MANAGE_SALES: 'manage_sales',
  VIEW_REPORTS: 'view_reports',
  MANAGE_SETTINGS: 'manage_settings',
  APPROVE_ORDERS: 'approve_orders',
  MANAGE_FINANCES: 'manage_finances'
};

// Get role permissions map
export const ROLE_PERMISSIONS = {
  admin: Object.values(PERMISSIONS),
  manager: [
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.MANAGE_SALES,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.APPROVE_ORDERS
  ],
  user: [
    PERMISSIONS.VIEW_REPORTS
  ]
};

// Get user session info
export const getUserSession = async (userId) => {
  try {
    const sessionsRef = collection(db, 'user-sessions');
    const q = query(sessionsRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    const sessions = [];
    snapshot.forEach((doc) => {
      sessions.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return sessions;
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    throw error;
  }
};