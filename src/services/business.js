import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// Business hours validation
export const validateBusinessHours = (hours) => {
  const { start, end, workDays } = hours;
  
  // Check if times are in valid format (HH:mm)
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(start) || !timeRegex.test(end)) {
    throw new Error('Invalid time format. Use HH:mm format.');
  }

  // Check if start time is before end time
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  if (startMinutes >= endMinutes) {
    throw new Error('Start time must be before end time.');
  }

  // Validate work days
  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  if (!workDays.every(day => validDays.includes(day))) {
    throw new Error('Invalid work days provided.');
  }

  return true;
};

// Tax rate validation
export const validateTaxRate = (rate) => {
  const numRate = Number(rate);
  if (isNaN(numRate) || numRate < 0 || numRate > 100) {
    throw new Error('Tax rate must be between 0 and 100.');
  }
  return true;
};

// Update business hours
export const updateBusinessHours = async (hours) => {
  try {
    validateBusinessHours(hours);
    
    await updateDoc(doc(db, 'settings', 'app-settings'), {
      'businessHours': hours,
      'lastUpdated': serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating business hours:', error);
    throw error;
  }
};

// Update tax rate
export const updateTaxRate = async (rate) => {
  try {
    validateTaxRate(rate);
    
    await updateDoc(doc(db, 'settings', 'app-settings'), {
      'taxRate': Number(rate),
      'lastUpdated': serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating tax rate:', error);
    throw error;
  }
};

// Update delivery settings
export const updateDeliverySettings = async (settings) => {
  try {
    const { deliveryRadius, minimumOrderValue } = settings;
    
    if (deliveryRadius < 0) {
      throw new Error('Delivery radius cannot be negative.');
    }
    
    if (minimumOrderValue < 0) {
      throw new Error('Minimum order value cannot be negative.');
    }

    await updateDoc(doc(db, 'settings', 'app-settings'), {
      'deliveryRadius': Number(deliveryRadius),
      'minimumOrderValue': Number(minimumOrderValue),
      'lastUpdated': serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating delivery settings:', error);
    throw error;
  }
};

// Check if business is currently open
export const isBusinessOpen = (settings) => {
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Check if it's a work day
  if (!settings.businessHours.workDays.includes(currentDay)) {
    return false;
  }

  // Check if current time is within business hours
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [startHour, startMin] = settings.businessHours.start.split(':').map(Number);
  const [endHour, endMin] = settings.businessHours.end.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return currentTime >= startMinutes && currentTime <= endMinutes;
};

// Calculate total with tax
export const calculateTotalWithTax = (subtotal, settings) => {
  const tax = (subtotal * settings.taxRate) / 100;
  return {
    subtotal,
    tax,
    total: subtotal + tax
  };
};

// Check if order meets minimum value
export const meetsMinimumOrder = (total, settings) => {
  return total >= settings.minimumOrderValue;
};

// Check if delivery is available for location
export const isDeliveryAvailable = (distance, settings) => {
  return distance <= settings.deliveryRadius;
};

// Get next business hours
export const getNextBusinessHours = (settings) => {
  const now = new Date();
  const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
  const currentDayIndex = settings.businessHours.workDays.indexOf(currentDay);
  
  if (currentDayIndex === -1) {
    // Find next working day
    const nextDay = settings.businessHours.workDays[0];
    return {
      day: nextDay,
      start: settings.businessHours.start,
      end: settings.businessHours.end
    };
  }

  const [startHour, startMin] = settings.businessHours.start.split(':').map(Number);
  const currentTime = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + startMin;
  
  if (currentTime < startMinutes) {
    // Today, but not open yet
    return {
      day: currentDay,
      start: settings.businessHours.start,
      end: settings.businessHours.end
    };
  }

  // Find next working day
  const nextDayIndex = (currentDayIndex + 1) % settings.businessHours.workDays.length;
  const nextDay = settings.businessHours.workDays[nextDayIndex];
  
  return {
    day: nextDay,
    start: settings.businessHours.start,
    end: settings.businessHours.end
  };
};

// Format business hours for display
export const formatBusinessHours = (settings) => {
  const { businessHours } = settings;
  
  return businessHours.workDays.map(day => ({
    day,
    hours: `${businessHours.start} - ${businessHours.end}`
  }));
};

// Get business metrics
export const getBusinessMetrics = async () => {
  try {
    const settingsDoc = await doc(db, 'settings', 'app-settings').get();
    const settings = settingsDoc.data();

    return {
      isOpen: isBusinessOpen(settings),
      nextOpen: getNextBusinessHours(settings),
      taxRate: settings.taxRate,
      deliveryRadius: settings.deliveryRadius,
      minimumOrder: settings.minimumOrderValue,
      workingDays: settings.businessHours.workDays.length,
      dailyHours: calculateDailyHours(settings.businessHours)
    };
  } catch (error) {
    console.error('Error getting business metrics:', error);
    throw error;
  }
};

// Calculate daily business hours
const calculateDailyHours = (businessHours) => {
  const [startHour, startMin] = businessHours.start.split(':').map(Number);
  const [endHour, endMin] = businessHours.end.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  return (endMinutes - startMinutes) / 60;
};