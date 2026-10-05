import { makeId, nowIso } from './localDb.js';

export function addTransaction(database, transaction) {
  database.transactions.unshift({
    id: makeId('tx'),
    createdAt: nowIso(),
    ...transaction
  });
}

export function addSystemMessage(database, conversationId, body) {
  database.messages.push({
    id: makeId('msg'),
    conversationId,
    senderId: 'system',
    body,
    createdAt: nowIso(),
    readBy: []
  });
  const conversation = database.conversations.find((entry) => entry.id === conversationId);
  if (conversation) conversation.updatedAt = nowIso();
}

export function refundEscrow(database, order, {
  finalStatus = 'refunded',
  reason,
  actorId = 'system',
  source = 'system'
}) {
  if (order.escrowStatus !== 'held') throw new Error('Escrow has already been processed. No second refund or release is allowed.');
  if (!reason?.trim()) throw new Error('A reason is required to refund escrow.');
  const buyer = database.users.find((entry) => entry.id === order.buyerId);
  const item = database.items.find((entry) => entry.id === order.itemId);
  if (!buyer) throw new Error('The escrow buyer could not be found.');
  const processedAt = nowIso();
  buyer.heldTokenBalance = Math.max(0, Number(buyer.heldTokenBalance || 0) - order.tokenAmount);
  buyer.tokenBalance += order.tokenAmount;
  addTransaction(database, {
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
  if (order.conversationId) addSystemMessage(database, order.conversationId, `${order.tokenAmount} E-Tokens were returned to the buyer. Reason: ${reason.trim()}`);
}

export function releaseEscrow(database, order, {
  reason = 'Buyer confirmed receipt.',
  actorId = 'system',
  source = 'buyer_confirmation'
} = {}) {
  const buyer = database.users.find((entry) => entry.id === order.buyerId);
  const seller = database.users.find((entry) => entry.id === order.sellerId);
  const item = database.items.find((entry) => entry.id === order.itemId);
  if (!buyer || !seller || !item) throw new Error('Order participants or listing could not be found.');
  if (order.escrowStatus !== 'held') throw new Error('Escrow has already been processed. No second refund or release is allowed.');
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

  addTransaction(database, {
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
  addTransaction(database, {
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
  if (order.conversationId) addSystemMessage(database, order.conversationId, `Order completed. ${order.tokenAmount} E-Tokens were released to ${seller.name}. Reason: ${reason.trim()}`);
}
