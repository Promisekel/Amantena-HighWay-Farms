import { 
  doc, 
  getDoc, 
  addDoc, 
  collection, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(undefined, 'us-central1');
const sendEmailNotification = httpsCallable(functions, 'sendEmailNotification');

export const sendSupportRequestEmail = async ({ fromEmail, fromName, subject, message }) => {
  const trimmedEmail = (fromEmail || '').trim();
  const trimmedMessage = (message || '').trim();
  const senderName = (fromName || '').trim() || 'Unknown user';
  if (!trimmedEmail) {
    throw new Error('Sender email is required.');
  }
  if (!trimmedMessage) {
    throw new Error('Support message cannot be empty.');
  }
  if (typeof sendEmailNotification !== 'function') {
    throw new Error('Email service is not configured.');
  }

  const finalSubject = (subject || '').trim() || `Support request from ${senderName}`;
  const composedMessage = [
    'A new support request was submitted via the Highway Farm dashboard.',
    `From: ${senderName}`,
    `Email: ${trimmedEmail}`,
    '',
    'Message:',
    trimmedMessage
  ].join('\n');

  try {
    const result = await sendEmailNotification({
      email: 'classiqcode@gmail.com',
      to: 'classiqcode@gmail.com',
      subject: finalSubject,
      message: composedMessage,
      htmlContent: composedMessage
        .split('\n')
        .map((line) => `<p>${line || '&nbsp;'}</p>`)
        .join(''),
      type: 'support',
      from: trimmedEmail,
      metadata: {
        fromEmail: trimmedEmail,
        fromName: senderName
      }
    });

    const wasSuccessful = result?.data?.success !== false;
    if (!wasSuccessful) {
      const reason = result?.data?.message || 'Email service reported a failure.';
      throw new Error(reason);
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
};

export const sendEmailToAuthorizedUsers = async (subject, message, type) => {
  try {
    // Get settings document to access authorized emails
    const settingsDoc = await getDoc(doc(db, 'settings', 'app-settings'));
    if (!settingsDoc.exists()) {
      throw new Error('Settings document not found');
    }

    const settings = settingsDoc.data();
    const authorizedEmails = settings.authorizedEmails || [];

    if (authorizedEmails.length === 0) {
      console.warn('No authorized emails found for notifications');
      return;
    }

    // Filter emails that have enabled notifications
    const notificationEnabledEmails = authorizedEmails.filter(email => {
      // Check if the user has email notifications enabled
      // Default to true if not specified
      const userSettings = settings.userNotificationPreferences?.[email] || {};
      return userSettings.emailNotifications !== false;
    });

    if (notificationEnabledEmails.length === 0) {
      console.warn('No users have email notifications enabled');
      return;
    }

    // Send email to each authorized user
    const emailPromises = notificationEnabledEmails.map(async (email) => {
      try {
        const result = await sendEmailNotification({
          email,
          subject,
          message,
          type
        });

        // Log the notification
        await addDoc(collection(db, 'notification-logs'), {
          recipient: email,
          subject,
          type,
          status: 'sent',
          timestamp: serverTimestamp()
        });

        return result;
      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error);
        
        // Log the failure
        await addDoc(collection(db, 'notification-logs'), {
          recipient: email,
          subject,
          type,
          status: 'failed',
          error: error.message,
          timestamp: serverTimestamp()
        });

        throw error;
      }
    });

    await Promise.all(emailPromises);
  } catch (error) {
    console.error('Error sending email notifications:', error);
    throw error;
  }
};

// Notification templates
export const emailTemplates = {
  lowStock: (product) => ({
    subject: `Low Stock Alert: ${product.name}`,
    message: `
      Low stock alert for ${product.name}
      Current quantity: ${product.quantity}
      Threshold: ${product.threshold}
      
      Please review and restock if necessary.
    `,
    type: 'lowStock'
  }),

  newSale: (sale) => ({
    subject: 'New Sale Completed',
    message: `
      A new sale has been completed
      Total Amount: GH₵${sale.total.toFixed(2)}
      Items Sold: ${sale.items.length}
      Date: ${new Date(sale.date).toLocaleDateString()}
      
      View details in your dashboard.
    `,
    type: 'sale'
  }),

  dailyReport: (report) => ({
    subject: `Daily Summary Report - ${new Date().toLocaleDateString()}`,
    message: `
      Daily Business Summary
      
      Total Sales: GH₵${report.totalSales.toFixed(2)}
      Number of Transactions: ${report.transactionCount}
      Top Selling Items:
      ${report.topSellers.map(item => `- ${item.name}: ${item.quantity} units`).join('\n')}
      
      View full report in your dashboard.
    `,
    type: 'report'
  }),

  weeklyReport: (report) => ({
    subject: `Weekly Business Report - Week ${report.weekNumber}`,
    message: `
      Weekly Business Summary
      
      Period: ${report.startDate} to ${report.endDate}
      Total Revenue: GH₵${report.totalRevenue.toFixed(2)}
      Total Transactions: ${report.totalTransactions}
      Average Daily Sales: GH₵${report.averageDailySales.toFixed(2)}
      
      View detailed analytics in your dashboard.
    `,
    type: 'report'
  }),

  monthlyReport: (report) => ({
    subject: `Monthly Business Report - ${report.month} ${report.year}`,
    message: `
      Monthly Business Summary
      
      Total Revenue: GH₵${report.totalRevenue.toFixed(2)}
      Product Sales:
      ${report.productSales.map(p => `- ${p.name}: ${p.quantity} units (GH₵${p.revenue.toFixed(2)})`).join('\n')}
      
      View complete report in your dashboard.
    `,
    type: 'report'
  }),

  loginAlert: (loginDetails) => ({
    subject: 'New Login Detected',
    message: `
      A new login was detected on your account
      
      Time: ${new Date(loginDetails.timestamp).toLocaleString()}
      Device: ${loginDetails.device}
      Location: ${loginDetails.location}
      
      If this wasn't you, please secure your account immediately.
    `,
    type: 'security'
  })
};

// Function to format and send low stock notification
export const sendLowStockNotification = async (product) => {
  const { subject, message, type } = emailTemplates.lowStock(product);
  await sendEmailToAuthorizedUsers(subject, message, type);
};

// Function to send sales notification
export const sendSaleNotification = async (sale) => {
  const { subject, message, type } = emailTemplates.newSale(sale);
  await sendEmailToAuthorizedUsers(subject, message, type);
};

// Function to send reports
export const sendReportNotification = async (report, reportType) => {
  const template = emailTemplates[`${reportType}Report`];
  if (!template) throw new Error(`Invalid report type: ${reportType}`);
  
  const { subject, message, type } = template(report);
  await sendEmailToAuthorizedUsers(subject, message, type);
};

// Function to send login alert
export const sendLoginNotification = async (loginDetails) => {
  const { subject, message, type } = emailTemplates.loginAlert(loginDetails);
  await sendEmailToAuthorizedUsers(subject, message, type);
};