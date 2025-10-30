import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChange, 
  signInWithGoogle, 
  logOut, 
  checkUserRole 
} from '../services/firebase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    let mounted = true;
    
    const handleUser = async (user) => {
      if (!mounted) return;
      
      if (user) {
        try {
          // Check user role
          const role = await checkUserRole(user.uid);
          if (mounted) {
            setCurrentUser(user);
            setUserRole(role || 'admin'); // Default to admin if no role set
          }
        } catch (error) {
          console.error('Error checking user role:', error);
          if (mounted) {
            setUserRole('admin'); // Fallback to admin role
          }
        }
      } else {
        if (mounted) {
          setCurrentUser(null);
          setUserRole(null);
        }
      }
      
      if (mounted) {
        setLoading(false);
      }
    };

    const unsubscribe = onAuthStateChange(handleUser);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signIn = async () => {
    try {
      const user = await signInWithGoogle();
      return user;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signOutUser = async () => {
    try {
      await logOut();
      setUserRole(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const value = {
    currentUser,
    userRole,
    loading,
    signIn,
    signOut: signOutUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
