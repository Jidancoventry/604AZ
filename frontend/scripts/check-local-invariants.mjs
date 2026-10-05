import assert from 'node:assert/strict';
import { refundEscrow, releaseEscrow } from '../src/services/escrow.js';
import { seedDatabase } from '../src/data/seed.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getOrder(database, id = 'ord-ipad') {
  return database.orders.find((order) => order.id === id);
}

{
  const database = clone(seedDatabase);
  const order = getOrder(database);
  const buyer = database.users.find((user) => user.id === order.buyerId);
  const seller = database.users.find((user) => user.id === order.sellerId);
  const buyerHeldBefore = buyer.heldTokenBalance;
  const sellerBefore = seller.tokenBalance;

  releaseEscrow(database, order, {
    reason: 'Automated invariant test release.',
    actorId: 'usr-admin',
    source: 'test'
  });

  assert.equal(order.escrowStatus, 'released');
  assert.equal(order.status, 'completed');
  assert.equal(buyer.heldTokenBalance, buyerHeldBefore - order.tokenAmount);
  assert.equal(seller.tokenBalance, sellerBefore + order.tokenAmount);
  assert.equal(order.escrowDecision.reason, 'Automated invariant test release.');

  const sellerAfter = seller.tokenBalance;
  assert.throws(
    () => releaseEscrow(database, order, { reason: 'Duplicate release attempt.' }),
    /already been processed/i
  );
  assert.equal(seller.tokenBalance, sellerAfter, 'A duplicate release must never credit the seller twice.');
}

{
  const database = clone(seedDatabase);
  const order = getOrder(database);
  const buyer = database.users.find((user) => user.id === order.buyerId);
  const availableBefore = buyer.tokenBalance;
  const heldBefore = buyer.heldTokenBalance;

  refundEscrow(database, order, {
    finalStatus: 'refunded',
    reason: 'Automated invariant test refund.',
    actorId: 'usr-admin',
    source: 'test'
  });

  assert.equal(order.escrowStatus, 'refunded');
  assert.equal(buyer.tokenBalance, availableBefore + order.tokenAmount);
  assert.equal(buyer.heldTokenBalance, heldBefore - order.tokenAmount);
  assert.equal(order.escrowDecision.reason, 'Automated invariant test refund.');

  const availableAfter = buyer.tokenBalance;
  assert.throws(
    () => refundEscrow(database, order, { reason: 'Duplicate refund attempt.' }),
    /already been processed/i
  );
  assert.equal(buyer.tokenBalance, availableAfter, 'A duplicate refund must never credit the buyer twice.');
}

assert.equal(seedDatabase.meta.schemaVersion, '2.2.0');
assert.ok(Array.isArray(seedDatabase.recyclingRequests) && seedDatabase.recyclingRequests.length > 0);

for (const request of seedDatabase.recyclingRequests) {
  const conversation = seedDatabase.conversations.find((entry) => entry.id === request.conversationId);
  assert.ok(conversation, `Missing conversation for recycling request ${request.id}.`);
  assert.ok(conversation.participantIds.includes(request.requesterId));
  assert.ok(conversation.participantIds.includes('usr-admin'));
  assert.equal(conversation.recyclingRequestId, request.id);
  assert.ok(request.history.some((entry) => entry.status === 'submitted'));
}

for (const message of seedDatabase.messages) {
  assert.ok(seedDatabase.conversations.some((conversation) => conversation.id === message.conversationId), `Message ${message.id} has no conversation.`);
}

console.log('E-Swap 2.2 invariant checks passed.');
