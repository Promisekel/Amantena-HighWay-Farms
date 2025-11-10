import React from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase';
import toast from 'react-hot-toast';

// Custom error types
export const ErrorTypes = {
  VALIDATION: 'validation_error',
  NETWORK: 'network_error',
  AUTHENTICATION: 'auth_error',
  PERMISSION: 'permission_error',
  NOT_FOUND: 'not_found_error',
  BUSINESS_LOGIC: 'business_logic_error',
  DATABASE: 'database_error',
  UNKNOWN: 'unknown_error'
};

// Error handler class
class ErrorHandler {
  constructor() {
    this.errorSubscribers = [];
  }

  // Subscribe to error events
  subscribe(callback) {
    this.errorSubscribers.push(callback);
    return () => {
      this.errorSubscribers = this.errorSubscribers.filter(cb => cb !== callback);
    };
  }

  // Handle error
  async handleError(error, context = {}) {
    try {
      // Parse error
      const errorInfo = this.parseError(error);
      
      // Log error to Firestore
      await this.logError({
        ...errorInfo,
        context,
        userId: auth.currentUser?.uid,
        timestamp: serverTimestamp()
      });

      // Show user feedback
      this.showErrorFeedback(errorInfo);

      // Notify subscribers
      this.notifySubscribers(errorInfo);

      return errorInfo;
    } catch (loggingError) {
      console.error('Error in error handler:', loggingError);
      // Fallback error display
      toast.error('An unexpected error occurred');
    }
  }

  // Parse different error types
  parseError(error) {
    let type = ErrorTypes.UNKNOWN;
    let message = 'An unexpected error occurred';
    let code = 'unknown';
    let recoverable = true;

    if (typeof error === 'string') {
      return {
        type: ErrorTypes.VALIDATION,
        message: error,
        code: 'custom_error',
        recoverable: true
      };
    }

    // Firebase Auth Errors
    if (error.code?.startsWith('auth/')) {
      type = ErrorTypes.AUTHENTICATION;
      code = error.code;
      message = this.getAuthErrorMessage(error.code);
      recoverable = true;
    }
    // Network Errors
    else if (error.name === 'NetworkError' || !navigator.onLine) {
      type = ErrorTypes.NETWORK;
      code = 'network_unavailable';
      message = 'Please check your internet connection';
      recoverable = true;
    }
    // Firestore Errors
    else if (error.name === 'FirebaseError') {
      type = ErrorTypes.DATABASE;
      code = error.code;
      message = this.getFirestoreErrorMessage(error.code);
      recoverable = true;
    }
    // Permission Errors
    else if (error.message?.includes('permission')) {
      type = ErrorTypes.PERMISSION;
      code = 'insufficient_permissions';
      message = 'You don\'t have permission to perform this action';
      recoverable = false;
    }
    // Not Found Errors
    else if (error.message?.includes('not found')) {
      type = ErrorTypes.NOT_FOUND;
      code = 'resource_not_found';
      message = 'The requested resource was not found';
      recoverable = true;
    }
    // Validation Errors
    else if (error.name === 'ValidationError') {
      type = ErrorTypes.VALIDATION;
      code = 'validation_failed';
      message = error.message;
      recoverable = true;
    }

    return {
      type,
      message,
      code,
      recoverable,
      originalError: error
    };
  }

  // Get user-friendly auth error messages
  getAuthErrorMessage(code) {
    const messages = {
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/invalid-email': 'Invalid email address',
      'auth/email-already-in-use': 'This email is already registered',
      'auth/weak-password': 'Password is too weak',
      'auth/requires-recent-login': 'Please log in again to continue',
      'auth/popup-closed-by-user': 'Sign-in popup was closed',
      'auth/unauthorized-domain': 'This domain is not authorized',
      'auth/operation-not-allowed': 'Operation not allowed',
      'auth/user-disabled': 'This account has been disabled'
    };

    return messages[code] || 'Authentication error occurred';
  }

  // Get user-friendly Firestore error messages
  getFirestoreErrorMessage(code) {
    const messages = {
      'permission-denied': 'You don\'t have permission to perform this action',
      'not-found': 'The requested document was not found',
      'already-exists': 'The document already exists',
      'failed-precondition': 'Operation failed',
      'aborted': 'Operation was aborted',
      'out-of-range': 'Operation was out of range',
      'unauthenticated': 'You must be logged in',
      'unavailable': 'Service is currently unavailable',
      'data-loss': 'Unrecoverable data loss or corruption'
    };

    return messages[code] || 'Database operation failed';
  }

  // Log error to Firestore
  async logError(errorInfo) {
    try {
      await addDoc(collection(db, 'error-logs'), {
        ...errorInfo,
        userAgent: navigator.userAgent,
        timestamp: serverTimestamp(),
        path: window.location.pathname
      });
    } catch (error) {
      console.error('Failed to log error:', error);
    }
  }

  // Show user feedback
  showErrorFeedback(errorInfo) {
    const { type, message, recoverable } = errorInfo;

    switch (type) {
      case ErrorTypes.VALIDATION:
        toast.error(message, { duration: 4000 });
        break;
      case ErrorTypes.NETWORK:
        toast.error(message, {
          duration: 5000,
          icon: '🌐'
        });
        break;
      case ErrorTypes.AUTHENTICATION:
        toast.error(message, {
          duration: 4000,
          icon: '🔒'
        });
        break;
      case ErrorTypes.PERMISSION:
        toast.error(message, {
          duration: 5000,
          icon: '⚠️'
        });
        break;
      case ErrorTypes.NOT_FOUND:
        toast.error(message, {
          duration: 4000,
          icon: '🔍'
        });
        break;
      default:
        if (recoverable) {
          toast.error(message, { duration: 4000 });
        } else {
          toast.error('A critical error occurred. Please contact support.', {
            duration: 6000,
            icon: '❌'
          });
        }
    }
  }

  // Notify error subscribers
  notifySubscribers(errorInfo) {
    this.errorSubscribers.forEach(callback => {
      try {
        callback(errorInfo);
      } catch (error) {
        console.error('Error in error subscriber:', error);
      }
    });
  }

  // Clear error logs older than specified days
  async clearOldErrorLogs(days = 30) {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const oldLogsQuery = query(
        collection(db, 'error-logs'),
        where('timestamp', '<', cutoff)
      );

      const snapshot = await getDocs(oldLogsQuery);
      const batch = writeBatch(db);

      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      return { success: true, clearedCount: snapshot.size };
    } catch (error) {
      console.error('Error clearing old error logs:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const errorHandler = new ErrorHandler();
export default errorHandler;

// Utility function to wrap async functions with error handling
export const withErrorHandler = (fn, context = {}) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      await errorHandler.handleError(error, {
        ...context,
        arguments: args
      });
      throw error; // Re-throw to allow the calling code to handle it if needed
    }
  };
};

// React hook for error handling
export const useErrorHandler = () => {
  const handleError = async (error, context = {}) => {
    return errorHandler.handleError(error, context);
  };

  return {
    handleError,
    ErrorTypes,
    withErrorHandler
  };
};

// Validation helpers
export const validateField = (value, rules) => {
  const errors = [];

  if (rules.required && !value) {
    errors.push('This field is required');
  }

  if (rules.minLength && value.length < rules.minLength) {
    errors.push(`Must be at least ${rules.minLength} characters`);
  }

  if (rules.maxLength && value.length > rules.maxLength) {
    errors.push(`Must be no more than ${rules.maxLength} characters`);
  }

  if (rules.pattern && !rules.pattern.test(value)) {
    errors.push(rules.message || 'Invalid format');
  }

  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) {
      errors.push(customError);
    }
  }

  return errors;
};

// Error boundary component
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    errorHandler.handleError(error, {
      componentStack: errorInfo.componentStack
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-2xl">⚠️</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-600 text-center mb-4">
              We've been notified and are working to fix the issue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}