import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { toast } from 'react-hot-toast';

const Login = () => {
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [appName, setAppName] = useState('Amantena Highway Farms');
  const [appDescription, setAppDescription] = useState('Inventory Management System');

  useEffect(() => {
    // Fetch app settings when component mounts
    const fetchAppSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'app-settings'));
        if (settingsDoc.exists()) {
          const settings = settingsDoc.data();
          setAppName(settings.appName || settings.farmName || 'Amantena Highway Farms');
          setAppDescription(settings.appDescription || settings.farmDescription || 'Inventory Management System');
        }
      } catch (error) {
        console.error('Error fetching app settings:', error);
      }
    };

    fetchAppSettings();

    // Listen for settings updates
    const handleSettingsUpdate = (event) => {
      const { appName: newName, appDescription: newDesc } = event.detail;
      if (newName) setAppName(newName);
      if (newDesc) setAppDescription(newDesc);
    };

    window.addEventListener('app-settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('app-settings-updated', handleSettingsUpdate);
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const user = await signIn();

      if (user?.email) {
        window.localStorage.setItem('lastAttemptedEmail', user.email);
      }
    } catch (error) {
      console.error('Login error:', error);
      const message = error?.message?.includes('Unauthorized email')
        ? 'Unauthorized email address. Please contact an administrator for access.'
        : error?.message || 'An error occurred during sign in. Please try again.';

      setError(message);

      if (!error?.message?.includes('Unauthorized email')) {
        toast.error(message, { duration: 6000 });
      }
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="bg-emerald-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">{appName.charAt(0)}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{appName}</h1>
          <p className="text-gray-600">{appDescription}</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Welcome Back</h2>
            <p className="text-gray-600">Sign in to manage your farm inventory</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-red-800">Access Denied</h3>
                  <p className="mt-2 text-sm text-red-700">{error}</p>
                  {error.includes('Unauthorized') && (
                    <div className="mt-3 bg-red-100 p-3 rounded-md">
                      <p className="text-sm text-red-800">
                        To request access:
                        <br />1. Contact your system administrator
                        <br />2. Provide them with your email: <span className="font-mono bg-red-200 px-1 rounded">{window.localStorage.getItem('lastAttemptedEmail') || ''}</span>
                        <br />3. Wait for confirmation before trying again
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600 mr-3"></div>
                Signing in...
              </div>
            ) : (
              <>
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {/* Additional Info */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-center">
              <p className="text-xs text-gray-500">
                By signing in, you agree to our terms and conditions
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
