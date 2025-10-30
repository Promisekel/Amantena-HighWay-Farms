import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import toast from 'react-hot-toast';

// Initialize Firebase Cloud Messaging
let messaging;
try {
  messaging = getMessaging();
} catch (error) {
  console.error('Failed to initialize Firebase Cloud Messaging:', error);
}

// Request notification permissions
export const requestNotificationPermission = async () => {
  try {
    if (!messaging) throw new Error('Messaging not initialized');

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: process.env.REACT_APP_FIREBASE_VAPID_KEY
      });

      // Save the token to Firestore
      await updateDoc(doc(db, 'settings', 'app-settings'), {
        'notifications.fcmToken': token,
        'notifications.lastUpdated': serverTimestamp()
      });

      toast.success('Notifications enabled successfully', {
        duration: 3000
      });

      return true;
    }
    toast.error('Notification permission denied', {
      duration: 3000
    });
    return false;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    toast.error('Failed to enable notifications: ' + error.message, {
      duration: 4000
    });
    return false;
  }
};

// Handle incoming messages
export const setupNotificationListeners = () => {
  if (!messaging) return;

  onMessage(messaging, (payload) => {
    console.log('Message received:', payload);
    
    // Show notification using react-hot-toast
    toast.custom((t) => (
      <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} bg-white shadow-lg rounded-lg p-4 flex items-start space-x-4`}>
        <div className="flex-shrink-0">
          {payload.notification?.icon ? (
            <img src={payload.notification.icon} alt="" className="h-10 w-10 rounded" />
          ) : (
            <div className="h-10 w-10 rounded bg-emerald-100 flex items-center justify-center">
              <span className="text-emerald-600 text-lg font-bold">
                {payload.notification?.title?.charAt(0) || 'N'}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 pt-1">
          <p className="font-medium text-gray-900">
            {payload.notification?.title || 'New Notification'}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {payload.notification?.body || ''}
          </p>
        </div>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
        >
          <span className="sr-only">Close</span>
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    ), {
      duration: 5000,
      position: 'top-right'
    });
  });
};

// Send test notification
export const sendTestNotification = async () => {
  try {
    if (!messaging) {
      throw new Error('Notifications are not initialized');
    }

    // Show an immediate visual notification
    toast.custom((t) => (
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <span className="text-emerald-600 text-lg">🔔</span>
            </div>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">
              Test Notification
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Your notifications are working correctly!
            </p>
          </div>
        </div>
      </div>
    ), {
      duration: 5000,
      position: 'top-right',
    });

    return true;
  } catch (error) {
    console.error('Error sending test notification:', error);
    toast.error('Failed to send test notification: ' + error.message, {
      duration: 4000
    });
    return false;
  }
};

// Check notification permissions
export const checkNotificationPermission = async () => {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
};

// Setup all notification handlers
export const setupNotifications = async (settings) => {
  if (!settings?.notifications) {
    console.warn('Notification settings not found');
    return;
  }

  if (settings.notifications.pushNotifications) {
    const hasPermission = await requestNotificationPermission();
    if (hasPermission) {
      setupNotificationListeners();
      toast.success('Push notifications enabled', {
        icon: '🔔',
        duration: 3000
      });
    }
  } else {
    console.log('Push notifications are disabled in settings');
  }

  // Additional notification setup can be added here
};

// Handle different types of notifications
export const notificationHandlers = {
  lowStock: async (product) => {
    toast.custom((t) => (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-2xl">⚠️</span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-red-800">
              Low Stock Alert
            </p>
            <p className="mt-1 text-sm text-red-700">
              {`${product.name} is running low! Current quantity: ${product.quantity}`}
            </p>
          </div>
        </div>
      </div>
    ), {
      duration: 7000,
      position: 'top-right',
    });
  },
  
  newSale: async (sale) => {
    toast.custom((t) => (
      <div className="bg-emerald-50 border-l-4 border-emerald-400 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-2xl">💰</span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-emerald-800">
              New Sale Completed
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              {`Amount: GH₵${sale.total.toFixed(2)}`}
            </p>
          </div>
        </div>
      </div>
    ), {
      duration: 5000,
      position: 'top-right',
    });
  },
  
  systemUpdate: async (message) => {
    toast.custom((t) => (
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-2xl">🔄</span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-blue-800">
              System Update
            </p>
            <p className="mt-1 text-sm text-blue-700">
              {message}
            </p>
          </div>
        </div>
      </div>
    ), {
      duration: 6000,
      position: 'top-right',
    });
  },
  
  dailyReport: async (report) => {
    toast.custom((t) => (
      <div className="bg-indigo-50 border-l-4 border-indigo-400 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-2xl">📊</span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-indigo-800">
              Daily Report Available
            </p>
            <p className="mt-1 text-sm text-indigo-700">
              {`Report for ${report.date} is ready to view`}
            </p>
          </div>
        </div>
      </div>
    ), {
      duration: 6000,
      position: 'top-right',
    });
  },
  
  loginAlert: async (loginDetails) => {
    toast.custom((t) => (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-2xl">🔐</span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-yellow-800">
              New Login Detected
            </p>
            <p className="mt-1 text-sm text-yellow-700">
              {`Time: ${new Date(loginDetails.timestamp).toLocaleString()}`}
            </p>
            <p className="text-sm text-yellow-700">
              {`Device: ${loginDetails.device || 'Unknown'}`}
            </p>
          </div>
        </div>
      </div>
    ), {
      duration: 6000,
      position: 'top-right',
    });
  }
};