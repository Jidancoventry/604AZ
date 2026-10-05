export const DEMO_PASSWORDS = {
  user: 'User123!',
  seller: 'User123!',
  admin: 'Admin123!'
};

const commonPreferences = {
  messages: true,
  orders: true,
  tokens: true,
  announcements: true
};

export const seedDatabase = {
  meta: {
    schemaVersion: '2.2.0',
    createdAt: '2026-07-23T15:00:00.000Z'
  },
  users: [
    {
      id: 'usr-admin',
      name: 'Admin User',
      email: 'admin@eswap.local',
      password: DEMO_PASSWORDS.admin,
      role: 'admin',
      status: 'active',
      tokenBalance: 10000,
      heldTokenBalance: 0,
      joinedAt: '2026-06-01T09:00:00.000Z',
      avatar: 'https://i.pravatar.cc/160?img=12',
      location: 'London',
      bio: 'E-Swap platform administrator.',
      favourites: [],
      blockedUserIds: [],
      notificationPreferences: commonPreferences,
      completedTrades: 0
    },
    {
      id: 'usr-alex',
      name: 'Alex Johnson',
      email: 'alex@eswap.local',
      password: DEMO_PASSWORDS.user,
      role: 'user',
      status: 'active',
      tokenBalance: 950,
      heldTokenBalance: 300,
      joinedAt: '2026-06-18T10:30:00.000Z',
      avatar: 'https://i.pravatar.cc/160?img=11',
      location: 'Coventry',
      bio: 'Interested in giving electronics a longer useful life.',
      favourites: ['itm-watch', 'itm-headphones'],
      blockedUserIds: [],
      notificationPreferences: commonPreferences,
      completedTrades: 1
    },
    {
      id: 'usr-sarah',
      name: 'Sarah Lee',
      email: 'sarah@eswap.local',
      password: DEMO_PASSWORDS.seller,
      role: 'user',
      status: 'active',
      tokenBalance: 900,
      heldTokenBalance: 0,
      joinedAt: '2026-06-20T13:10:00.000Z',
      avatar: 'https://i.pravatar.cc/160?img=47',
      location: 'London',
      bio: 'Selling and exchanging devices I no longer use.',
      favourites: [],
      blockedUserIds: [],
      notificationPreferences: commonPreferences,
      completedTrades: 0
    },
    {
      id: 'usr-liam',
      name: 'Liam Brown',
      email: 'liam@eswap.local',
      password: DEMO_PASSWORDS.user,
      role: 'user',
      status: 'active',
      tokenBalance: 840,
      heldTokenBalance: 0,
      joinedAt: '2026-06-25T08:45:00.000Z',
      avatar: 'https://i.pravatar.cc/160?img=5',
      location: 'Luton',
      bio: 'Student looking for affordable technology.',
      favourites: ['itm-phone'],
      blockedUserIds: [],
      notificationPreferences: commonPreferences,
      completedTrades: 1
    },
    {
      id: 'usr-noah',
      name: 'Noah Williams',
      email: 'noah@eswap.local',
      password: DEMO_PASSWORDS.user,
      role: 'user',
      status: 'suspended',
      tokenBalance: 150,
      heldTokenBalance: 0,
      joinedAt: '2026-07-01T14:20:00.000Z',
      avatar: 'https://i.pravatar.cc/160?img=15',
      location: 'Birmingham',
      bio: '',
      favourites: [],
      blockedUserIds: [],
      notificationPreferences: commonPreferences,
      completedTrades: 0
    }
  ],
  items: [
    {
      id: 'itm-macbook', ownerId: 'usr-sarah', title: 'MacBook Air M1',
      description: '2020 MacBook Air with 256GB storage. Excellent condition, original charger included and battery health is good.',
      category: 'Laptop', condition: 'Excellent', actionType: 'Buy', tokenPrice: 1250,
      location: 'London', imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=85',
      status: 'active', createdAt: '2026-07-15T09:30:00.000Z', views: 184
    },
    {
      id: 'itm-phone', ownerId: 'usr-sarah', title: 'iPhone 13 128GB',
      description: 'Unlocked iPhone 13 in very good condition. Small marks on the frame, cameras and Face ID work perfectly.',
      category: 'Phone', condition: 'Very Good', actionType: 'Buy', tokenPrice: 750,
      location: 'London', imageUrl: 'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?auto=format&fit=crop&w=1200&q=85',
      status: 'active', createdAt: '2026-07-17T12:15:00.000Z', views: 142
    },
    {
      id: 'itm-headphones', ownerId: 'usr-alex', title: 'Sony WH-1000XM4',
      description: 'Noise-cancelling headphones in excellent condition. Includes protective case and charging cable.',
      category: 'Audio', condition: 'Excellent', actionType: 'Buy', tokenPrice: 450,
      location: 'Coventry', imageUrl: 'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&w=1200&q=85',
      status: 'active', createdAt: '2026-07-18T08:00:00.000Z', views: 96
    },
    {
      id: 'itm-ps5', ownerId: 'usr-liam', title: 'PlayStation 5 Disc Edition',
      description: 'PS5 disc console with one controller and power cable. Fully working and factory reset.',
      category: 'Gaming', condition: 'Like New', actionType: 'Buy', tokenPrice: 1100,
      location: 'Luton', imageUrl: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=1200&q=85',
      status: 'active', createdAt: '2026-07-19T16:40:00.000Z', views: 222
    },
    {
      id: 'itm-watch', ownerId: 'usr-sarah', title: 'Apple Watch SE',
      description: '44mm Apple Watch SE with sport band. GPS model, good battery life and light surface marks.',
      category: 'Wearables', condition: 'Good', actionType: 'Buy', tokenPrice: 300,
      location: 'London', imageUrl: 'https://images.unsplash.com/photo-1551816230-ef5deaed4a26?auto=format&fit=crop&w=1200&q=85',
      status: 'active', createdAt: '2026-07-20T11:20:00.000Z', views: 81
    },
    {
      id: 'itm-dell', ownerId: 'usr-liam', title: 'Dell XPS 13',
      description: '2021 Dell XPS 13 with Intel i5, 8GB RAM and 256GB SSD. Ideal for study and office work.',
      category: 'Laptop', condition: 'Good', actionType: 'Exchange', tokenPrice: 550,
      location: 'Luton', imageUrl: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=1200&q=85',
      status: 'active', createdAt: '2026-07-21T09:10:00.000Z', views: 118
    },
    {
      id: 'itm-ipad', ownerId: 'usr-sarah', title: 'iPad Mini 6',
      description: 'Compact iPad Mini with 64GB storage, Wi-Fi and original USB-C cable. Reserved for a local collection.',
      category: 'Tablet', condition: 'Very Good', actionType: 'Buy', tokenPrice: 300,
      location: 'London', imageUrl: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=1200&q=85',
      status: 'reserved', createdAt: '2026-07-18T12:00:00.000Z', views: 73, buyerId: 'usr-alex'
    },
    {
      id: 'itm-monitor-sold', ownerId: 'usr-liam', title: 'Dell 27-inch Monitor',
      description: 'QHD monitor with adjustable stand and DisplayPort cable. Collected successfully through E-Swap.',
      category: 'Accessories', condition: 'Good', actionType: 'Buy', tokenPrice: 220,
      location: 'Luton', imageUrl: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1200&q=85',
      status: 'sold', createdAt: '2026-07-02T09:10:00.000Z', views: 89, buyerId: 'usr-alex', soldAt: '2026-07-10T17:30:00.000Z'
    }
  ],
  orders: [
    {
      id: 'ord-ipad', itemId: 'itm-ipad', buyerId: 'usr-alex', sellerId: 'usr-sarah',
      tokenAmount: 300, status: 'ready_for_collection', escrowStatus: 'held',
      createdAt: '2026-07-22T12:00:00.000Z', acceptedAt: '2026-07-22T12:30:00.000Z',
      readyAt: '2026-07-22T15:10:00.000Z', updatedAt: '2026-07-22T15:10:00.000Z',
      collectionNote: 'Meet near London Euston station. Please confirm after checking the device.',
      conversationId: 'cnv-alex-sarah-ipad'
    },
    {
      id: 'ord-monitor', itemId: 'itm-monitor-sold', buyerId: 'usr-alex', sellerId: 'usr-liam',
      tokenAmount: 220, status: 'completed', escrowStatus: 'released',
      createdAt: '2026-07-08T09:00:00.000Z', acceptedAt: '2026-07-08T09:15:00.000Z',
      readyAt: '2026-07-09T15:00:00.000Z', completedAt: '2026-07-10T17:30:00.000Z', updatedAt: '2026-07-10T17:30:00.000Z',
      conversationId: 'cnv-alex-liam-monitor'
    }
  ],
  recyclingRequests: [
    {
      id: 'rec-alex-dell',
      requesterId: 'usr-alex',
      deviceType: 'Laptop',
      brandModel: 'Dell Inspiron 15',
      condition: 'Not working',
      quantity: 1,
      location: 'Coventry',
      preferredDate: '2026-07-30',
      imageUrl: '/images/recycling-bin.jpg',
      notes: 'The laptop no longer powers on. The battery is still inside and the charger is available.',
      status: 'submitted',
      createdAt: '2026-07-23T09:15:00.000Z',
      updatedAt: '2026-07-23T09:15:00.000Z',
      conversationId: 'cnv-recycle-alex-admin',
      history: [
        {
          status: 'submitted',
          actorId: 'usr-alex',
          reason: 'Recycling request submitted for administrator review.',
          createdAt: '2026-07-23T09:15:00.000Z'
        }
      ]
    },
    {
      id: 'rec-liam-phones',
      requesterId: 'usr-liam',
      deviceType: 'Phone',
      brandModel: 'Two older Android phones',
      condition: 'For parts',
      quantity: 2,
      location: 'Luton',
      preferredDate: '2026-07-28',
      imageUrl: '/images/recycling-bin.jpg',
      notes: 'Both phones are factory reset. One has a swollen battery, so I have stopped using it.',
      status: 'approved',
      createdAt: '2026-07-21T14:00:00.000Z',
      updatedAt: '2026-07-22T10:30:00.000Z',
      approvedAt: '2026-07-22T10:30:00.000Z',
      adminReason: 'Approved for a supervised collection. Keep the swollen battery device switched off.',
      conversationId: 'cnv-recycle-liam-admin',
      history: [
        {
          status: 'submitted',
          actorId: 'usr-liam',
          reason: 'Recycling request submitted for administrator review.',
          createdAt: '2026-07-21T14:00:00.000Z'
        },
        {
          status: 'approved',
          actorId: 'usr-admin',
          reason: 'Approved for a supervised collection. Keep the swollen battery device switched off.',
          createdAt: '2026-07-22T10:30:00.000Z'
        }
      ]
    }
  ],
  conversations: [
    { id: 'cnv-alex-sarah-phone', participantIds: ['usr-alex', 'usr-sarah'], itemId: 'itm-phone', orderId: null, createdAt: '2026-07-22T10:00:00.000Z', updatedAt: '2026-07-22T10:06:00.000Z' },
    { id: 'cnv-alex-liam-ps5', participantIds: ['usr-alex', 'usr-liam'], itemId: 'itm-ps5', orderId: null, createdAt: '2026-07-22T08:30:00.000Z', updatedAt: '2026-07-22T09:15:00.000Z' },
    { id: 'cnv-alex-sarah-ipad', participantIds: ['usr-alex', 'usr-sarah'], itemId: 'itm-ipad', orderId: 'ord-ipad', createdAt: '2026-07-22T12:00:00.000Z', updatedAt: '2026-07-22T15:10:00.000Z' },
    { id: 'cnv-alex-liam-monitor', participantIds: ['usr-alex', 'usr-liam'], itemId: 'itm-monitor-sold', orderId: 'ord-monitor', createdAt: '2026-07-08T09:00:00.000Z', updatedAt: '2026-07-10T17:30:00.000Z' },
    {
      id: 'cnv-recycle-alex-admin',
      participantIds: ['usr-alex', 'usr-admin'],
      itemId: null,
      orderId: null,
      recyclingRequestId: 'rec-alex-dell',
      subject: 'Recycling request · Dell Inspiron 15',
      createdAt: '2026-07-23T09:15:00.000Z',
      updatedAt: '2026-07-23T09:15:00.000Z'
    },
    {
      id: 'cnv-recycle-liam-admin',
      participantIds: ['usr-liam', 'usr-admin'],
      itemId: null,
      orderId: null,
      recyclingRequestId: 'rec-liam-phones',
      subject: 'Recycling request · Two older Android phones',
      createdAt: '2026-07-21T14:00:00.000Z',
      updatedAt: '2026-07-22T10:30:00.000Z'
    }
  ],
  messages: [
    { id: 'msg-1', conversationId: 'cnv-alex-sarah-phone', senderId: 'usr-alex', body: 'Hi! Is the iPhone 13 still available?', createdAt: '2026-07-22T10:00:00.000Z', readBy: ['usr-alex', 'usr-sarah'] },
    { id: 'msg-2', conversationId: 'cnv-alex-sarah-phone', senderId: 'usr-sarah', body: 'Yes, it is available. The battery health is 91%.', createdAt: '2026-07-22T10:03:00.000Z', readBy: ['usr-sarah'] },
    { id: 'msg-3', conversationId: 'cnv-alex-sarah-phone', senderId: 'usr-alex', body: 'Great, thank you. I may buy it today.', createdAt: '2026-07-22T10:06:00.000Z', readBy: ['usr-alex'] },
    { id: 'msg-4', conversationId: 'cnv-alex-liam-ps5', senderId: 'usr-liam', body: 'Thanks for your interest. I can meet in central Luton.', createdAt: '2026-07-22T09:15:00.000Z', readBy: ['usr-liam'] },
    { id: 'msg-ipad-1', conversationId: 'cnv-alex-sarah-ipad', senderId: 'system', body: '300 E-Tokens are protected in escrow while this order is completed.', createdAt: '2026-07-22T12:00:00.000Z', readBy: ['usr-alex', 'usr-sarah'] },
    { id: 'msg-ipad-2', conversationId: 'cnv-alex-sarah-ipad', senderId: 'usr-sarah', body: 'The iPad is ready. We can meet near Euston station tomorrow afternoon.', createdAt: '2026-07-22T15:10:00.000Z', readBy: ['usr-sarah'] },
    { id: 'msg-monitor-1', conversationId: 'cnv-alex-liam-monitor', senderId: 'system', body: 'Order completed. 220 E-Tokens were released to Liam.', createdAt: '2026-07-10T17:30:00.000Z', readBy: ['usr-alex', 'usr-liam'] },
    { id: 'msg-rec-alex-1', conversationId: 'cnv-recycle-alex-admin', senderId: 'system', body: 'Recycling request submitted. An administrator will review the device details.', createdAt: '2026-07-23T09:15:00.000Z', readBy: ['usr-alex'] },
    { id: 'msg-rec-liam-1', conversationId: 'cnv-recycle-liam-admin', senderId: 'system', body: 'Recycling request submitted. An administrator will review the device details.', createdAt: '2026-07-21T14:00:00.000Z', readBy: ['usr-liam', 'usr-admin'] },
    { id: 'msg-rec-liam-2', conversationId: 'cnv-recycle-liam-admin', senderId: 'usr-admin', body: 'Your request is approved. Keep the phone with the swollen battery switched off and do not charge it.', createdAt: '2026-07-22T10:30:00.000Z', readBy: ['usr-admin', 'usr-liam'] }
  ],
  notifications: [
    { id: 'not-alex-welcome', userId: 'usr-alex', type: 'tokens', title: 'Starter reward received', body: '100 E-Tokens were added when your account was created.', link: '/wallet', read: true, createdAt: '2026-06-18T10:31:00.000Z' },
    { id: 'not-alex-message', userId: 'usr-alex', type: 'message', title: 'Collection is ready', body: 'Sarah marked your iPad Mini order ready for collection.', link: '/orders', read: false, createdAt: '2026-07-22T15:10:00.000Z' },
    { id: 'not-sarah-listing', userId: 'usr-sarah', type: 'listing', title: 'Your listing is live', body: 'MacBook Air M1 is visible in the marketplace.', link: '/my-items', read: false, createdAt: '2026-07-15T09:31:00.000Z' },
    { id: 'not-admin-recycling', userId: 'usr-admin', type: 'recycling', title: 'New recycling request', body: 'Alex submitted a Dell Inspiron 15 for recycling review.', link: '/admin', read: false, createdAt: '2026-07-23T09:15:00.000Z' },
    { id: 'not-liam-recycling', userId: 'usr-liam', type: 'recycling', title: 'Recycling request approved', body: 'Approved for a supervised collection. Keep the swollen battery device switched off.', link: '/recycling', read: false, createdAt: '2026-07-22T10:30:00.000Z' }
  ],
  transactions: [
    { id: 'tx-alex-reward', userId: 'usr-alex', type: 'signup_reward', amount: 100, balanceAfter: 100, heldAfter: 0, description: 'New account starter reward', createdAt: '2026-06-18T10:31:00.000Z' },
    { id: 'tx-alex-admin', userId: 'usr-alex', type: 'admin_adjustment', amount: 1150, balanceAfter: 1250, heldAfter: 0, description: 'Community launch reward', createdAt: '2026-07-01T12:00:00.000Z' },
    { id: 'tx-alex-monitor', userId: 'usr-alex', type: 'purchase', amount: -220, balanceAfter: 1030, heldAfter: 0, description: 'Purchased Dell 27-inch Monitor', itemId: 'itm-monitor-sold', orderId: 'ord-monitor', relatedUserId: 'usr-liam', createdAt: '2026-07-08T09:00:00.000Z' },
    { id: 'tx-alex-ipad-hold', userId: 'usr-alex', type: 'purchase_hold', amount: -300, balanceAfter: 950, heldAfter: 300, description: 'Escrow hold for iPad Mini 6', itemId: 'itm-ipad', orderId: 'ord-ipad', relatedUserId: 'usr-sarah', createdAt: '2026-07-22T12:00:00.000Z' },
    { id: 'tx-sarah-reward', userId: 'usr-sarah', type: 'signup_reward', amount: 100, balanceAfter: 100, heldAfter: 0, description: 'New account starter reward', createdAt: '2026-06-20T13:11:00.000Z' },
    { id: 'tx-sarah-admin', userId: 'usr-sarah', type: 'admin_adjustment', amount: 800, balanceAfter: 900, heldAfter: 0, description: 'Early adopter reward', createdAt: '2026-07-02T09:00:00.000Z' },
    { id: 'tx-liam-sale', userId: 'usr-liam', type: 'sale_release', amount: 220, balanceAfter: 840, heldAfter: 0, description: 'Escrow released for Dell 27-inch Monitor', itemId: 'itm-monitor-sold', orderId: 'ord-monitor', relatedUserId: 'usr-alex', createdAt: '2026-07-10T17:30:00.000Z' }
  ],
  reviews: [
    { id: 'rev-1', orderId: 'ord-monitor', reviewerId: 'usr-alex', targetUserId: 'usr-liam', rating: 5, comment: 'Friendly seller and the monitor matched the description.', createdAt: '2026-07-10T18:00:00.000Z' },
    { id: 'rev-2', orderId: 'ord-monitor', reviewerId: 'usr-liam', targetUserId: 'usr-alex', rating: 5, comment: 'Quick communication and an easy collection.', createdAt: '2026-07-10T18:05:00.000Z' }
  ],
  reports: [
    { id: 'rpt-1', targetType: 'listing', targetId: 'itm-ps5', itemId: 'itm-ps5', reporterId: 'usr-sarah', reason: 'Potentially misleading information', details: 'The description should include the controller condition.', status: 'pending', createdAt: '2026-07-22T11:15:00.000Z' }
  ],
  auditLog: [
    { id: 'audit-rec-1', actorId: 'usr-admin', action: 'RECYCLING_REQUEST_APPROVED', details: 'Approved recycling request rec-liam-phones. Reason: Approved for a supervised collection. Keep the swollen battery device switched off.', metadata: { recyclingRequestId: 'rec-liam-phones', requesterId: 'usr-liam', fromStatus: 'submitted', toStatus: 'approved' }, createdAt: '2026-07-22T10:30:00.000Z' },
    { id: 'audit-1', actorId: 'usr-admin', action: 'PLATFORM_INITIALISED', details: 'E-Swap 2.2 local demo data created with audited escrow and recycling workflows.', createdAt: '2026-07-22T08:00:00.000Z' }
  ]
};

export const categoryOptions = ['Laptop', 'Phone', 'Audio', 'Gaming', 'Wearables', 'Tablet', 'Accessories', 'Other'];
export const conditionOptions = ['New', 'Like New', 'Excellent', 'Very Good', 'Good', 'Fair', 'For Parts'];
export const actionOptions = ['Buy', 'Exchange', 'Donate'];

export const orderStatusLabels = {
  pending_seller: 'Waiting for seller',
  awaiting_collection: 'Arrange collection',
  ready_for_collection: 'Ready for collection',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  disputed: 'Disputed',
  refunded: 'Refunded'
};

export const recyclingStatusLabels = {
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed'
};
