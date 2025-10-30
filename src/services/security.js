import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator
} from 'firebase/auth';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

// Session management
let sessionTimeout;
let activityTimeout;
let lastActivity = Date.now();

// Initialize security features
export const initializeSecurity = (settings) => {
  // Set up activity monitoring
  document.addEventListener('mousemove', updateActivity);
  document.addEventListener('keypress', updateActivity);
  document.addEventListener('click', updateActivity);
  document.addEventListener('scroll', updateActivity);

  // Start session timer
  if (settings.autoLogout > 0) {
    startAutoLogoutTimer(settings.autoLogout);
  }
};

// Update last activity timestamp
const updateActivity = () => {
  lastActivity = Date.now();
  
  // Reset auto-logout timer
  if (sessionTimeout) {
    clearTimeout(sessionTimeout);
    startAutoLogoutTimer(settings.autoLogout);
  }
};

// Start auto-logout timer
export const startAutoLogoutTimer = (minutes) => {
  if (sessionTimeout) {
    clearTimeout(sessionTimeout);
  }

  sessionTimeout = setTimeout(() => {
    const inactiveTime = (Date.now() - lastActivity) / 1000 / 60;
    if (inactiveTime >= minutes) {
      handleAutoLogout();
    }
  }, minutes * 60 * 1000);
};

// Handle auto logout
const handleAutoLogout = async () => {
  try {
    // Log the auto-logout event
    await setDoc(doc(collection(db, 'audit-logs')), {
      action: 'auto_logout',
      userId: auth.currentUser?.uid,
      timestamp: serverTimestamp(),
      reason: 'inactivity_timeout'
    });

    // Sign out the user
    await auth.signOut();
    
    // Redirect to login page
    window.location.href = '/login';
  } catch (error) {
    console.error('Error during auto-logout:', error);
  }
};

// Set up 2FA
export const setupTwoFactorAuth = async (phoneNumber) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No user logged in');

    // Get multi-factor auth instance
    const multiFactorSession = await multiFactor(user).getSession();

    // Create phone auth provider
    const phoneAuthProvider = new PhoneAuthProvider(auth);
    
    // Send verification code
    const verificationId = await phoneAuthProvider.verifyPhoneNumber(
      phoneNumber,
      multiFactorSession
    );

    // Update user settings
    await updateDoc(doc(db, 'settings', 'app-settings'), {
      'twoFactorEnabled': true,
      'twoFactorPhone': phoneNumber,
      'lastUpdated': serverTimestamp()
    });

    return verificationId;
  } catch (error) {
    console.error('Error setting up 2FA:', error);
    throw error;
  }
};

// Complete 2FA setup
export const completeTwoFactorSetup = async (verificationId, verificationCode) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No user logged in');

    const cred = PhoneAuthProvider.credential(verificationId, verificationCode);
    const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
    
    // Enroll the multi-factor auth
    await multiFactor(user).enroll(multiFactorAssertion, 'Phone 2FA');

    return { success: true };
  } catch (error) {
    console.error('Error completing 2FA setup:', error);
    throw error;
  }
};

// Change password
export const changePassword = async (currentPassword, newPassword) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No user logged in');

    // Re-authenticate user
    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword
    );
    await reauthenticateWithCredential(user, credential);

    // Update password
    await updatePassword(user, newPassword);

    // Log password change
    await setDoc(doc(collection(db, 'audit-logs')), {
      action: 'password_changed',
      userId: user.uid,
      timestamp: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};

// Validate password strength
export const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const validations = {
    length: password.length >= minLength,
    upperCase: hasUpperCase,
    lowerCase: hasLowerCase,
    number: hasNumbers,
    specialChar: hasSpecialChar
  };

  const isValid = Object.values(validations).every(Boolean);

  return {
    isValid,
    validations,
    score: Object.values(validations).filter(Boolean).length
  };
};

// Check IP whitelist
export const checkIpWhitelist = async (ipAddress, settings) => {
  if (!settings.ipWhitelist || settings.ipWhitelist.length === 0) {
    return true; // No whitelist = all IPs allowed
  }

  return settings.ipWhitelist.includes(ipAddress);
};

// Add IP to whitelist
export const addToIpWhitelist = async (ipAddress) => {
  try {
    const settingsRef = doc(db, 'settings', 'app-settings');
    await updateDoc(settingsRef, {
      ipWhitelist: arrayUnion(ipAddress),
      lastUpdated: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error adding IP to whitelist:', error);
    throw error;
  }
};

// Remove IP from whitelist
export const removeFromIpWhitelist = async (ipAddress) => {
  try {
    const settingsRef = doc(db, 'settings', 'app-settings');
    await updateDoc(settingsRef, {
      ipWhitelist: arrayRemove(ipAddress),
      lastUpdated: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error removing IP from whitelist:', error);
    throw error;
  }
};

// Get security metrics
export const getSecurityMetrics = async () => {
  try {
    const settingsDoc = await doc(db, 'settings', 'app-settings').get();
    const settings = settingsDoc.data();

    return {
      twoFactorEnabled: settings.twoFactorEnabled || false,
      passwordRequired: settings.passwordRequired || false,
      autoLogoutMinutes: settings.autoLogout || 30,
      ipWhitelistCount: (settings.ipWhitelist || []).length,
      lastSecurityUpdate: settings.lastUpdated?.toDate() || null
    };
  } catch (error) {
    console.error('Error getting security metrics:', error);
    throw error;
  }
};