import { useCallback, useEffect, useMemo, useState } from 'react';
import { awsApi } from '../services/awsApi.js';
import {
  cognitoConfirmPasswordReset,
  cognitoConfirmRegistration,
  cognitoLogin,
  cognitoLogout,
  cognitoRegister,
  cognitoRequestPasswordReset,
  cognitoToken
} from '../services/cognitoAuth.js';
import { StoreContext } from './storeContextInstance.js';

const SESSION_KEY = 'eswap_v2_cognito_session_v2_2';
const OPEN_ORDER_STATUSES = ['pending_seller', 'awaiting_collection', 'ready_for_collection', 'disputed'];
const EMPTY_DB = {
  meta: { schemaVersion: '2.2.0-aws', storage: 'dynamodb' },
  users: [],
  items: [],
  orders: [],
  recyclingRequests: [],
  conversations: [],
  messages: [],
  notifications: [],
  transactions: [],
  reviews: [],
  reports: [],
  auditLog: []
};

function readSession() {
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY));
    return { token: '', userId: stored?.userId || '' };
  } catch {
    return { token: '', userId: '' };
  }
}

function writeSession(session) {
  if (session?.userId) localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: session.userId }));
  else localStorage.removeItem(SESSION_KEY);
}

export default function AwsStoreProvider({ children }) {
  const [db, setDb] = useState(EMPTY_DB);
  const [session, setSession] = useState(readSession);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((message, type = 'success') => {
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, type }]);
    globalThis.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3800);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const clearSession = useCallback(() => {
    writeSession(null);
    setSession({ token: '', userId: '' });
  }, []);

  useEffect(() => {
    let active = true;
    async function hydrate() {
      try {
        const token = await cognitoToken();
        if (token) {
          const result = await awsApi.openSession(token);
          const nextSession = { token, userId: result.user.id };
          if (active) {
            writeSession(nextSession);
            setSession(nextSession);
            setDb(result.state || EMPTY_DB);
          }
        } else {
          const result = await awsApi.getPublicState();
          if (active) {
            clearSession();
            setDb(result.state || EMPTY_DB);
          }
        }
      } catch (error) {
        clearSession();
        await cognitoLogout();
        try {
          const result = await awsApi.getPublicState();
          if (active) setDb(result.state || EMPTY_DB);
        } catch (publicError) {
          if (active) pushToast(publicError.message, 'error');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    hydrate();
    return () => { active = false; };
    // Cognito owns token persistence and refresh; this runs once when the provider mounts.
  }, [clearSession, pushToast]);

  const currentUserRecord = useMemo(
    () => db.users.find((user) => user.id === session.userId && user.status === 'active') || null,
    [db.users, session.userId]
  );
  const currentUser = currentUserRecord;
  const isAdmin = currentUser?.role === 'admin';

  const login = useCallback(async (values) => {
    const token = await cognitoLogin(values);
    const result = await awsApi.openSession(token);
    const nextSession = { token, userId: result.user.id };
    writeSession(nextSession);
    setSession(nextSession);
    setDb(result.state);
    pushToast(`Welcome back, ${result.user.name.split(' ')[0]}.`);
    return result.user;
  }, [pushToast]);

  const register = useCallback(async (values) => {
    return cognitoRegister(values);
  }, []);

  const confirmRegistration = useCallback(async (values) => {
    const token = await cognitoConfirmRegistration(values);
    const result = await awsApi.openSession(token, {
      name: values.name,
      location: values.location
    });
    const nextSession = { token, userId: result.user.id };
    writeSession(nextSession);
    setSession(nextSession);
    setDb(result.state);
    pushToast('Email confirmed. Your account and 100 E-Tokens are ready.');
    return result.user;
  }, [pushToast]);

  const logout = useCallback(async () => {
    await cognitoLogout();
    clearSession();
    setDb(EMPTY_DB);
    awsApi.getPublicState().then((result) => setDb(result.state || EMPTY_DB)).catch(() => {});
    pushToast('You have been logged out.', 'info');
  }, [clearSession, pushToast]);

  const perform = useCallback(async (action, payload, message, type = 'success') => {
    if (!session.userId) throw new Error('Authentication required.');
    try {
      const token = await cognitoToken();
      if (!token) throw new Error('Your Cognito session has expired. Please log in again.');
      const result = await awsApi.action(token, action, payload);
      setDb(result.state || EMPTY_DB);
      if (result.signedOut) clearSession();
      if (message) pushToast(message, type);
      return result.result;
    } catch (error) {
      if (error.status === 401) clearSession();
      throw error;
    }
  }, [clearSession, pushToast, session.userId]);

  const actions = useMemo(() => ({
    requestPasswordReset: (email) => cognitoRequestPasswordReset(email),
    confirmPasswordReset: (values) => cognitoConfirmPasswordReset(values),
    resetLocalPassword: async () => { throw new Error('Use Cognito email verification to reset this password.'); },
    updateProfile: (updates) => perform('updateProfile', updates, 'Profile updated.'),
    updateNotificationPreferences: (preferences) => perform('updateNotificationPreferences', preferences, 'Notification preferences saved.'),
    deleteOwnAccount: (values) => perform('deleteOwnAccount', values, 'Your account was deleted.', 'info'),
    toggleFavourite: (itemId) => perform('toggleFavourite', { itemId }),
    createItem: (values) => perform('createItem', { values }, 'Listing published.'),
    updateItem: (itemId, values) => perform('updateItem', { itemId, values }, 'Listing updated.'),
    deleteItem: (itemId) => perform('deleteItem', { itemId }, 'Listing deleted.', 'info'),
    createOrder: (itemId) => perform('createOrder', { itemId }, 'Order created. Your E-Tokens are protected in escrow.'),
    acceptOrder: (orderId, collectionNote = '') => perform('acceptOrder', { orderId, collectionNote }, 'Order accepted. Arrange collection with the buyer.'),
    rejectOrder: (orderId, reason = 'Seller declined the order.') => perform('rejectOrder', { orderId, reason }, 'Order rejected and the buyer was refunded.', 'info'),
    cancelOrder: (orderId) => perform('cancelOrder', { orderId }, 'Order cancelled and your tokens were refunded.', 'info'),
    markOrderReady: (orderId, collectionNote = '') => perform('markOrderReady', { orderId, collectionNote }, 'Buyer notified that the item is ready.'),
    confirmOrderReceived: (orderId) => perform('confirmOrderReceived', { orderId }, 'Order completed. Tokens released to the seller.'),
    raiseDispute: (orderId, reason) => perform('raiseDispute', { orderId, reason }, 'Dispute opened for administrator review.', 'info'),
    leaveReview: (values) => perform('leaveReview', values, 'Review published.'),
    startConversation: (values) => perform('startConversation', values, 'Message sent.'),
    sendMessage: (conversationId, body) => perform('sendMessage', { conversationId, body }),
    toggleBlockUser: (userId) => perform('toggleBlockUser', { userId }, 'Block preference updated.', 'info'),
    markConversationRead: (conversationId) => perform('markConversationRead', { conversationId }),
    markNotificationRead: (notificationId) => perform('markNotificationRead', { notificationId }),
    markAllNotificationsRead: () => perform('markAllNotificationsRead', {}, 'All notifications marked as read.', 'info'),
    reportItem: (values) => perform('reportItem', values, 'Report submitted for administrator review.'),
    reportUser: (values) => perform('reportUser', values, 'User report submitted for administrator review.'),
    createRecyclingRequest: (values) => perform('createRecyclingRequest', { values }, 'Recycling request submitted for administrator review.'),
    adminAdjustTokens: (values) => perform('adminAdjustTokens', values, 'Token balance updated.'),
    adminSetUserStatus: (userId, status, reason = '') => perform('adminSetUserStatus', { userId, status, reason }, `User ${status === 'active' ? 'activated' : 'suspended'}.`),
    adminDeleteUser: (userId) => perform('adminDeleteUser', { userId }, 'User account deleted.', 'info'),
    adminModerateItem: (itemId, status) => perform('adminModerateItem', { itemId, status }, `Listing changed to ${status}.`),
    adminResolveReport: (reportId, resolution) => perform('adminResolveReport', { reportId, resolution }, 'Report updated.'),
    adminProcessEscrow: (orderId, outcome, reason) => perform('adminProcessEscrow', { orderId, outcome, reason }, outcome === 'release' ? 'Escrow released to the seller.' : 'Escrow refunded to the buyer.'),
    adminUpdateRecyclingRequest: (requestId, status, reason) => perform('adminUpdateRecyclingRequest', { requestId, status, reason }, `Recycling request marked ${status}.`),
    adminResolveDispute: (orderId, outcome, note) => perform('adminResolveDispute', { orderId, outcome, note }, 'Dispute resolved.'),
    adminBroadcast: (values) => perform('adminBroadcast', values, 'Announcement sent to all active users.'),
    resetDemo: () => perform('resetDemo', {}, 'AWS demo data reset.', 'info'),
    uploadImage: async (file) => {
      const token = await cognitoToken();
      if (!token) throw new Error('Your Cognito session has expired. Please log in again.');
      return awsApi.uploadImage(token, file);
    }
  }), [perform]);

  const userNotifications = useMemo(
    () => db.notifications.filter((notification) => notification.userId === session.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.notifications, session.userId]
  );
  const userTransactions = useMemo(
    () => db.transactions.filter((transaction) => transaction.userId === session.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.transactions, session.userId]
  );
  const userConversations = useMemo(
    () => db.conversations.filter((conversation) => conversation.participantIds.includes(session.userId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [db.conversations, session.userId]
  );
  const userOrders = useMemo(
    () => db.orders.filter((order) => order.buyerId === session.userId || order.sellerId === session.userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [db.orders, session.userId]
  );
  const userRecyclingRequests = useMemo(
    () => db.recyclingRequests.filter((request) => request.requesterId === session.userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [db.recyclingRequests, session.userId]
  );
  const unreadNotificationCount = userNotifications.filter((notification) => !notification.read).length;
  const unreadMessageCount = useMemo(() => db.messages.filter((message) => {
    const conversation = db.conversations.find((entry) => entry.id === message.conversationId);
    return conversation?.participantIds.includes(session.userId) && message.senderId !== session.userId && !message.readBy.includes(session.userId);
  }).length, [db.conversations, db.messages, session.userId]);
  const openOrderCount = userOrders.filter((order) => OPEN_ORDER_STATUSES.includes(order.status)).length;

  const value = useMemo(() => ({
    db,
    currentUser,
    currentUserRecord,
    isAuthenticated: Boolean(currentUser),
    isAdmin,
    isLoading,
    storageMode: 'aws',
    toasts,
    userNotifications,
    userTransactions,
    userConversations,
    userOrders,
    userRecyclingRequests,
    unreadNotificationCount,
    unreadMessageCount,
    openOrderCount,
    login,
    register,
    confirmRegistration,
    logout,
    buyItem: actions.createOrder,
    pushToast,
    dismissToast,
    ...actions
  }), [
    actions, currentUser, currentUserRecord, db, dismissToast, isAdmin, isLoading,
    confirmRegistration, login, logout, openOrderCount, pushToast, register, toasts, unreadMessageCount,
    unreadNotificationCount, userConversations, userNotifications, userOrders,
    userRecyclingRequests, userTransactions
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
