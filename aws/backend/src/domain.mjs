import { randomUUID } from 'node:crypto';

const OPEN_ORDER_STATUSES = ['pending_seller', 'awaiting_collection', 'ready_for_collection', 'disputed'];
const COLLECTIONS = [
  'users', 'items', 'orders', 'recyclingRequests', 'conversations', 'messages',
  'notifications', 'transactions', 'reviews', 'reports', 'auditLog'
];

export function nowIso() {
  return new Date().toISOString();
}

export function makeId(prefix = 'id') {
  return `${prefix}-${randomUUID()}`;
}

export function normaliseEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function safeUser(user) {
  if (!user) return null;
  const {
    password: _password,
    passwordHash: _passwordHash,
    passwordSalt: _passwordSalt,
    ...rest
  } = user;
  return rest;
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    status: user.status,
    avatar: user.avatar,
    location: user.location,
    bio: user.bio,
    joinedAt: user.joinedAt,
    completedTrades: Number(user.completedTrades || 0)
  };
}

export function publicReview(review) {
  if (!review) return null;
  return {
    id: review.id,
    reviewerId: review.reviewerId,
    targetUserId: review.targetUserId,
    rating: Number(review.rating || 0),
    comment: review.comment || '',
    createdAt: review.createdAt
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function requireActor(state, actorId) {
  const actor = state.users.find((user) => user.id === actorId && user.status === 'active');
  if (!actor) throw new Error('Authentication required.');
  return actor;
}

function requireAdmin(state, actorId) {
  const actor = requireActor(state, actorId);
  if (actor.role !== 'admin') throw new Error('Administrator access required.');
  return actor;
}

function activeAdmin(state) {
  return state.users.find((user) => (
    user.role === 'admin' && user.status === 'active' && user.cognitoSub
  )) || state.users.find((user) => user.role === 'admin' && user.status === 'active');
}

function notificationPreference(type) {
  if (type === 'message') return 'messages';
  if (['purchase', 'sale', 'order', 'dispute', 'review', 'recycling'].includes(type)) return 'orders';
  if (type === 'tokens') return 'tokens';
  if (type === 'announcement') return 'announcements';
  return null;
}

function addNotification(state, { userId, type, title, body, link = '/notifications' }) {
  const user = state.users.find((entry) => entry.id === userId);
  const preference = notificationPreference(type);
  if (preference && user?.notificationPreferences?.[preference] === false) return;
  state.notifications.unshift({
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

function addAudit(state, actorId, action, details, metadata = {}) {
  state.auditLog.unshift({
    id: makeId('audit'),
    actorId,
    action,
    details,
    metadata,
    createdAt: nowIso()
  });
}

function addTransaction(state, transaction) {
  state.transactions.unshift({
    id: makeId('tx'),
    createdAt: nowIso(),
    ...transaction
  });
}

function addSystemMessage(state, conversationId, body) {
  state.messages.push({
    id: makeId('msg'),
    conversationId,
    senderId: 'system',
    body,
    createdAt: nowIso(),
    readBy: []
  });
  const conversation = state.conversations.find((entry) => entry.id === conversationId);
  if (conversation) conversation.updatedAt = nowIso();
}

function getOrCreateConversation(state, { itemId, orderId = null, firstId, secondId }) {
  let conversation = state.conversations.find((entry) => (
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
    state.conversations.unshift(conversation);
  } else if (orderId && !conversation.orderId) {
    conversation.orderId = orderId;
  }
  return conversation;
}

function refundEscrow(state, order, {
  finalStatus = 'refunded',
  reason,
  actorId = 'system',
  source = 'system'
}) {
  if (order.escrowStatus !== 'held') {
    throw new Error('Escrow has already been processed. Duplicate token release or refund was blocked.');
  }
  if (!reason?.trim()) throw new Error('A reason is required to refund escrow.');
  const buyer = state.users.find((entry) => entry.id === order.buyerId);
  const item = state.items.find((entry) => entry.id === order.itemId);
  if (!buyer) throw new Error('The escrow buyer could not be found.');
  const processedAt = nowIso();
  buyer.heldTokenBalance = Math.max(0, Number(buyer.heldTokenBalance || 0) - order.tokenAmount);
  buyer.tokenBalance += order.tokenAmount;
  addTransaction(state, {
    userId: buyer.id,
    type: 'escrow_refund',
    amount: order.tokenAmount,
    balanceAfter: buyer.tokenBalance,
    heldAfter: buyer.heldTokenBalance,
    description: reason.trim(),
    itemId: order.itemId,
    orderId: order.id,
    relatedUserId: order.sellerId
  });
  order.status = finalStatus;
  order.escrowStatus = 'refunded';
  order.refundedAt = processedAt;
  order.updatedAt = processedAt;
  order.escrowDecision = {
    outcome: 'refunded_to_buyer',
    reason: reason.trim(),
    actorId,
    source,
    processedAt
  };
  if (item && item.status === 'reserved') {
    item.status = 'active';
    delete item.buyerId;
  }
  if (order.conversationId) {
    addSystemMessage(state, order.conversationId, `${order.tokenAmount} E-Tokens were returned to the buyer. Reason: ${reason.trim()}`);
  }
}

function releaseEscrow(state, order, {
  reason = 'Buyer confirmed receipt.',
  actorId = 'system',
  source = 'buyer_confirmation'
} = {}) {
  const buyer = state.users.find((entry) => entry.id === order.buyerId);
  const seller = state.users.find((entry) => entry.id === order.sellerId);
  const item = state.items.find((entry) => entry.id === order.itemId);
  if (!buyer || !seller || !item) throw new Error('Order participants or listing could not be found.');
  if (order.escrowStatus !== 'held') {
    throw new Error('Escrow has already been processed. Duplicate token release or refund was blocked.');
  }
  if (!reason?.trim()) throw new Error('A reason is required to release escrow.');

  const processedAt = nowIso();
  buyer.heldTokenBalance = Math.max(0, Number(buyer.heldTokenBalance || 0) - order.tokenAmount);
  seller.tokenBalance += order.tokenAmount;
  buyer.completedTrades = Number(buyer.completedTrades || 0) + 1;
  seller.completedTrades = Number(seller.completedTrades || 0) + 1;
  item.status = 'sold';
  item.buyerId = buyer.id;
  item.soldAt = processedAt;
  order.status = 'completed';
  order.escrowStatus = 'released';
  order.completedAt = processedAt;
  order.updatedAt = processedAt;
  order.escrowDecision = {
    outcome: 'released_to_seller',
    reason: reason.trim(),
    actorId,
    source,
    processedAt
  };
  addTransaction(state, {
    userId: buyer.id,
    type: 'purchase_completed',
    amount: 0,
    balanceAfter: buyer.tokenBalance,
    heldAfter: buyer.heldTokenBalance,
    description: `Purchase completed: ${item.title}`,
    itemId: item.id,
    orderId: order.id,
    relatedUserId: seller.id
  });
  addTransaction(state, {
    userId: seller.id,
    type: 'sale_release',
    amount: order.tokenAmount,
    balanceAfter: seller.tokenBalance,
    heldAfter: seller.heldTokenBalance || 0,
    description: `Escrow released for ${item.title}`,
    itemId: item.id,
    orderId: order.id,
    relatedUserId: buyer.id
  });
  if (order.conversationId) {
    addSystemMessage(state, order.conversationId, `Order completed. ${order.tokenAmount} E-Tokens were released to ${seller.name}. Reason: ${reason.trim()}`);
  }
}

export async function prepareSeedState(seedState) {
  const state = clone(seedState);
  for (const key of COLLECTIONS) state[key] ||= [];
  state.meta ||= {};
  state.meta.schemaVersion = '2.2.0-cognito';
  state.meta.storage = 'dynamodb';
  state.meta.authentication = 'amazon-cognito';
  state.meta.processedActionIds = [];
  for (const user of state.users) {
    delete user.password;
    delete user.passwordHash;
    delete user.passwordSalt;
  }
  return state;
}

export function stateForActor(state, actorId = null) {
  const actor = actorId ? state.users.find((user) => user.id === actorId && user.status === 'active') : null;
  const output = {
    meta: { ...state.meta, processedActionIds: undefined },
    users: state.users
      .filter((user) => user.status === 'active')
      .map((user) => actor && user.id === actor.id ? safeUser(user) : publicUser(user)),
    items: [],
    orders: [],
    recyclingRequests: [],
    conversations: [],
    messages: [],
    notifications: [],
    transactions: [],
    reviews: state.reviews.map((review) => (
      actor && review.reviewerId === actor.id ? clone(review) : publicReview(review)
    )),
    reports: [],
    auditLog: []
  };

  if (!actor) {
    output.items = clone(state.items.filter((item) => item.status === 'active'));
    return JSON.parse(JSON.stringify(output));
  }

  if (actor.role === 'admin') {
    return {
      ...clone(state),
      users: state.users.map(safeUser),
      meta: { ...state.meta, processedActionIds: undefined }
    };
  }

  const conversationIds = new Set(
    state.conversations
      .filter((conversation) => conversation.participantIds.includes(actor.id))
      .map((conversation) => conversation.id)
  );
  const orderItemIds = new Set(
    state.orders
      .filter((order) => order.buyerId === actor.id || order.sellerId === actor.id)
      .map((order) => order.itemId)
  );
  output.items = clone(state.items.filter((item) => (
    item.status === 'active'
    || item.ownerId === actor.id
    || orderItemIds.has(item.id)
  )));
  output.orders = clone(state.orders.filter((order) => order.buyerId === actor.id || order.sellerId === actor.id));
  output.recyclingRequests = clone(state.recyclingRequests.filter((request) => request.requesterId === actor.id));
  output.conversations = clone(state.conversations.filter((conversation) => conversationIds.has(conversation.id)));
  output.messages = clone(state.messages.filter((message) => conversationIds.has(message.conversationId)));
  output.notifications = clone(state.notifications.filter((notification) => notification.userId === actor.id));
  output.transactions = clone(state.transactions.filter((transaction) => transaction.userId === actor.id));
  output.reports = clone(state.reports.filter((report) => report.reporterId === actor.id));
  return JSON.parse(JSON.stringify(output));
}

export function registerCognitoUser(state, values) {
  const name = values.name?.trim();
  const email = normaliseEmail(values.email);
  const cognitoSub = String(values.cognitoSub || '').trim();
  const role = values.role === 'admin' ? 'admin' : 'user';
  if (!name || !email || !cognitoSub) throw new Error('Cognito name, email and subject are required.');

  const existing = state.users.find((user) => (
    user.cognitoSub === cognitoSub
    || normaliseEmail(user.email) === email
  ));
  if (existing) {
    if (existing.status === 'deleted') throw new Error('This account has been deleted.');
    existing.cognitoSub = cognitoSub;
    existing.role = role;
    delete existing.password;
    delete existing.passwordHash;
    delete existing.passwordSalt;
    return existing.id;
  }

  const id = makeId('usr');
  const createdAt = nowIso();
  state.users.push({
    id,
    cognitoSub,
    name,
    email,
    role,
    status: 'active',
    tokenBalance: 100,
    heldTokenBalance: 0,
    joinedAt: createdAt,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=dcfce7&color=166534&bold=true`,
    location: values.location?.trim() || 'United Kingdom',
    bio: '',
    favourites: [],
    blockedUserIds: [],
    completedTrades: 0,
    notificationPreferences: { messages: true, orders: true, tokens: true, announcements: true }
  });
  addTransaction(state, {
    userId: id,
    type: 'signup_reward',
    amount: 100,
    balanceAfter: 100,
    heldAfter: 0,
    description: 'New Cognito account starter reward'
  });
  addNotification(state, {
    userId: id,
    type: 'tokens',
    title: 'You received 100 E-Tokens',
    body: 'Welcome to E-Swap 2.2. Your starter reward is ready to use.',
    link: '/wallet'
  });
  addAudit(state, id, 'COGNITO_USER_REGISTERED', `${name} created a Cognito-secured account.`);
  return id;
}

export async function applyAction(state, actorId, action, payload = {}) {
  const actor = requireActor(state, actorId);
  let result = null;

  switch (action) {
    case 'updateProfile': {
      actor.name = payload.name?.trim() || actor.name;
      actor.location = payload.location?.trim() || '';
      actor.bio = payload.bio?.trim() || '';
      if (payload.avatar?.trim()) actor.avatar = payload.avatar.trim();
      addAudit(state, actorId, 'PROFILE_UPDATED', 'User updated profile information.');
      break;
    }
    case 'updateNotificationPreferences': {
      actor.notificationPreferences = { ...actor.notificationPreferences, ...payload };
      addAudit(state, actorId, 'NOTIFICATION_PREFERENCES_UPDATED', 'User changed notification preferences.');
      break;
    }
    case 'deleteOwnAccount': {
      if (actor.role === 'admin') throw new Error('The primary administrator account cannot be deleted here.');
      if (payload.confirmation !== 'DELETE') throw new Error('Type DELETE to confirm account deletion.');
      const hasOpenOrder = state.orders.some((order) => (
        (order.buyerId === actorId || order.sellerId === actorId)
        && OPEN_ORDER_STATUSES.includes(order.status)
      ));
      if (hasOpenOrder) throw new Error('Complete or cancel your active orders before deleting your account.');
      actor.status = 'deleted';
      actor.deletedAt = nowIso();
      actor.name = 'Deleted user';
      actor.bio = '';
      state.items.forEach((item) => {
        if (item.ownerId === actorId && item.status === 'active') item.status = 'hidden';
      });
      addAudit(state, actorId, 'USER_DELETED_OWN_ACCOUNT', `${actor.email} deleted their account.`);
      break;
    }
    case 'toggleFavourite': {
      actor.favourites ||= [];
      actor.favourites = actor.favourites.includes(payload.itemId)
        ? actor.favourites.filter((id) => id !== payload.itemId)
        : [...actor.favourites, payload.itemId];
      result = actor.favourites.includes(payload.itemId);
      break;
    }
    case 'createItem': {
      const values = payload.values || payload;
      if (!values.title?.trim() || !values.description?.trim()) throw new Error('Title and description are required.');
      const id = makeId('itm');
      state.items.unshift({
        id,
        ownerId: actorId,
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category,
        condition: values.condition,
        actionType: values.actionType,
        tokenPrice: Number(values.tokenPrice || 0),
        location: values.location?.trim() || actor.location || '',
        imageUrl: values.imageUrl?.trim() || '/images/recycling-bin.jpg',
        status: 'active',
        createdAt: nowIso(),
        views: 0
      });
      addNotification(state, { userId: actorId, type: 'listing', title: 'Your listing is live', body: `${values.title.trim()} is now visible in the marketplace.`, link: '/my-items' });
      addAudit(state, actorId, 'LISTING_CREATED', `Created listing ${values.title.trim()}.`);
      result = id;
      break;
    }
    case 'updateItem': {
      const item = state.items.find((entry) => entry.id === payload.itemId);
      const values = payload.values || {};
      if (!item) throw new Error('Listing not found.');
      if (item.ownerId !== actorId && actor.role !== 'admin') throw new Error('You cannot edit this listing.');
      if (item.status !== 'active' && actor.role !== 'admin') throw new Error('Only active listings can be edited.');
      Object.assign(item, {
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category,
        condition: values.condition,
        actionType: values.actionType,
        tokenPrice: Number(values.tokenPrice || 0),
        location: values.location.trim(),
        imageUrl: values.imageUrl?.trim() || item.imageUrl,
        updatedAt: nowIso()
      });
      addAudit(state, actorId, 'LISTING_UPDATED', `Updated listing ${item.title}.`);
      break;
    }
    case 'deleteItem': {
      const item = state.items.find((entry) => entry.id === payload.itemId);
      if (!item) throw new Error('Listing not found.');
      if (item.ownerId !== actorId && actor.role !== 'admin') throw new Error('You cannot delete this listing.');
      if (state.orders.some((order) => order.itemId === item.id && OPEN_ORDER_STATUSES.includes(order.status))) {
        throw new Error('This listing has an active order and cannot be deleted.');
      }
      item.status = 'deleted';
      item.deletedAt = nowIso();
      addAudit(state, actorId, 'LISTING_DELETED', `Deleted listing ${item.title}.`);
      break;
    }
    case 'createOrder': {
      const item = state.items.find((entry) => entry.id === payload.itemId);
      const seller = state.users.find((entry) => entry.id === item?.ownerId);
      if (!item || item.status !== 'active') throw new Error('This item is no longer available.');
      if (item.actionType !== 'Buy') throw new Error('This listing is not available for direct token purchase.');
      if (item.ownerId === actorId) throw new Error('You cannot buy your own listing.');
      if (!seller || seller.status !== 'active') throw new Error('The seller is unavailable.');
      if (actor.tokenBalance < item.tokenPrice) throw new Error('You do not have enough available E-Tokens.');
      if (actor.blockedUserIds?.includes(seller.id) || seller.blockedUserIds?.includes(actor.id)) {
        throw new Error('This transaction cannot be started because one account has blocked the other.');
      }
      actor.tokenBalance -= item.tokenPrice;
      actor.heldTokenBalance = Number(actor.heldTokenBalance || 0) + item.tokenPrice;
      item.status = 'reserved';
      item.buyerId = actor.id;
      const order = {
        id: makeId('ord'),
        itemId: item.id,
        buyerId: actor.id,
        sellerId: seller.id,
        tokenAmount: item.tokenPrice,
        status: 'pending_seller',
        escrowStatus: 'held',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        collectionNote: ''
      };
      state.orders.unshift(order);
      const conversation = getOrCreateConversation(state, {
        itemId: item.id,
        orderId: order.id,
        firstId: actor.id,
        secondId: seller.id
      });
      order.conversationId = conversation.id;
      addSystemMessage(state, conversation.id, `${actor.name} placed an order for ${item.title}. ${item.tokenPrice} E-Tokens are now protected in escrow.`);
      addTransaction(state, {
        userId: actor.id,
        type: 'purchase_hold',
        amount: -item.tokenPrice,
        balanceAfter: actor.tokenBalance,
        heldAfter: actor.heldTokenBalance,
        description: `Escrow hold for ${item.title}`,
        itemId: item.id,
        orderId: order.id,
        relatedUserId: seller.id
      });
      addNotification(state, { userId: actor.id, type: 'order', title: 'Tokens protected in escrow', body: `${item.tokenPrice} E-Tokens are held while ${seller.name} reviews your order.`, link: '/orders' });
      addNotification(state, { userId: seller.id, type: 'sale', title: 'New order to review', body: `${actor.name} wants to buy ${item.title} for ${item.tokenPrice} E-Tokens.`, link: '/orders' });
      addAudit(state, actorId, 'ORDER_CREATED', `${actor.email} started order ${order.id} for ${item.title}.`, { orderId: order.id });
      result = { orderId: order.id, conversationId: conversation.id };
      break;
    }
    case 'acceptOrder': {
      const order = state.orders.find((entry) => entry.id === payload.orderId);
      if (!order || order.sellerId !== actorId) throw new Error('Order not found.');
      if (order.status !== 'pending_seller') throw new Error('This order cannot be accepted now.');
      order.status = 'awaiting_collection';
      order.acceptedAt = nowIso();
      order.updatedAt = nowIso();
      order.collectionNote = payload.collectionNote?.trim() || '';
      const item = state.items.find((entry) => entry.id === order.itemId);
      addSystemMessage(state, order.conversationId, `Seller accepted the order.${order.collectionNote ? ` Collection note: ${order.collectionNote}` : ''}`);
      addNotification(state, { userId: order.buyerId, type: 'order', title: 'Seller accepted your order', body: `Arrange collection for ${item?.title || 'your item'} with the seller.`, link: '/orders' });
      addAudit(state, actorId, 'ORDER_ACCEPTED', `Accepted order ${order.id}.`, { orderId: order.id });
      break;
    }
    case 'rejectOrder': {
      const order = state.orders.find((entry) => entry.id === payload.orderId);
      if (!order || order.sellerId !== actorId) throw new Error('Order not found.');
      if (order.status !== 'pending_seller') throw new Error('This order cannot be rejected now.');
      const reason = payload.reason?.trim() || 'Seller declined the order.';
      refundEscrow(state, order, { finalStatus: 'rejected', reason, actorId, source: 'seller_rejection' });
      addNotification(state, { userId: order.buyerId, type: 'order', title: 'Order declined and refunded', body: `${order.tokenAmount} E-Tokens were returned to your available balance.`, link: '/wallet' });
      addAudit(state, actorId, 'ORDER_REJECTED', `Rejected order ${order.id}. Reason: ${reason}`, { orderId: order.id });
      break;
    }
    case 'cancelOrder': {
      const order = state.orders.find((entry) => entry.id === payload.orderId);
      if (!order || order.buyerId !== actorId) throw new Error('Order not found.');
      if (order.status !== 'pending_seller') throw new Error('Only an order waiting for the seller can be cancelled.');
      refundEscrow(state, order, { finalStatus: 'cancelled', reason: 'Buyer cancelled before seller acceptance.', actorId, source: 'buyer_cancellation' });
      addNotification(state, { userId: order.sellerId, type: 'order', title: 'Order cancelled', body: 'The buyer cancelled before you accepted the order.', link: '/orders' });
      addAudit(state, actorId, 'ORDER_CANCELLED', `Cancelled order ${order.id}.`, { orderId: order.id });
      break;
    }
    case 'markOrderReady': {
      const order = state.orders.find((entry) => entry.id === payload.orderId);
      if (!order || order.sellerId !== actorId) throw new Error('Order not found.');
      if (order.status !== 'awaiting_collection') throw new Error('This order cannot be marked ready now.');
      order.status = 'ready_for_collection';
      order.readyAt = nowIso();
      order.updatedAt = nowIso();
      if (payload.collectionNote?.trim()) order.collectionNote = payload.collectionNote.trim();
      const item = state.items.find((entry) => entry.id === order.itemId);
      addSystemMessage(state, order.conversationId, `The item is ready for collection.${order.collectionNote ? ` ${order.collectionNote}` : ''}`);
      addNotification(state, { userId: order.buyerId, type: 'order', title: 'Item ready for collection', body: `${item?.title || 'Your item'} is ready. Check it before confirming receipt.`, link: '/orders' });
      addAudit(state, actorId, 'ORDER_READY', `Marked order ${order.id} ready.`, { orderId: order.id });
      break;
    }
    case 'confirmOrderReceived': {
      const order = state.orders.find((entry) => entry.id === payload.orderId);
      if (!order || order.buyerId !== actorId) throw new Error('Order not found.');
      if (!['awaiting_collection', 'ready_for_collection'].includes(order.status)) throw new Error('This order cannot be completed now.');
      releaseEscrow(state, order, {
        reason: 'Buyer confirmed the item was received and matched the order.',
        actorId,
        source: 'buyer_confirmation'
      });
      const item = state.items.find((entry) => entry.id === order.itemId);
      addNotification(state, { userId: order.sellerId, type: 'sale', title: 'Tokens released', body: `${order.tokenAmount} E-Tokens from ${item?.title || 'the sale'} are now available.`, link: '/wallet' });
      addNotification(state, { userId: order.buyerId, type: 'review', title: 'Order completed', body: 'Leave a review to help build trust in the community.', link: '/orders' });
      addAudit(state, actorId, 'ORDER_COMPLETED', `Buyer confirmed order ${order.id}.`, { orderId: order.id });
      break;
    }
    case 'raiseDispute': {
      if (!payload.reason?.trim()) throw new Error('Explain why you are opening a dispute.');
      const order = state.orders.find((entry) => entry.id === payload.orderId);
      if (!order || ![order.buyerId, order.sellerId].includes(actorId)) throw new Error('Order not found.');
      if (!['awaiting_collection', 'ready_for_collection'].includes(order.status)) throw new Error('This order cannot be disputed now.');
      order.status = 'disputed';
      order.dispute = { openedBy: actorId, reason: payload.reason.trim(), openedAt: nowIso() };
      order.updatedAt = nowIso();
      addSystemMessage(state, order.conversationId, `A dispute was opened: ${payload.reason.trim()}`);
      addNotification(state, { userId: order.buyerId === actorId ? order.sellerId : order.buyerId, type: 'dispute', title: 'Order dispute opened', body: payload.reason.trim(), link: '/orders' });
      const admin = activeAdmin(state);
      if (admin) addNotification(state, { userId: admin.id, type: 'dispute', title: 'Disputed order requires review', body: `Order ${order.id}: ${payload.reason.trim()}`, link: '/admin' });
      addAudit(state, actorId, 'ORDER_DISPUTED', `Opened dispute on ${order.id}: ${payload.reason.trim()}`, { orderId: order.id });
      break;
    }
    case 'leaveReview': {
      const numericRating = Number(payload.rating);
      if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) throw new Error('Choose a rating from 1 to 5.');
      const order = state.orders.find((entry) => entry.id === payload.orderId);
      if (!order || order.status !== 'completed' || ![order.buyerId, order.sellerId].includes(actorId)) throw new Error('This order cannot be reviewed.');
      if (state.reviews.some((review) => review.orderId === order.id && review.reviewerId === actorId)) throw new Error('You already reviewed this order.');
      const targetUserId = order.buyerId === actorId ? order.sellerId : order.buyerId;
      state.reviews.unshift({ id: makeId('rev'), orderId: order.id, reviewerId: actorId, targetUserId, rating: numericRating, comment: payload.comment?.trim() || '', createdAt: nowIso() });
      addNotification(state, { userId: targetUserId, type: 'review', title: 'You received a new review', body: `${numericRating} out of 5 stars`, link: '/profile' });
      addAudit(state, actorId, 'REVIEW_CREATED', `Left ${numericRating}-star review for order ${order.id}.`, { orderId: order.id });
      break;
    }
    case 'startConversation': {
      if (payload.recipientId === actorId) throw new Error('You cannot message yourself.');
      const recipient = state.users.find((entry) => entry.id === payload.recipientId && entry.status === 'active');
      if (!recipient) throw new Error('The recipient is unavailable.');
      if (actor.blockedUserIds?.includes(recipient.id) || recipient.blockedUserIds?.includes(actorId)) throw new Error('Messaging is unavailable between these accounts.');
      const conversation = getOrCreateConversation(state, { itemId: payload.itemId, firstId: actorId, secondId: recipient.id });
      const body = payload.message?.trim() || 'Hi, is this item still available?';
      state.messages.push({ id: makeId('msg'), conversationId: conversation.id, senderId: actorId, body, createdAt: nowIso(), readBy: [actorId] });
      conversation.updatedAt = nowIso();
      addNotification(state, { userId: recipient.id, type: 'message', title: `New message from ${actor.name}`, body, link: `/messages?conversation=${conversation.id}` });
      result = conversation.id;
      break;
    }
    case 'sendMessage': {
      if (!payload.body?.trim()) break;
      const conversation = state.conversations.find((entry) => entry.id === payload.conversationId);
      if (!conversation || !conversation.participantIds.includes(actorId)) throw new Error('Conversation not found.');
      const recipientId = conversation.participantIds.find((id) => id !== actorId);
      const recipient = state.users.find((entry) => entry.id === recipientId);
      if (actor.blockedUserIds?.includes(recipientId) || recipient?.blockedUserIds?.includes(actorId)) throw new Error('Messaging is unavailable because one account has blocked the other.');
      if (recipient?.status !== 'active') throw new Error('This user is unavailable.');
      state.messages.push({ id: makeId('msg'), conversationId: conversation.id, senderId: actorId, body: payload.body.trim(), createdAt: nowIso(), readBy: [actorId] });
      conversation.updatedAt = nowIso();
      addNotification(state, { userId: recipientId, type: 'message', title: `New message from ${actor.name}`, body: payload.body.trim(), link: `/messages?conversation=${conversation.id}` });
      break;
    }
    case 'toggleBlockUser': {
      if (payload.userId === actorId) throw new Error('This user cannot be blocked.');
      const target = state.users.find((entry) => entry.id === payload.userId);
      if (!target || target.role === 'admin') throw new Error('This user cannot be blocked.');
      actor.blockedUserIds ||= [];
      const blocked = !actor.blockedUserIds.includes(target.id);
      actor.blockedUserIds = blocked ? [...actor.blockedUserIds, target.id] : actor.blockedUserIds.filter((id) => id !== target.id);
      addAudit(state, actorId, blocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED', `${target.email} was ${blocked ? 'blocked' : 'unblocked'}.`);
      result = blocked;
      break;
    }
    case 'markConversationRead': {
      const conversation = state.conversations.find((entry) => entry.id === payload.conversationId && entry.participantIds.includes(actorId));
      if (!conversation) throw new Error('Conversation not found.');
      state.messages.forEach((message) => {
        if (message.conversationId === conversation.id && !message.readBy.includes(actorId)) message.readBy.push(actorId);
      });
      break;
    }
    case 'markNotificationRead': {
      const notification = state.notifications.find((entry) => entry.id === payload.notificationId && entry.userId === actorId);
      if (notification) notification.read = true;
      break;
    }
    case 'markAllNotificationsRead': {
      state.notifications.forEach((notification) => {
        if (notification.userId === actorId) notification.read = true;
      });
      break;
    }
    case 'reportItem': {
      if (!payload.reason?.trim()) throw new Error('Choose a report reason.');
      if (state.reports.some((report) => report.targetType === 'listing' && report.targetId === payload.itemId && report.reporterId === actorId && report.status === 'pending')) throw new Error('You have already reported this listing.');
      state.reports.unshift({ id: makeId('rpt'), targetType: 'listing', targetId: payload.itemId, itemId: payload.itemId, reporterId: actorId, reason: payload.reason, details: payload.details?.trim() || '', status: 'pending', createdAt: nowIso() });
      addAudit(state, actorId, 'LISTING_REPORTED', `Reported listing ${payload.itemId}: ${payload.reason}.`);
      break;
    }
    case 'reportUser': {
      if (payload.userId === actorId) throw new Error('You cannot report yourself.');
      if (!payload.reason?.trim()) throw new Error('Choose a report reason.');
      if (state.reports.some((report) => report.targetType === 'user' && report.targetId === payload.userId && report.reporterId === actorId && report.status === 'pending')) throw new Error('You have already reported this user.');
      state.reports.unshift({ id: makeId('rpt'), targetType: 'user', targetId: payload.userId, reporterId: actorId, reason: payload.reason, details: payload.details?.trim() || '', status: 'pending', createdAt: nowIso() });
      addAudit(state, actorId, 'USER_REPORTED', `Reported user ${payload.userId}: ${payload.reason}.`);
      break;
    }
    case 'createRecyclingRequest': {
      if (actor.role === 'admin') throw new Error('A user account is required to submit a recycling request.');
      const values = payload.values || payload;
      if (!values.deviceType?.trim() || !values.brandModel?.trim() || !values.condition?.trim() || !values.location?.trim()) {
        throw new Error('Device type, brand/model, condition and location are required.');
      }
      const quantity = Number(values.quantity || 1);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Quantity must be between 1 and 20.');
      const admin = activeAdmin(state);
      if (!admin) throw new Error('The recycling team is unavailable.');
      const requestId = makeId('rec');
      const createdAt = nowIso();
      const conversation = {
        id: makeId('cnv'),
        participantIds: [actorId, admin.id],
        itemId: null,
        orderId: null,
        recyclingRequestId: requestId,
        subject: `Recycling request · ${values.brandModel.trim()}`,
        createdAt,
        updatedAt: createdAt
      };
      state.conversations.unshift(conversation);
      const request = {
        id: requestId,
        requesterId: actorId,
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
        history: [{ status: 'submitted', actorId, reason: 'Recycling request submitted for administrator review.', createdAt }]
      };
      state.recyclingRequests.unshift(request);
      addSystemMessage(state, conversation.id, 'Recycling request submitted. An administrator will review the device details.');
      if (request.notes) {
        state.messages.push({ id: makeId('msg'), conversationId: conversation.id, senderId: actorId, body: request.notes, createdAt, readBy: [actorId] });
      }
      addNotification(state, { userId: admin.id, type: 'recycling', title: 'New recycling request', body: `${actor.name} submitted ${quantity} × ${request.brandModel}.`, link: `/admin?tab=recycling&request=${requestId}` });
      addAudit(state, actorId, 'RECYCLING_REQUEST_SUBMITTED', `${actor.email} submitted ${requestId} for ${quantity} × ${request.brandModel}.`, { recyclingRequestId: requestId, requesterId: actorId, status: 'submitted' });
      result = requestId;
      break;
    }
    case 'adminAdjustTokens': {
      requireAdmin(state, actorId);
      const numericAmount = Number(payload.amount);
      if (!Number.isFinite(numericAmount) || numericAmount === 0) throw new Error('Enter a non-zero token amount.');
      if (!payload.reason?.trim()) throw new Error('A reason is required for every token adjustment.');
      const user = state.users.find((entry) => entry.id === payload.userId && entry.status !== 'deleted');
      if (!user) throw new Error('User not found.');
      if (user.tokenBalance + numericAmount < 0) throw new Error('This adjustment would make the available balance negative.');
      const before = user.tokenBalance;
      user.tokenBalance += numericAmount;
      addTransaction(state, { userId: user.id, type: 'admin_adjustment', amount: numericAmount, balanceAfter: user.tokenBalance, heldAfter: user.heldTokenBalance || 0, description: payload.reason.trim(), relatedUserId: actorId });
      addNotification(state, { userId: user.id, type: 'tokens', title: numericAmount > 0 ? `${numericAmount} E-Tokens added` : `${Math.abs(numericAmount)} E-Tokens removed`, body: payload.reason.trim(), link: '/wallet' });
      addAudit(state, actorId, 'TOKENS_ADJUSTED', `${numericAmount} tokens adjusted for ${user.email}. Reason: ${payload.reason.trim()}.`, { userId: user.id, before, after: user.tokenBalance });
      break;
    }
    case 'adminSetUserStatus': {
      requireAdmin(state, actorId);
      if (!['active', 'suspended'].includes(payload.status)) throw new Error('Choose a valid account status.');
      const user = state.users.find((entry) => entry.id === payload.userId);
      if (!user || user.role === 'admin') throw new Error('This user cannot be modified.');
      user.status = payload.status;
      addNotification(state, { userId: user.id, type: 'account', title: payload.status === 'active' ? 'Account reactivated' : 'Account suspended', body: payload.reason?.trim() || (payload.status === 'active' ? 'Your E-Swap account is active again.' : 'Your account was suspended by an administrator.'), link: '/profile' });
      addAudit(state, actorId, 'USER_STATUS_CHANGED', `${user.email} status changed to ${payload.status}. Reason: ${payload.reason || 'Not supplied'}.`, { userId: user.id, status: payload.status });
      break;
    }
    case 'adminDeleteUser': {
      requireAdmin(state, actorId);
      const user = state.users.find((entry) => entry.id === payload.userId);
      if (!user || user.role === 'admin') throw new Error('This user cannot be deleted.');
      state.orders
        .filter((order) => OPEN_ORDER_STATUSES.includes(order.status) && [order.buyerId, order.sellerId].includes(user.id))
        .forEach((order) => refundEscrow(state, order, {
          finalStatus: 'refunded',
          reason: 'Order refunded because an account was removed by an administrator.',
          actorId,
          source: 'admin_account_deletion'
        }));
      user.status = 'deleted';
      user.deletedAt = nowIso();
      user.name = 'Deleted user';
      state.items.forEach((item) => {
        if (item.ownerId === user.id && ['active', 'reserved'].includes(item.status)) item.status = 'hidden';
      });
      addAudit(state, actorId, 'USER_DELETED_BY_ADMIN', `${user.email} was deleted by an administrator.`, { userId: user.id });
      break;
    }
    case 'adminModerateItem': {
      requireAdmin(state, actorId);
      if (!['active', 'hidden', 'deleted'].includes(payload.status)) throw new Error('Choose a valid listing status.');
      const item = state.items.find((entry) => entry.id === payload.itemId);
      if (!item) throw new Error('Listing not found.');
      if (state.orders.some((order) => order.itemId === item.id && OPEN_ORDER_STATUSES.includes(order.status)) && payload.status === 'deleted') throw new Error('Resolve the active order before deleting this listing.');
      item.status = payload.status;
      const owner = state.users.find((entry) => entry.id === item.ownerId);
      if (owner) addNotification(state, { userId: owner.id, type: 'moderation', title: 'Listing status changed', body: `${item.title} is now ${payload.status}.`, link: '/my-items' });
      addAudit(state, actorId, 'LISTING_MODERATED', `${item.title} status changed to ${payload.status}.`, { itemId: item.id, status: payload.status });
      break;
    }
    case 'adminResolveReport': {
      requireAdmin(state, actorId);
      if (!['resolved', 'dismissed'].includes(payload.resolution)) throw new Error('Choose a valid report resolution.');
      const report = state.reports.find((entry) => entry.id === payload.reportId);
      if (!report) throw new Error('Report not found.');
      report.status = payload.resolution;
      report.resolvedAt = nowIso();
      report.resolvedBy = actorId;
      addAudit(state, actorId, 'REPORT_RESOLVED', `Report ${report.id} changed to ${payload.resolution}.`, { reportId: report.id, resolution: payload.resolution });
      break;
    }
    case 'adminProcessEscrow': {
      requireAdmin(state, actorId);
      if (!payload.reason?.trim()) throw new Error('A reason is mandatory for every escrow release or refund.');
      if (!['release', 'refund'].includes(payload.outcome)) throw new Error('Choose release or refund.');
      const order = state.orders.find((entry) => entry.id === payload.orderId);
      if (!order) throw new Error('Order not found.');
      if (order.escrowStatus !== 'held') throw new Error('Escrow has already been processed. Duplicate token release or refund was blocked.');
      const escrowBefore = order.escrowStatus;
      const statusBefore = order.status;
      if (payload.outcome === 'release') {
        releaseEscrow(state, order, { reason: payload.reason.trim(), actorId, source: 'admin_escrow_control' });
      } else {
        refundEscrow(state, order, { finalStatus: 'refunded', reason: payload.reason.trim(), actorId, source: 'admin_escrow_control' });
      }
      if (statusBefore === 'disputed') {
        order.disputeResolution = {
          outcome: payload.outcome === 'release' ? 'released_to_seller' : 'refunded_to_buyer',
          note: payload.reason.trim(),
          resolvedBy: actorId,
          resolvedAt: order.escrowDecision.processedAt
        };
      }
      const title = payload.outcome === 'release' ? 'Escrow released to seller' : 'Escrow refunded to buyer';
      addNotification(state, { userId: order.buyerId, type: 'dispute', title, body: payload.reason.trim(), link: '/orders' });
      addNotification(state, { userId: order.sellerId, type: 'dispute', title, body: payload.reason.trim(), link: '/orders' });
      addAudit(
        state,
        actorId,
        payload.outcome === 'release' ? 'ADMIN_ESCROW_RELEASED' : 'ADMIN_ESCROW_REFUNDED',
        `${order.id}: ${order.tokenAmount} E-Tokens ${payload.outcome === 'release' ? 'released to the seller' : 'refunded to the buyer'}. Mandatory reason: ${payload.reason.trim()}`,
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
          outcome: payload.outcome,
          reason: payload.reason.trim(),
          processedAt: order.escrowDecision.processedAt
        }
      );
      break;
    }
    case 'adminUpdateRecyclingRequest': {
      requireAdmin(state, actorId);
      if (!payload.reason?.trim()) throw new Error('A reason or processing note is mandatory.');
      if (!['approved', 'rejected', 'completed'].includes(payload.status)) throw new Error('Choose a valid recycling status.');
      const request = state.recyclingRequests.find((entry) => entry.id === payload.requestId);
      if (!request) throw new Error('Recycling request not found.');
      const transitions = { submitted: ['approved', 'rejected'], approved: ['completed', 'rejected'], rejected: [], completed: [] };
      if (!transitions[request.status]?.includes(payload.status)) throw new Error(`A ${request.status} recycling request cannot be changed to ${payload.status}.`);
      const fromStatus = request.status;
      const processedAt = nowIso();
      request.status = payload.status;
      request.updatedAt = processedAt;
      request.adminReason = payload.reason.trim();
      request[`${payload.status}At`] = processedAt;
      request.history ||= [];
      request.history.push({ status: payload.status, actorId, reason: payload.reason.trim(), createdAt: processedAt });
      if (request.conversationId) addSystemMessage(state, request.conversationId, `Recycling request ${payload.status}. Administrator note: ${payload.reason.trim()}`);
      addNotification(state, { userId: request.requesterId, type: 'recycling', title: `Recycling request ${payload.status}`, body: payload.reason.trim(), link: '/recycling' });
      addAudit(state, actorId, `RECYCLING_REQUEST_${payload.status.toUpperCase()}`, `${request.id} changed from ${fromStatus} to ${payload.status}. Reason: ${payload.reason.trim()}`, {
        recyclingRequestId: request.id,
        requesterId: request.requesterId,
        fromStatus,
        toStatus: payload.status,
        reason: payload.reason.trim(),
        processedAt
      });
      break;
    }
    case 'adminResolveDispute': {
      requireAdmin(state, actorId);
      if (!payload.note?.trim()) throw new Error('Add an administrator resolution note.');
      const order = state.orders.find((entry) => entry.id === payload.orderId);
      if (!order || order.status !== 'disputed') throw new Error('Disputed order not found.');
      if (payload.outcome === 'release') {
        releaseEscrow(state, order, { reason: payload.note.trim(), actorId, source: 'admin_dispute_resolution' });
        order.disputeResolution = { outcome: 'released_to_seller', note: payload.note.trim(), resolvedBy: actorId, resolvedAt: nowIso() };
      } else if (payload.outcome === 'refund') {
        refundEscrow(state, order, { finalStatus: 'refunded', reason: payload.note.trim(), actorId, source: 'admin_dispute_resolution' });
        order.disputeResolution = { outcome: 'refunded_to_buyer', note: payload.note.trim(), resolvedBy: actorId, resolvedAt: nowIso() };
      } else {
        throw new Error('Choose a valid dispute outcome.');
      }
      addNotification(state, { userId: order.buyerId, type: 'dispute', title: 'Dispute resolved', body: payload.note.trim(), link: '/orders' });
      addNotification(state, { userId: order.sellerId, type: 'dispute', title: 'Dispute resolved', body: payload.note.trim(), link: '/orders' });
      addAudit(state, actorId, 'DISPUTE_RESOLVED', `${order.id} resolved: ${payload.outcome}. ${payload.note.trim()}`, { orderId: order.id, outcome: payload.outcome });
      break;
    }
    case 'adminBroadcast': {
      requireAdmin(state, actorId);
      if (!payload.title?.trim() || !payload.body?.trim()) throw new Error('Title and message are required.');
      state.users.filter((user) => user.role === 'user' && user.status === 'active').forEach((user) => {
        addNotification(state, { userId: user.id, type: 'announcement', title: payload.title.trim(), body: payload.body.trim(), link: '/notifications' });
      });
      addAudit(state, actorId, 'ANNOUNCEMENT_SENT', `Broadcast: ${payload.title.trim()}.`);
      break;
    }
    default:
      throw new Error(`Unsupported action: ${action}`);
  }

  return result;
}
