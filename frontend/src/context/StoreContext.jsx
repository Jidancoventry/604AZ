import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  makeId,
  nowIso,
  readDatabase,
  readSession,
  resetLocalDatabase,
  safeUser,
  writeDatabase,
  writeSession
} from '../services/localDb.js';
import { addSystemMessage, addTransaction, refundEscrow, releaseEscrow } from '../services/escrow.js';
import AwsStoreProvider from './AwsStoreProvider.jsx';
import { StoreContext } from './storeContextInstance.js';

const OPEN_ORDER_STATUSES = ['pending_seller', 'awaiting_collection', 'ready_for_collection', 'disputed'];

function normaliseEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function notificationPreference(type) {
  if (type === 'message') return 'messages';
  if (['purchase', 'sale', 'order', 'dispute', 'review', 'recycling'].includes(type)) return 'orders';
  if (type === 'tokens') return 'tokens';
  if (type === 'announcement') return 'announcements';
  return null;
}

function addNotification(database, { userId, type, title, body, link = '/notifications' }) {
  const user = database.users.find((entry) => entry.id === userId);
  const preference = notificationPreference(type);
  if (preference && user?.notificationPreferences?.[preference] === false) return;
  database.notifications.unshift({
    id: makeId('not'),
    userId,
    type,
    title,
    body,
    link,
    read: false,
    createdAt: nowIso()
  });
}

function addAudit(database, actorId, action, details, metadata = {}) {
  database.auditLog.unshift({
    id: makeId('audit'),
    actorId,
    action,
    details,
    metadata,
    createdAt: nowIso()
  });
}

function getOrCreateConversation(database, { itemId, orderId = null, firstId, secondId }) {
  let conversation = database.conversations.find((entry) => (
    entry.itemId === itemId
    && entry.participantIds.includes(firstId)
    && entry.participantIds.includes(secondId)
  ));
  if (!conversation) {
    conversation = {
      id: makeId('cnv'),
      participantIds: [firstId, secondId],
      itemId,
      orderId,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    database.conversations.unshift(conversation);
  } else if (orderId && !conversation.orderId) {
    conversation.orderId = orderId;
  }
  return conversation;
}

function LocalStoreProvider({ children }) {
  const [db, setDb] = useState(() => readDatabase());
  const [sessionUserId, setSessionUserId] = useState(() => readSession());
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const syncDb = () => setDb(readDatabase());
    const syncSession = () => setSessionUserId(readSession());
    globalThis.addEventListener('storage', syncDb);
    globalThis.addEventListener('eswap-db-changed', syncDb);
    globalThis.addEventListener('eswap-session-changed', syncSession);
    return () => {
      globalThis.removeEventListener('storage', syncDb);
      globalThis.removeEventListener('eswap-db-changed', syncDb);
      globalThis.removeEventListener('eswap-session-changed', syncSession);
    };
  }, []);

  const persist = useCallback((producer) => {
    const next = JSON.parse(JSON.stringify(db));
    producer(next);
    writeDatabase(next);
    setDb(next);
  }, [db]);

  const pushToast = useCallback((message, type = 'success') => {
    const id = makeId('toast');
    setToasts((current) => [...current, { id, message, type }]);
    globalThis.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3800);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const currentUserRecord = useMemo(
    () => db.users.find((user) => user.id === sessionUserId && user.status === 'active') || null,
    [db.users, sessionUserId]
  );
  const currentUser = useMemo(() => safeUser(currentUserRecord), [currentUserRecord]);
  const isAdmin = currentUser?.role === 'admin';

  const login = useCallback(({ email, password }) => {
    const match = db.users.find((user) => normaliseEmail(user.email) === normaliseEmail(email));
    if (!match || match.password !== password) throw new Error('Incorrect email or password.');
    if (match.status === 'suspended') throw new Error('This account is suspended. Contact an administrator.');
    if (match.status === 'deleted') throw new Error('This account has been deleted.');
    writeSession(match.id);
    setSessionUserId(match.id);
    pushToast(`Welcome back, ${match.name.split(' ')[0]}.`);
    return safeUser(match);
  }, [db.users, pushToast]);

  const register = useCallback(({ name, email, password, location }) => {
    if (!name?.trim() || !email?.trim() || !password) throw new Error('Name, email and password are required.');
    if (password.length < 8) throw new Error('Password must contain at least 8 characters.');
    if (db.users.some((user) => normaliseEmail(user.email) === normaliseEmail(email) && user.status !== 'deleted')) {
      throw new Error('An account already exists with this email.');
    }

    const id = makeId('usr');
    const createdAt = nowIso();
    persist((next) => {
      next.users.push({
        id,
        name: name.trim(),
        email: normaliseEmail(email),
        password,
        role: 'user',
        status: 'active',
        tokenBalance: 100,
        heldTokenBalance: 0,
        joinedAt: createdAt,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=dcfce7&color=166534&bold=true`,
        location: location?.trim() || 'United Kingdom',
        bio: '',
        favourites: [],
        blockedUserIds: [],
        completedTrades: 0,
        notificationPreferences: { messages: true, orders: true, tokens: true, announcements: true }
      });
      addTransaction(next, {
        userId: id,
        type: 'signup_reward',
        amount: 100,
        balanceAfter: 100,
        heldAfter: 0,
        description: 'New account starter reward'
      });
      addNotification(next, {
        userId: id,
        type: 'tokens',
        title: 'You received 100 E-Tokens',
        body: 'Welcome to E-Swap 2.2. Your starter reward is ready to use.',
        link: '/wallet'
      });
      addAudit(next, id, 'USER_REGISTERED', `${name.trim()} created a local test account.`);
    });
    writeSession(id);
    setSessionUserId(id);
    pushToast('Account created. 100 E-Tokens added to your wallet.');
    return id;
  }, [db.users, persist, pushToast]);

  const logout = useCallback(() => {
    writeSession(null);
    setSessionUserId(null);
    pushToast('You have been logged out.', 'info');
  }, [pushToast]);

  const resetLocalPassword = useCallback(({ email, newPassword }) => {
    if (!email?.trim() || !newPassword) throw new Error('Email and new password are required.');
    if (newPassword.length < 8) throw new Error('Password must contain at least 8 characters.');
    const user = db.users.find((entry) => normaliseEmail(entry.email) === normaliseEmail(email) && entry.status !== 'deleted');
    if (!user) throw new Error('No active local account was found with that email.');
    persist((next) => {
      const target = next.users.find((entry) => entry.id === user.id);
      target.password = newPassword;
      addAudit(next, user.id, 'LOCAL_PASSWORD_RESET', `${user.email} reset the local test password.`);
    });
    pushToast('Local password updated. You can now log in.');
  }, [db.users, persist, pushToast]);

  const updateProfile = useCallback((updates) => {
    if (!sessionUserId) throw new Error('You must be logged in.');
    persist((next) => {
      const user = next.users.find((entry) => entry.id === sessionUserId);
      if (!user) throw new Error('User not found.');
      user.name = updates.name?.trim() || user.name;
      user.location = updates.location?.trim() || '';
      user.bio = updates.bio?.trim() || '';
      if (updates.avatar?.trim()) user.avatar = updates.avatar.trim();
      addAudit(next, sessionUserId, 'PROFILE_UPDATED', 'User updated profile information.');
    });
    pushToast('Profile updated.');
  }, [persist, pushToast, sessionUserId]);

  const updateNotificationPreferences = useCallback((preferences) => {
    if (!sessionUserId) throw new Error('You must be logged in.');
    persist((next) => {
      const user = next.users.find((entry) => entry.id === sessionUserId);
      user.notificationPreferences = { ...user.notificationPreferences, ...preferences };
      addAudit(next, sessionUserId, 'NOTIFICATION_PREFERENCES_UPDATED', 'User changed notification preferences.');
    });
    pushToast('Notification preferences saved.');
  }, [persist, pushToast, sessionUserId]);

  const deleteOwnAccount = useCallback(({ password, confirmation }) => {
    if (!sessionUserId) throw new Error('You must be logged in.');
    if (isAdmin) throw new Error('The primary administrator account cannot be deleted here.');
    if (confirmation !== 'DELETE') throw new Error('Type DELETE to confirm account deletion.');
    if (currentUserRecord?.password !== password) throw new Error('The password is incorrect.');
    const hasOpenOrder = db.orders.some((order) => (
      (order.buyerId === sessionUserId || order.sellerId === sessionUserId)
      && OPEN_ORDER_STATUSES.includes(order.status)
    ));
    if (hasOpenOrder) throw new Error('Complete or cancel your active orders before deleting your account.');

    persist((next) => {
      const user = next.users.find((entry) => entry.id === sessionUserId);
      user.status = 'deleted';
      user.deletedAt = nowIso();
      user.name = 'Deleted user';
      user.bio = '';
      next.items.forEach((item) => {
        if (item.ownerId === sessionUserId && item.status === 'active') item.status = 'hidden';
      });
      addAudit(next, sessionUserId, 'USER_DELETED_OWN_ACCOUNT', `${user.email} deleted their account.`);
    });
    writeSession(null);
    setSessionUserId(null);
    pushToast('Your account was deleted.', 'info');
  }, [currentUserRecord?.password, db.orders, isAdmin, persist, pushToast, sessionUserId]);

  const toggleFavourite = useCallback((itemId) => {
    if (!sessionUserId) throw new Error('Log in to save items.');
    persist((next) => {
      const user = next.users.find((entry) => entry.id === sessionUserId);
      user.favourites ||= [];
      user.favourites = user.favourites.includes(itemId)
        ? user.favourites.filter((id) => id !== itemId)
        : [...user.favourites, itemId];
    });
  }, [persist, sessionUserId]);

  const createItem = useCallback((values) => {
    if (!sessionUserId) throw new Error('Log in to create a listing.');
    const id = makeId('itm');
    persist((next) => {
      next.items.unshift({
        id,
        ownerId: sessionUserId,
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category,
        condition: values.condition,
        actionType: values.actionType,
        tokenPrice: Number(values.tokenPrice || 0),
        location: values.location.trim(),
        imageUrl: values.imageUrl.trim() || '/images/recycling-bin.jpg',
        status: 'active',
        createdAt: nowIso(),
        views: 0
      });
      addNotification(next, {
        userId: sessionUserId,
        type: 'listing',
        title: 'Your listing is live',
        body: `${values.title.trim()} is now visible in the marketplace.`,
        link: '/my-items'
      });
      addAudit(next, sessionUserId, 'LISTING_CREATED', `Created listing ${values.title.trim()}.`);
    });
    pushToast('Listing published.');
    return id;
  }, [persist, pushToast, sessionUserId]);

  const updateItem = useCallback((itemId, values) => {
    if (!sessionUserId) throw new Error('Log in to update a listing.');
    persist((next) => {
      const item = next.items.find((entry) => entry.id === itemId);
      if (!item) throw new Error('Listing not found.');
      if (item.ownerId !== sessionUserId && !isAdmin) throw new Error('You cannot edit this listing.');
      if (item.status !== 'active' && !isAdmin) throw new Error('Only active listings can be edited.');
      Object.assign(item, {
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category,
        condition: values.condition,
        actionType: values.actionType,
        tokenPrice: Number(values.tokenPrice || 0),
        location: values.location.trim(),
        imageUrl: values.imageUrl.trim() || item.imageUrl,
        updatedAt: nowIso()
      });
      addAudit(next, sessionUserId, 'LISTING_UPDATED', `Updated listing ${item.title}.`);
    });
    pushToast('Listing updated.');
  }, [isAdmin, persist, pushToast, sessionUserId]);

  const deleteItem = useCallback((itemId) => {
    if (!sessionUserId) throw new Error('Log in to delete a listing.');
    persist((next) => {
      const item = next.items.find((entry) => entry.id === itemId);
      if (!item) throw new Error('Listing not found.');
      if (item.ownerId !== sessionUserId && !isAdmin) throw new Error('You cannot delete this listing.');
      if (next.orders.some((order) => order.itemId === itemId && OPEN_ORDER_STATUSES.includes(order.status))) {
        throw new Error('This listing has an active order and cannot be deleted.');
      }
      item.status = 'deleted';
      item.deletedAt = nowIso();
      addAudit(next, sessionUserId, 'LISTING_DELETED', `Deleted listing ${item.title}.`);
    });
    pushToast('Listing deleted.', 'info');
  }, [isAdmin, persist, pushToast, sessionUserId]);

  const createOrder = useCallback((itemId) => {
    if (!sessionUserId) throw new Error('Log in before buying an item.');
    let result;
    persist((next) => {
      const item = next.items.find((entry) => entry.id === itemId);
      const buyer = next.users.find((entry) => entry.id === sessionUserId);
      const seller = next.users.find((entry) => entry.id === item?.ownerId);
      if (!item || item.status !== 'active') throw new Error('This item is no longer available.');
      if (item.actionType !== 'Buy') throw new Error('This listing is not available for direct token purchase.');
      if (item.ownerId === sessionUserId) throw new Error('You cannot buy your own listing.');
      if (!buyer || !seller || seller.status !== 'active') throw new Error('Buyer or seller is unavailable.');
      if (buyer.tokenBalance < item.tokenPrice) throw new Error('You do not have enough available E-Tokens.');
      if (buyer.blockedUserIds?.includes(seller.id) || seller.blockedUserIds?.includes(buyer.id)) throw new Error('This transaction cannot be started because one account has blocked the other.');

      buyer.tokenBalance -= item.tokenPrice;
      buyer.heldTokenBalance = Number(buyer.heldTokenBalance || 0) + item.tokenPrice;
      item.status = 'reserved';
      item.buyerId = buyer.id;

      const order = {
        id: makeId('ord'),
        itemId: item.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        tokenAmount: item.tokenPrice,
        status: 'pending_seller',
        escrowStatus: 'held',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        collectionNote: ''
      };
      next.orders.unshift(order);
      const conversation = getOrCreateConversation(next, {
        itemId: item.id,
        orderId: order.id,
        firstId: buyer.id,
        secondId: seller.id
      });
      order.conversationId = conversation.id;
      addSystemMessage(next, conversation.id, `${buyer.name} placed an order for ${item.title}. ${item.tokenPrice} E-Tokens are now protected in escrow.`);

      addTransaction(next, {
        userId: buyer.id,
        type: 'purchase_hold',
        amount: -item.tokenPrice,
        balanceAfter: buyer.tokenBalance,
        heldAfter: buyer.heldTokenBalance,
        description: `Escrow hold for ${item.title}`,
        itemId: item.id,
        orderId: order.id,
        relatedUserId: seller.id
      });
      addNotification(next, {
        userId: buyer.id,
        type: 'order',
        title: 'Tokens protected in escrow',
        body: `${item.tokenPrice} E-Tokens are held while ${seller.name} reviews your order.`,
        link: '/orders'
      });
      addNotification(next, {
        userId: seller.id,
        type: 'sale',
        title: 'New order to review',
        body: `${buyer.name} wants to buy ${item.title} for ${item.tokenPrice} E-Tokens.`,
        link: '/orders'
      });
      addAudit(next, buyer.id, 'ORDER_CREATED', `${buyer.email} started order ${order.id} for ${item.title}.`, { orderId: order.id });
      result = { orderId: order.id, conversationId: conversation.id };
    });
    pushToast('Order created. Your E-Tokens are protected in escrow.');
    return result;
  }, [persist, pushToast, sessionUserId]);

  const acceptOrder = useCallback((orderId, collectionNote = '') => {
    persist((next) => {
      const order = next.orders.find((entry) => entry.id === orderId);
      if (!order || order.sellerId !== sessionUserId) throw new Error('Order not found.');
      if (order.status !== 'pending_seller') throw new Error('This order cannot be accepted now.');
      order.status = 'awaiting_collection';
      order.acceptedAt = nowIso();
      order.updatedAt = nowIso();
      order.collectionNote = collectionNote.trim();
      const item = next.items.find((entry) => entry.id === order.itemId);
      addSystemMessage(next, order.conversationId, `Seller accepted the order.${order.collectionNote ? ` Collection note: ${order.collectionNote}` : ''}`);
      addNotification(next, { userId: order.buyerId, type: 'order', title: 'Seller accepted your order', body: `Arrange collection for ${item?.title || 'your item'} with the seller.`, link: '/orders' });
      addAudit(next, sessionUserId, 'ORDER_ACCEPTED', `Accepted order ${order.id}.`, { orderId });
    });
    pushToast('Order accepted. Arrange collection with the buyer.');
  }, [persist, pushToast, sessionUserId]);

  const rejectOrder = useCallback((orderId, reason = 'Seller declined the order.') => {
    persist((next) => {
      const order = next.orders.find((entry) => entry.id === orderId);
      if (!order || order.sellerId !== sessionUserId) throw new Error('Order not found.');
      if (order.status !== 'pending_seller') throw new Error('This order cannot be rejected now.');
      refundEscrow(next, order, {
        finalStatus: 'rejected',
        reason,
        actorId: sessionUserId,
        source: 'seller_rejection'
      });
      addNotification(next, { userId: order.buyerId, type: 'order', title: 'Order declined and refunded', body: `${order.tokenAmount} E-Tokens were returned to your available balance.`, link: '/wallet' });
      addAudit(next, sessionUserId, 'ORDER_REJECTED', `Rejected order ${order.id}. Reason: ${reason}`, { orderId });
    });
    pushToast('Order rejected and the buyer was refunded.', 'info');
  }, [persist, pushToast, sessionUserId]);

  const cancelOrder = useCallback((orderId) => {
    persist((next) => {
      const order = next.orders.find((entry) => entry.id === orderId);
      if (!order || order.buyerId !== sessionUserId) throw new Error('Order not found.');
      if (order.status !== 'pending_seller') throw new Error('Only an order waiting for the seller can be cancelled.');
      refundEscrow(next, order, {
        finalStatus: 'cancelled',
        reason: 'Buyer cancelled before seller acceptance.',
        actorId: sessionUserId,
        source: 'buyer_cancellation'
      });
      addNotification(next, { userId: order.sellerId, type: 'order', title: 'Order cancelled', body: 'The buyer cancelled before you accepted the order.', link: '/orders' });
      addAudit(next, sessionUserId, 'ORDER_CANCELLED', `Cancelled order ${order.id}.`, { orderId });
    });
    pushToast('Order cancelled and your tokens were refunded.', 'info');
  }, [persist, pushToast, sessionUserId]);

  const markOrderReady = useCallback((orderId, collectionNote = '') => {
    persist((next) => {
      const order = next.orders.find((entry) => entry.id === orderId);
      if (!order || order.sellerId !== sessionUserId) throw new Error('Order not found.');
      if (order.status !== 'awaiting_collection') throw new Error('This order cannot be marked ready now.');
      order.status = 'ready_for_collection';
      order.readyAt = nowIso();
      order.updatedAt = nowIso();
      if (collectionNote.trim()) order.collectionNote = collectionNote.trim();
      const item = next.items.find((entry) => entry.id === order.itemId);
      addSystemMessage(next, order.conversationId, `The item is ready for collection.${order.collectionNote ? ` ${order.collectionNote}` : ''}`);
      addNotification(next, { userId: order.buyerId, type: 'order', title: 'Item ready for collection', body: `${item?.title || 'Your item'} is ready. Check it before confirming receipt.`, link: '/orders' });
      addAudit(next, sessionUserId, 'ORDER_READY', `Marked order ${order.id} ready.`, { orderId });
    });
    pushToast('Buyer notified that the item is ready.');
  }, [persist, pushToast, sessionUserId]);

  const confirmOrderReceived = useCallback((orderId) => {
    persist((next) => {
      const order = next.orders.find((entry) => entry.id === orderId);
      if (!order || order.buyerId !== sessionUserId) throw new Error('Order not found.');
      if (!['awaiting_collection', 'ready_for_collection'].includes(order.status)) throw new Error('This order cannot be completed now.');
      releaseEscrow(next, order, {
        reason: 'Buyer confirmed the item was received and matched the order.',
        actorId: sessionUserId,
        source: 'buyer_confirmation'
      });
      const item = next.items.find((entry) => entry.id === order.itemId);
      addNotification(next, { userId: order.sellerId, type: 'sale', title: 'Tokens released', body: `${order.tokenAmount} E-Tokens from ${item?.title || 'the sale'} are now available.`, link: '/wallet' });
      addNotification(next, { userId: order.buyerId, type: 'review', title: 'Order completed', body: 'Leave a review to help build trust in the community.', link: '/orders' });
      addAudit(next, sessionUserId, 'ORDER_COMPLETED', `Buyer confirmed order ${order.id}.`, { orderId });
    });
    pushToast('Order completed. Tokens released to the seller.');
  }, [persist, pushToast, sessionUserId]);

  const raiseDispute = useCallback((orderId, reason) => {
    if (!reason?.trim()) throw new Error('Explain why you are opening a dispute.');
    persist((next) => {
      const order = next.orders.find((entry) => entry.id === orderId);
      if (!order || ![order.buyerId, order.sellerId].includes(sessionUserId)) throw new Error('Order not found.');
      if (!['awaiting_collection', 'ready_for_collection'].includes(order.status)) throw new Error('This order cannot be disputed now.');
      order.status = 'disputed';
      order.dispute = { openedBy: sessionUserId, reason: reason.trim(), openedAt: nowIso() };
      order.updatedAt = nowIso();
      addSystemMessage(next, order.conversationId, `A dispute was opened: ${reason.trim()}`);
      addNotification(next, { userId: order.buyerId === sessionUserId ? order.sellerId : order.buyerId, type: 'dispute', title: 'Order dispute opened', body: reason.trim(), link: '/orders' });
      addNotification(next, { userId: 'usr-admin', type: 'dispute', title: 'Disputed order requires review', body: `Order ${order.id}: ${reason.trim()}`, link: '/admin' });
      addAudit(next, sessionUserId, 'ORDER_DISPUTED', `Opened dispute on ${order.id}: ${reason.trim()}`, { orderId });
    });
    pushToast('Dispute opened for administrator review.', 'info');
  }, [persist, pushToast, sessionUserId]);

  const leaveReview = useCallback(({ orderId, rating, comment }) => {
    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) throw new Error('Choose a rating from 1 to 5.');
    persist((next) => {
      const order = next.orders.find((entry) => entry.id === orderId);
      if (!order || order.status !== 'completed' || ![order.buyerId, order.sellerId].includes(sessionUserId)) throw new Error('This order cannot be reviewed.');
      if (next.reviews.some((review) => review.orderId === orderId && review.reviewerId === sessionUserId)) throw new Error('You already reviewed this order.');
      const targetUserId = order.buyerId === sessionUserId ? order.sellerId : order.buyerId;
      next.reviews.unshift({ id: makeId('rev'), orderId, reviewerId: sessionUserId, targetUserId, rating: numericRating, comment: comment?.trim() || '', createdAt: nowIso() });
      addNotification(next, { userId: targetUserId, type: 'review', title: 'You received a new review', body: `${numericRating} out of 5 stars`, link: '/profile' });
      addAudit(next, sessionUserId, 'REVIEW_CREATED', `Left ${numericRating}-star review for order ${orderId}.`, { orderId });
    });
    pushToast('Review published.');
  }, [persist, pushToast, sessionUserId]);

  const startConversation = useCallback(({ itemId, recipientId, message }) => {
    if (!sessionUserId) throw new Error('Log in to send a message.');
    if (recipientId === sessionUserId) throw new Error('You cannot message yourself.');
    let conversationId;
    persist((next) => {
      const sender = next.users.find((entry) => entry.id === sessionUserId);
      const recipient = next.users.find((entry) => entry.id === recipientId && entry.status === 'active');
      if (!recipient) throw new Error('The recipient is unavailable.');
      if (sender.blockedUserIds?.includes(recipientId) || recipient.blockedUserIds?.includes(sessionUserId)) throw new Error('Messaging is unavailable between these accounts.');
      const conversation = getOrCreateConversation(next, { itemId, firstId: sessionUserId, secondId: recipientId });
      const body = message?.trim() || 'Hi, is this item still available?';
      next.messages.push({ id: makeId('msg'), conversationId: conversation.id, senderId: sessionUserId, body, createdAt: nowIso(), readBy: [sessionUserId] });
      conversation.updatedAt = nowIso();
      addNotification(next, { userId: recipientId, type: 'message', title: `New message from ${sender?.name || 'an E-Swap user'}`, body, link: `/messages?conversation=${conversation.id}` });
      conversationId = conversation.id;
    });
    pushToast('Message sent.');
    return conversationId;
  }, [persist, pushToast, sessionUserId]);

  const sendMessage = useCallback((conversationId, body) => {
    if (!sessionUserId) throw new Error('Log in to send a message.');
    if (!body?.trim()) return;
    persist((next) => {
      const conversation = next.conversations.find((entry) => entry.id === conversationId);
      if (!conversation || !conversation.participantIds.includes(sessionUserId)) throw new Error('Conversation not found.');
      const recipientId = conversation.participantIds.find((id) => id !== sessionUserId);
      const sender = next.users.find((entry) => entry.id === sessionUserId);
      const recipient = next.users.find((entry) => entry.id === recipientId);
      if (sender.blockedUserIds?.includes(recipientId) || recipient?.blockedUserIds?.includes(sessionUserId)) throw new Error('Messaging is unavailable because one account has blocked the other.');
      if (recipient?.status !== 'active') throw new Error('This user is unavailable.');
      next.messages.push({ id: makeId('msg'), conversationId, senderId: sessionUserId, body: body.trim(), createdAt: nowIso(), readBy: [sessionUserId] });
      conversation.updatedAt = nowIso();
      addNotification(next, { userId: recipientId, type: 'message', title: `New message from ${sender?.name || 'an E-Swap user'}`, body: body.trim(), link: `/messages?conversation=${conversationId}` });
    });
  }, [persist, sessionUserId]);

  const toggleBlockUser = useCallback((userId) => {
    if (!sessionUserId || userId === sessionUserId) throw new Error('This user cannot be blocked.');
    let blocked;
    persist((next) => {
      const user = next.users.find((entry) => entry.id === sessionUserId);
      const target = next.users.find((entry) => entry.id === userId);
      if (!target || target.role === 'admin') throw new Error('This user cannot be blocked.');
      user.blockedUserIds ||= [];
      blocked = !user.blockedUserIds.includes(userId);
      user.blockedUserIds = blocked ? [...user.blockedUserIds, userId] : user.blockedUserIds.filter((id) => id !== userId);
      addAudit(next, sessionUserId, blocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED', `${target.email} was ${blocked ? 'blocked' : 'unblocked'}.`);
    });
    pushToast(blocked ? 'User blocked. They can no longer message you.' : 'User unblocked.', 'info');
    return blocked;
  }, [persist, pushToast, sessionUserId]);

  const markConversationRead = useCallback((conversationId) => {
    if (!sessionUserId) return;
    persist((next) => {
      next.messages.forEach((message) => {
        if (message.conversationId === conversationId && !message.readBy.includes(sessionUserId)) message.readBy.push(sessionUserId);
      });
    });
  }, [persist, sessionUserId]);

  const markNotificationRead = useCallback((notificationId) => {
    if (!sessionUserId) return;
    persist((next) => {
      const notification = next.notifications.find((entry) => entry.id === notificationId && entry.userId === sessionUserId);
      if (notification) notification.read = true;
    });
  }, [persist, sessionUserId]);

  const markAllNotificationsRead = useCallback(() => {
    if (!sessionUserId) return;
    persist((next) => {
      next.notifications.forEach((notification) => {
        if (notification.userId === sessionUserId) notification.read = true;
      });
    });
    pushToast('All notifications marked as read.', 'info');
  }, [persist, pushToast, sessionUserId]);

  const reportItem = useCallback(({ itemId, reason, details }) => {
    if (!sessionUserId) throw new Error('Log in to report a listing.');
    persist((next) => {
      if (next.reports.some((report) => report.targetType === 'listing' && report.targetId === itemId && report.reporterId === sessionUserId && report.status === 'pending')) throw new Error('You have already reported this listing.');
      next.reports.unshift({ id: makeId('rpt'), targetType: 'listing', targetId: itemId, itemId, reporterId: sessionUserId, reason, details: details?.trim() || '', status: 'pending', createdAt: nowIso() });
      addAudit(next, sessionUserId, 'LISTING_REPORTED', `Reported listing ${itemId}: ${reason}.`);
    });
    pushToast('Report submitted for administrator review.');
  }, [persist, pushToast, sessionUserId]);

  const reportUser = useCallback(({ userId, reason, details }) => {
    if (!sessionUserId) throw new Error('Log in to report a user.');
    if (userId === sessionUserId) throw new Error('You cannot report yourself.');
    persist((next) => {
      if (next.reports.some((report) => report.targetType === 'user' && report.targetId === userId && report.reporterId === sessionUserId && report.status === 'pending')) throw new Error('You have already reported this user.');
      next.reports.unshift({ id: makeId('rpt'), targetType: 'user', targetId: userId, reporterId: sessionUserId, reason, details: details?.trim() || '', status: 'pending', createdAt: nowIso() });
      addAudit(next, sessionUserId, 'USER_REPORTED', `Reported user ${userId}: ${reason}.`);
    });
    pushToast('User report submitted for administrator review.');
  }, [persist, pushToast, sessionUserId]);

  const createRecyclingRequest = useCallback((values) => {
    if (!sessionUserId || isAdmin) throw new Error('A user account is required to submit a recycling request.');
    if (!values.deviceType?.trim() || !values.brandModel?.trim() || !values.condition?.trim() || !values.location?.trim()) {
      throw new Error('Device type, brand/model, condition and location are required.');
    }
    const quantity = Number(values.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Quantity must be between 1 and 20.');
    const requestId = makeId('rec');
    persist((next) => {
      next.recyclingRequests ||= [];
      const requester = next.users.find((entry) => entry.id === sessionUserId);
      const admin = next.users.find((entry) => entry.role === 'admin' && entry.status === 'active');
      if (!requester || !admin) throw new Error('The recycling team is unavailable.');
      const createdAt = nowIso();
      const conversation = {
        id: makeId('cnv'),
        participantIds: [sessionUserId, admin.id],
        itemId: null,
        orderId: null,
        recyclingRequestId: requestId,
        subject: `Recycling request · ${values.brandModel.trim()}`,
        createdAt,
        updatedAt: createdAt
      };
      next.conversations.unshift(conversation);
      const request = {
        id: requestId,
        requesterId: sessionUserId,
        deviceType: values.deviceType.trim(),
        brandModel: values.brandModel.trim(),
        condition: values.condition.trim(),
        quantity,
        location: values.location.trim(),
        preferredDate: values.preferredDate || '',
        imageUrl: values.imageUrl?.trim() || '/images/recycling-bin.jpg',
        notes: values.notes?.trim() || '',
        status: 'submitted',
        createdAt,
        updatedAt: createdAt,
        conversationId: conversation.id,
        history: [{
          status: 'submitted',
          actorId: sessionUserId,
          reason: 'Recycling request submitted for administrator review.',
          createdAt
        }]
      };
      next.recyclingRequests.unshift(request);
      addSystemMessage(next, conversation.id, 'Recycling request submitted. An administrator will review the device details.');
      if (request.notes) {
        next.messages.push({
          id: makeId('msg'),
          conversationId: conversation.id,
          senderId: sessionUserId,
          body: request.notes,
          createdAt,
          readBy: [sessionUserId]
        });
      }
      addNotification(next, {
        userId: admin.id,
        type: 'recycling',
        title: 'New recycling request',
        body: `${requester.name} submitted ${quantity} × ${request.brandModel}.`,
        link: `/admin?tab=recycling&request=${requestId}`
      });
      addAudit(next, sessionUserId, 'RECYCLING_REQUEST_SUBMITTED', `${requester.email} submitted ${requestId} for ${quantity} × ${request.brandModel}.`, {
        recyclingRequestId: requestId,
        requesterId: sessionUserId,
        status: 'submitted'
      });
    });
    pushToast('Recycling request submitted for administrator review.');
    return requestId;
  }, [isAdmin, persist, pushToast, sessionUserId]);

  const adminAdjustTokens = useCallback(({ userId, amount, reason }) => {
    if (!isAdmin) throw new Error('Administrator access required.');
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount === 0) throw new Error('Enter a non-zero token amount.');
    if (!reason?.trim()) throw new Error('A reason is required for every token adjustment.');
    persist((next) => {
      const user = next.users.find((entry) => entry.id === userId && entry.status !== 'deleted');
      if (!user) throw new Error('User not found.');
      if (user.tokenBalance + numericAmount < 0) throw new Error('This adjustment would make the available balance negative.');
      const before = user.tokenBalance;
      user.tokenBalance += numericAmount;
      addTransaction(next, { userId, type: 'admin_adjustment', amount: numericAmount, balanceAfter: user.tokenBalance, heldAfter: user.heldTokenBalance || 0, description: reason.trim(), relatedUserId: sessionUserId });
      addNotification(next, { userId, type: 'tokens', title: numericAmount > 0 ? `${numericAmount} E-Tokens added` : `${Math.abs(numericAmount)} E-Tokens removed`, body: reason.trim(), link: '/wallet' });
      addAudit(next, sessionUserId, 'TOKENS_ADJUSTED', `${numericAmount} tokens adjusted for ${user.email}. Reason: ${reason.trim()}.`, { userId, before, after: user.tokenBalance });
    });
    pushToast('Token balance updated.');
  }, [isAdmin, persist, pushToast, sessionUserId]);

  const adminSetUserStatus = useCallback((userId, status, reason = '') => {
    if (!isAdmin) throw new Error('Administrator access required.');
    persist((next) => {
      const user = next.users.find((entry) => entry.id === userId);
      if (!user || user.role === 'admin') throw new Error('This user cannot be modified.');
      user.status = status;
      addNotification(next, { userId, type: 'account', title: status === 'active' ? 'Account reactivated' : 'Account suspended', body: reason.trim() || (status === 'active' ? 'Your E-Swap account is active again.' : 'Your account was suspended by an administrator.'), link: '/profile' });
      addAudit(next, sessionUserId, 'USER_STATUS_CHANGED', `${user.email} status changed to ${status}. Reason: ${reason || 'Not supplied'}.`, { userId, status });
    });
    pushToast(`User ${status === 'active' ? 'activated' : 'suspended'}.`);
  }, [isAdmin, persist, pushToast, sessionUserId]);

  const adminDeleteUser = useCallback((userId) => {
    if (!isAdmin) throw new Error('Administrator access required.');
    persist((next) => {
      const user = next.users.find((entry) => entry.id === userId);
      if (!user || user.role === 'admin') throw new Error('This user cannot be deleted.');
      next.orders.filter((order) => OPEN_ORDER_STATUSES.includes(order.status) && [order.buyerId, order.sellerId].includes(userId)).forEach((order) => {
        refundEscrow(next, order, {
          finalStatus: 'refunded',
          reason: 'Order refunded because an account was removed by an administrator.',
          actorId: sessionUserId,
          source: 'admin_account_deletion'
        });
      });
      user.status = 'deleted';
      user.deletedAt = nowIso();
      user.name = 'Deleted user';
      next.items.forEach((item) => {
        if (item.ownerId === userId && ['active', 'reserved'].includes(item.status)) item.status = 'hidden';
      });
      addAudit(next, sessionUserId, 'USER_DELETED_BY_ADMIN', `${user.email} was deleted by an administrator.`, { userId });
    });
    pushToast('User account deleted.', 'info');
  }, [isAdmin, persist, pushToast, sessionUserId]);

  const adminModerateItem = useCallback((itemId, status) => {
    if (!isAdmin) throw new Error('Administrator access required.');
    persist((next) => {
      const item = next.items.find((entry) => entry.id === itemId);
      if (!item) throw new Error('Listing not found.');
      if (next.orders.some((order) => order.itemId === itemId && OPEN_ORDER_STATUSES.includes(order.status)) && status === 'deleted') throw new Error('Resolve the active order before deleting this listing.');
      item.status = status;
      const owner = next.users.find((entry) => entry.id === item.ownerId);
      if (owner) addNotification(next, { userId: owner.id, type: 'moderation', title: 'Listing status changed', body: `${item.title} is now ${status}.`, link: '/my-items' });
      addAudit(next, sessionUserId, 'LISTING_MODERATED', `${item.title} status changed to ${status}.`, { itemId, status });
    });
    pushToast(`Listing changed to ${status}.`);
  }, [isAdmin, persist, pushToast, sessionUserId]);

  const adminResolveReport = useCallback((reportId, resolution) => {
    if (!isAdmin) throw new Error('Administrator access required.');
    persist((next) => {
      const report = next.reports.find((entry) => entry.id === reportId);
      if (!report) throw new Error('Report not found.');
      report.status = resolution;
      report.resolvedAt = nowIso();
      report.resolvedBy = sessionUserId;
      addAudit(next, sessionUserId, 'REPORT_RESOLVED', `Report ${reportId} changed to ${resolution}.`, { reportId, resolution });
    });
    pushToast('Report updated.');
  }, [isAdmin, persist, pushToast, sessionUserId]);

  const adminProcessEscrow = useCallback((orderId, outcome, reason) => {
    if (!isAdmin) throw new Error('Administrator access required.');
    if (!reason?.trim()) throw new Error('A reason is mandatory for every escrow release or refund.');
    if (!['release', 'refund'].includes(outcome)) throw new Error('Choose release or refund.');
    persist((next) => {
      const order = next.orders.find((entry) => entry.id === orderId);
      if (!order) throw new Error('Order not found.');
      if (order.escrowStatus !== 'held') throw new Error('Escrow has already been processed. Duplicate token release or refund was blocked.');
      const escrowBefore = order.escrowStatus;
      const statusBefore = order.status;
      if (outcome === 'release') {
        releaseEscrow(next, order, {
          reason: reason.trim(),
          actorId: sessionUserId,
          source: 'admin_escrow_control'
        });
      } else {
        refundEscrow(next, order, {
          finalStatus: 'refunded',
          reason: reason.trim(),
          actorId: sessionUserId,
          source: 'admin_escrow_control'
        });
      }
      if (statusBefore === 'disputed') {
        order.disputeResolution = {
          outcome: outcome === 'release' ? 'released_to_seller' : 'refunded_to_buyer',
          note: reason.trim(),
          resolvedBy: sessionUserId,
          resolvedAt: order.escrowDecision.processedAt
        };
      }
      const title = outcome === 'release' ? 'Escrow released to seller' : 'Escrow refunded to buyer';
      addNotification(next, { userId: order.buyerId, type: 'dispute', title, body: reason.trim(), link: '/orders' });
      addNotification(next, { userId: order.sellerId, type: 'dispute', title, body: reason.trim(), link: '/orders' });
      addAudit(
        next,
        sessionUserId,
        outcome === 'release' ? 'ADMIN_ESCROW_RELEASED' : 'ADMIN_ESCROW_REFUNDED',
        `${order.id}: ${order.tokenAmount} E-Tokens ${outcome === 'release' ? 'released to the seller' : 'refunded to the buyer'}. Mandatory reason: ${reason.trim()}`,
        {
          orderId: order.id,
          itemId: order.itemId,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
          tokenAmount: order.tokenAmount,
          statusBefore,
          statusAfter: order.status,
          escrowBefore,
          escrowAfter: order.escrowStatus,
          outcome,
          reason: reason.trim(),
          processedAt: order.escrowDecision.processedAt
        }
      );
    });
    pushToast(outcome === 'release' ? 'Escrow released to the seller.' : 'Escrow refunded to the buyer.');
  }, [isAdmin, persist, pushToast, sessionUserId]);

  const adminUpdateRecyclingRequest = useCallback((requestId, status, reason) => {
    if (!isAdmin) throw new Error('Administrator access required.');
    if (!reason?.trim()) throw new Error('A reason or processing note is mandatory.');
    if (!['approved', 'rejected', 'completed'].includes(status)) throw new Error('Choose a valid recycling status.');
    persist((next) => {
      const request = next.recyclingRequests?.find((entry) => entry.id === requestId);
      if (!request) throw new Error('Recycling request not found.');
      const transitions = {
        submitted: ['approved', 'rejected'],
        approved: ['completed', 'rejected'],
        rejected: [],
        completed: []
      };
      if (!transitions[request.status]?.includes(status)) {
        throw new Error(`A ${request.status} recycling request cannot be changed to ${status}.`);
      }
      const fromStatus = request.status;
      const processedAt = nowIso();
      request.status = status;
      request.updatedAt = processedAt;
      request.adminReason = reason.trim();
      request[`${status}At`] = processedAt;
      request.history ||= [];
      request.history.push({
        status,
        actorId: sessionUserId,
        reason: reason.trim(),
        createdAt: processedAt
      });
      if (request.conversationId) {
        addSystemMessage(next, request.conversationId, `Recycling request ${status}. Administrator note: ${reason.trim()}`);
      }
      addNotification(next, {
        userId: request.requesterId,
        type: 'recycling',
        title: `Recycling request ${status}`,
        body: reason.trim(),
        link: '/recycling'
      });
      addAudit(next, sessionUserId, `RECYCLING_REQUEST_${status.toUpperCase()}`, `${request.id} changed from ${fromStatus} to ${status}. Reason: ${reason.trim()}`, {
        recyclingRequestId: request.id,
        requesterId: request.requesterId,
        fromStatus,
        toStatus: status,
        reason: reason.trim(),
        processedAt
      });
    });
    pushToast(`Recycling request marked ${status}.`);
  }, [isAdmin, persist, pushToast, sessionUserId]);

  const adminResolveDispute = useCallback((orderId, outcome, note) => {
    if (!isAdmin) throw new Error('Administrator access required.');
    if (!note?.trim()) throw new Error('Add an administrator resolution note.');
    persist((next) => {
      const order = next.orders.find((entry) => entry.id === orderId);
      if (!order || order.status !== 'disputed') throw new Error('Disputed order not found.');
      if (outcome === 'release') {
        releaseEscrow(next, order, {
          reason: note.trim(),
          actorId: sessionUserId,
          source: 'admin_dispute_resolution'
        });
        order.disputeResolution = { outcome: 'released_to_seller', note: note.trim(), resolvedBy: sessionUserId, resolvedAt: nowIso() };
      } else if (outcome === 'refund') {
        refundEscrow(next, order, {
          finalStatus: 'refunded',
          reason: note.trim(),
          actorId: sessionUserId,
          source: 'admin_dispute_resolution'
        });
        order.disputeResolution = { outcome: 'refunded_to_buyer', note: note.trim(), resolvedBy: sessionUserId, resolvedAt: nowIso() };
      } else {
        throw new Error('Choose a valid dispute outcome.');
      }
      addNotification(next, { userId: order.buyerId, type: 'dispute', title: 'Dispute resolved', body: note.trim(), link: '/orders' });
      addNotification(next, { userId: order.sellerId, type: 'dispute', title: 'Dispute resolved', body: note.trim(), link: '/orders' });
      addAudit(next, sessionUserId, 'DISPUTE_RESOLVED', `${order.id} resolved: ${outcome}. ${note.trim()}`, { orderId, outcome });
    });
    pushToast('Dispute resolved.');
  }, [isAdmin, persist, pushToast, sessionUserId]);

  const adminBroadcast = useCallback(({ title, body }) => {
    if (!isAdmin) throw new Error('Administrator access required.');
    if (!title?.trim() || !body?.trim()) throw new Error('Title and message are required.');
    persist((next) => {
      next.users.filter((user) => user.role === 'user' && user.status === 'active').forEach((user) => {
        addNotification(next, { userId: user.id, type: 'announcement', title: title.trim(), body: body.trim(), link: '/notifications' });
      });
      addAudit(next, sessionUserId, 'ANNOUNCEMENT_SENT', `Broadcast: ${title.trim()}.`);
    });
    pushToast('Announcement sent to all active users.');
  }, [isAdmin, persist, pushToast, sessionUserId]);

  const resetDemo = useCallback(() => {
    resetLocalDatabase();
    const seeded = readDatabase();
    setDb(seeded);
    setSessionUserId(null);
    pushToast('Local demo data reset.', 'info');
  }, [pushToast]);

  const userNotifications = useMemo(
    () => db.notifications.filter((notification) => notification.userId === sessionUserId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.notifications, sessionUserId]
  );
  const userTransactions = useMemo(
    () => db.transactions.filter((transaction) => transaction.userId === sessionUserId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.transactions, sessionUserId]
  );
  const userConversations = useMemo(
    () => db.conversations.filter((conversation) => conversation.participantIds.includes(sessionUserId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [db.conversations, sessionUserId]
  );
  const userOrders = useMemo(
    () => db.orders.filter((order) => order.buyerId === sessionUserId || order.sellerId === sessionUserId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [db.orders, sessionUserId]
  );
  const userRecyclingRequests = useMemo(
    () => (db.recyclingRequests || []).filter((request) => request.requesterId === sessionUserId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [db.recyclingRequests, sessionUserId]
  );
  const unreadNotificationCount = userNotifications.filter((notification) => !notification.read).length;
  const unreadMessageCount = useMemo(() => db.messages.filter((message) => {
    const conversation = db.conversations.find((entry) => entry.id === message.conversationId);
    return conversation?.participantIds.includes(sessionUserId) && message.senderId !== sessionUserId && !message.readBy.includes(sessionUserId);
  }).length, [db.conversations, db.messages, sessionUserId]);
  const openOrderCount = userOrders.filter((order) => OPEN_ORDER_STATUSES.includes(order.status)).length;

  const value = useMemo(() => ({
    db,
    currentUser,
    currentUserRecord,
    isAuthenticated: Boolean(currentUser),
    isAdmin,
    isLoading: false,
    storageMode: 'local',
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
    logout,
    resetLocalPassword,
    updateProfile,
    updateNotificationPreferences,
    deleteOwnAccount,
    toggleFavourite,
    createItem,
    updateItem,
    deleteItem,
    createOrder,
    buyItem: createOrder,
    acceptOrder,
    rejectOrder,
    cancelOrder,
    markOrderReady,
    confirmOrderReceived,
    raiseDispute,
    leaveReview,
    startConversation,
    sendMessage,
    toggleBlockUser,
    markConversationRead,
    markNotificationRead,
    markAllNotificationsRead,
    reportItem,
    reportUser,
    createRecyclingRequest,
    adminAdjustTokens,
    adminSetUserStatus,
    adminDeleteUser,
    adminModerateItem,
    adminResolveReport,
    adminProcessEscrow,
    adminUpdateRecyclingRequest,
    adminResolveDispute,
    adminBroadcast,
    resetDemo,
    pushToast,
    dismissToast
  }), [
    acceptOrder, adminAdjustTokens, adminBroadcast, adminDeleteUser, adminModerateItem,
    adminProcessEscrow, adminResolveDispute, adminResolveReport, adminSetUserStatus,
    adminUpdateRecyclingRequest, cancelOrder, confirmOrderReceived, createItem, createOrder,
    createRecyclingRequest, currentUser, currentUserRecord, db, deleteItem, deleteOwnAccount,
    dismissToast, isAdmin, leaveReview, login, logout, markAllNotificationsRead,
    markConversationRead, markNotificationRead, markOrderReady, openOrderCount, pushToast,
    raiseDispute, register, rejectOrder, reportItem, reportUser, resetDemo, resetLocalPassword,
    sendMessage, startConversation, toasts, toggleBlockUser, toggleFavourite, unreadMessageCount,
    unreadNotificationCount, updateItem, updateNotificationPreferences, updateProfile,
    userConversations, userNotifications, userOrders, userRecyclingRequests, userTransactions
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function StoreProvider({ children }) {
  const useAws = import.meta.env.VITE_STORAGE_MODE === 'aws' && Boolean(import.meta.env.VITE_API_URL);
  return useAws
    ? <AwsStoreProvider>{children}</AwsStoreProvider>
    : <LocalStoreProvider>{children}</LocalStoreProvider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider.');
  return value;
}
