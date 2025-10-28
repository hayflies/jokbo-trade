const crypto = require('crypto');

const store = {
  users: new Map(),
  auctions: new Map(),
  reports: new Map(),
  transactions: new Map(),
  payouts: new Map(),
  announcements: new Map(),
  settings: new Map(),
  notifications: new Map(),
  auditLogs: new Map(),
  integrations: new Map(),
  invitations: new Map(),
  systemSessions: new Map(),
  systemCacheClearedAt: null,
  lastHealthCheckAt: null
};

const seeded = { value: false };

function generateId(prefix) {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function seedStore() {
  if (seeded.value) {
    return;
  }
  seeded.value = true;
  const adminUser = createUser({
    name: 'Admin Controller',
    email: 'admin@example.com',
    status: 'ACTIVE'
  });
  adminUser.activity.push({
    id: generateId('activity'),
    type: 'LOGIN',
    createdAt: new Date().toISOString(),
    description: 'Administrator logged in to seed system'
  });

  const reviewer = createUser({
    name: 'Quality Reviewer',
    email: 'quality@example.com',
    status: 'SUSPENDED'
  });
  addUserWarning(reviewer.id, 'Multiple failed login attempts recorded');

  const auctionOne = createAuction({
    title: 'Linear Algebra Notes',
    status: 'OPEN',
    sellerId: adminUser.id,
    startingPrice: 10
  });
  addAuctionBid(auctionOne.id, {
    bidderId: reviewer.id,
    bidderName: 'Quality Reviewer',
    amount: 12
  });

  const auctionTwo = createAuction({
    title: 'Organic Chemistry Lab Reports',
    status: 'CLOSED',
    sellerId: reviewer.id,
    startingPrice: 25
  });

  const report = createReport({
    type: 'FRAUD',
    status: 'OPEN',
    auctionId: auctionTwo.id,
    reporterId: adminUser.id,
    description: 'Suspicious bidding pattern detected'
  });
  assignReport(report.id, adminUser.id);

  const transaction = createTransaction({
    auctionId: auctionOne.id,
    amount: 12,
    status: 'SETTLED',
    buyerId: reviewer.id
  });

  createPayout({
    transactionId: transaction.id,
    amount: 10,
    status: 'PENDING',
    recipientId: adminUser.id
  });

  createAnnouncement({
    title: 'System Maintenance',
    body: 'Scheduled maintenance on Friday 10pm KST',
    status: 'DRAFT'
  });

  updateSetting('platformName', {
    key: 'platformName',
    value: 'Jokbo Trade',
    updatedAt: new Date().toISOString()
  });

  createNotification({
    type: 'SYSTEM',
    message: 'Welcome administrators!',
    audience: 'admins'
  });

  createAuditLog({
    actorId: adminUser.id,
    action: 'SEED',
    resource: 'system',
    metadata: { message: 'Initial seed completed' }
  });

  createIntegration({
    name: 'email-delivery',
    config: { provider: 'ses', region: 'ap-northeast-2' },
    status: 'ACTIVE'
  });

  createInvitation({
    email: 'newmoderator@example.com',
    role: 'moderator'
  });

  createSystemSession({
    userId: adminUser.id,
    userAgent: 'seed-script'
  });
}

function toArray(resource) {
  return Array.from(store[resource].values());
}

function createUser({ name, email, status }) {
  const id = generateId('user');
  const user = {
    id,
    name,
    email,
    status: status || 'ACTIVE',
    warnings: [],
    activity: [],
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };
  store.users.set(id, user);
  return user;
}

function listUsers() {
  seedStore();
  return toArray('users');
}

function getUser(id) {
  seedStore();
  return store.users.get(id) || null;
}

function updateUser(id, updates) {
  const user = getUser(id);
  if (!user) {
    return null;
  }
  Object.assign(user, updates, { updatedAt: new Date().toISOString() });
  return user;
}

function deleteUser(id) {
  const existed = store.users.delete(id);
  return existed;
}

function addUserWarning(id, message) {
  const user = getUser(id);
  if (!user) {
    return null;
  }
  const warning = {
    id: generateId('warning'),
    message,
    createdAt: new Date().toISOString()
  };
  user.warnings.push(warning);
  return warning;
}

function removeUserWarning(userId, warningId) {
  const user = getUser(userId);
  if (!user) {
    return null;
  }
  const index = user.warnings.findIndex((warning) => warning.id === warningId);
  if (index === -1) {
    return null;
  }
  const [removed] = user.warnings.splice(index, 1);
  return removed;
}

function recordUserActivity(id, activity) {
  const user = getUser(id);
  if (!user) {
    return null;
  }
  const entry = {
    id: generateId('activity'),
    createdAt: new Date().toISOString(),
    ...activity
  };
  user.activity.unshift(entry);
  if (user.activity.length > 50) {
    user.activity.length = 50;
  }
  return entry;
}

function setUserStatus(id, status) {
  return updateUser(id, { status });
}

function createAuction({ title, status, sellerId, startingPrice }) {
  const id = generateId('auction');
  const auction = {
    id,
    title,
    status: status || 'OPEN',
    sellerId,
    startingPrice: typeof startingPrice === 'number' ? startingPrice : 0,
    bids: [],
    createdAt: new Date().toISOString()
  };
  store.auctions.set(id, auction);
  return auction;
}

function listAuctions() {
  seedStore();
  return toArray('auctions');
}

function getAuction(id) {
  seedStore();
  return store.auctions.get(id) || null;
}

function updateAuction(id, updates) {
  const auction = getAuction(id);
  if (!auction) {
    return null;
  }
  Object.assign(auction, updates, { updatedAt: new Date().toISOString() });
  return auction;
}

function deleteAuction(id) {
  return store.auctions.delete(id);
}

function addAuctionBid(id, { bidderId, bidderName, amount }) {
  const auction = getAuction(id);
  if (!auction) {
    return null;
  }
  const bid = {
    id: generateId('bid'),
    bidderId,
    bidderName,
    amount,
    createdAt: new Date().toISOString()
  };
  auction.bids.push(bid);
  return bid;
}

function removeAuctionBid(auctionId, bidId) {
  const auction = getAuction(auctionId);
  if (!auction) {
    return null;
  }
  const index = auction.bids.findIndex((bid) => bid.id === bidId);
  if (index === -1) {
    return null;
  }
  const [removed] = auction.bids.splice(index, 1);
  return removed;
}

function setAuctionStatus(id, status) {
  return updateAuction(id, { status });
}

function createReport({ type, status, auctionId, reporterId, description }) {
  const id = generateId('report');
  const report = {
    id,
    type,
    status: status || 'OPEN',
    auctionId,
    reporterId,
    description,
    assignedTo: null,
    createdAt: new Date().toISOString()
  };
  store.reports.set(id, report);
  return report;
}

function listReports() {
  seedStore();
  return toArray('reports');
}

function getReport(id) {
  seedStore();
  return store.reports.get(id) || null;
}

function updateReport(id, updates) {
  const report = getReport(id);
  if (!report) {
    return null;
  }
  Object.assign(report, updates, { updatedAt: new Date().toISOString() });
  return report;
}

function deleteReport(id) {
  return store.reports.delete(id);
}

function resolveReport(id, resolution) {
  return updateReport(id, { status: 'RESOLVED', resolution });
}

function assignReport(id, assigneeId) {
  return updateReport(id, { assignedTo: assigneeId });
}

function createTransaction({ auctionId, amount, status, buyerId }) {
  const id = generateId('transaction');
  const transaction = {
    id,
    auctionId,
    amount,
    status: status || 'PENDING',
    buyerId,
    refunds: [],
    createdAt: new Date().toISOString()
  };
  store.transactions.set(id, transaction);
  return transaction;
}

function listTransactions() {
  seedStore();
  return toArray('transactions');
}

function getTransaction(id) {
  seedStore();
  return store.transactions.get(id) || null;
}

function updateTransaction(id, updates) {
  const transaction = getTransaction(id);
  if (!transaction) {
    return null;
  }
  Object.assign(transaction, updates, { updatedAt: new Date().toISOString() });
  return transaction;
}

function deleteTransaction(id) {
  return store.transactions.delete(id);
}

function setTransactionStatus(id, status) {
  return updateTransaction(id, { status });
}

function recordRefund(transactionId, amount, reason) {
  const transaction = getTransaction(transactionId);
  if (!transaction) {
    return null;
  }
  const refund = {
    id: generateId('refund'),
    amount,
    reason,
    createdAt: new Date().toISOString()
  };
  transaction.refunds.push(refund);
  transaction.updatedAt = new Date().toISOString();
  return refund;
}

function createPayout({ transactionId, amount, status, recipientId }) {
  const id = generateId('payout');
  const payout = {
    id,
    transactionId,
    amount,
    status: status || 'PENDING',
    recipientId,
    createdAt: new Date().toISOString()
  };
  store.payouts.set(id, payout);
  return payout;
}

function listPayouts() {
  seedStore();
  return toArray('payouts');
}

function getPayout(id) {
  seedStore();
  return store.payouts.get(id) || null;
}

function updatePayout(id, updates) {
  const payout = getPayout(id);
  if (!payout) {
    return null;
  }
  Object.assign(payout, updates, { updatedAt: new Date().toISOString() });
  return payout;
}

function deletePayout(id) {
  return store.payouts.delete(id);
}

function setPayoutStatus(id, status) {
  return updatePayout(id, { status });
}

function createAnnouncement({ title, body, status }) {
  const id = generateId('announcement');
  const announcement = {
    id,
    title,
    body,
    status: status || 'DRAFT',
    publishedAt: null,
    createdAt: new Date().toISOString()
  };
  store.announcements.set(id, announcement);
  return announcement;
}

function listAnnouncements() {
  seedStore();
  return toArray('announcements');
}

function getAnnouncement(id) {
  seedStore();
  return store.announcements.get(id) || null;
}

function updateAnnouncement(id, updates) {
  const announcement = getAnnouncement(id);
  if (!announcement) {
    return null;
  }
  Object.assign(announcement, updates, { updatedAt: new Date().toISOString() });
  return announcement;
}

function deleteAnnouncement(id) {
  return store.announcements.delete(id);
}

function publishAnnouncement(id) {
  return updateAnnouncement(id, { status: 'PUBLISHED', publishedAt: new Date().toISOString() });
}

function listSettings() {
  seedStore();
  return toArray('settings');
}

function createSetting(key, value) {
  const payload = { key, value, createdAt: new Date().toISOString() };
  store.settings.set(key, payload);
  return payload;
}

function updateSetting(key, value) {
  const record = store.settings.get(key) || { key };
  Object.assign(record, value, { key, updatedAt: new Date().toISOString() });
  store.settings.set(key, record);
  return record;
}

function deleteSetting(key) {
  return store.settings.delete(key);
}

function createNotification({ type, message, audience }) {
  const id = generateId('notification');
  const notification = {
    id,
    type,
    message,
    audience,
    status: 'QUEUED',
    createdAt: new Date().toISOString()
  };
  store.notifications.set(id, notification);
  return notification;
}

function listNotifications() {
  seedStore();
  return toArray('notifications');
}

function getNotification(id) {
  seedStore();
  return store.notifications.get(id) || null;
}

function updateNotification(id, updates) {
  const notification = getNotification(id);
  if (!notification) {
    return null;
  }
  Object.assign(notification, updates, { updatedAt: new Date().toISOString() });
  return notification;
}

function deleteNotification(id) {
  return store.notifications.delete(id);
}

function createAuditLog({ actorId, action, resource, metadata }) {
  const id = generateId('audit');
  const log = {
    id,
    actorId,
    action,
    resource,
    metadata: metadata || {},
    flagged: false,
    createdAt: new Date().toISOString()
  };
  store.auditLogs.set(id, log);
  return log;
}

function listAuditLogs() {
  seedStore();
  return toArray('auditLogs');
}

function getAuditLog(id) {
  seedStore();
  return store.auditLogs.get(id) || null;
}

function deleteAuditLog(id) {
  return store.auditLogs.delete(id);
}

function flagAuditLog(id, flagged, reason) {
  const log = getAuditLog(id);
  if (!log) {
    return null;
  }
  log.flagged = Boolean(flagged);
  if (reason) {
    log.flagReason = reason;
  }
  log.updatedAt = new Date().toISOString();
  return log;
}

function searchAuditLogs(filters) {
  const logs = listAuditLogs();
  if (!filters || Object.keys(filters).length === 0) {
    return logs;
  }
  return logs.filter((log) => {
    if (filters.actorId && log.actorId !== filters.actorId) {
      return false;
    }
    if (filters.action && log.action !== filters.action) {
      return false;
    }
    if (filters.resource && log.resource !== filters.resource) {
      return false;
    }
    return true;
  });
}

function createIntegration({ name, config, status }) {
  const integration = {
    name,
    config: config || {},
    status: status || 'INACTIVE',
    lastTestedAt: null,
    createdAt: new Date().toISOString()
  };
  store.integrations.set(name, integration);
  return integration;
}

function getIntegration(name) {
  seedStore();
  return store.integrations.get(name) || null;
}

function updateIntegration(name, updates) {
  const integration = getIntegration(name);
  if (!integration) {
    return null;
  }
  Object.assign(integration, updates, { updatedAt: new Date().toISOString() });
  return integration;
}

function deleteIntegration(name) {
  return store.integrations.delete(name);
}

function testIntegration(name, payload) {
  const integration = getIntegration(name);
  if (!integration) {
    return null;
  }
  integration.lastTestedAt = new Date().toISOString();
  integration.lastTestPayload = payload;
  return {
    success: true,
    testedAt: integration.lastTestedAt,
    integration
  };
}

function createInvitation({ email, role }) {
  const id = generateId('invitation');
  const invitation = {
    id,
    email,
    role,
    status: 'SENT',
    createdAt: new Date().toISOString()
  };
  store.invitations.set(id, invitation);
  return invitation;
}

function deleteInvitation(id) {
  return store.invitations.delete(id);
}

function listSystemSessions() {
  seedStore();
  return toArray('systemSessions');
}

function createSystemSession({ userId, userAgent }) {
  const id = generateId('session');
  const session = {
    id,
    userId,
    userAgent,
    createdAt: new Date().toISOString()
  };
  store.systemSessions.set(id, session);
  return session;
}

function deleteSystemSession(id) {
  return store.systemSessions.delete(id);
}

function clearSystemCache() {
  store.systemCacheClearedAt = new Date().toISOString();
  return { clearedAt: store.systemCacheClearedAt };
}

function getSystemHealth() {
  seedStore();
  const now = new Date().toISOString();
  store.lastHealthCheckAt = now;
  return {
    status: 'ok',
    checkedAt: now,
    services: [
      { name: 'database', status: 'ok' },
      { name: 'messageQueue', status: 'ok' },
      { name: 'objectStorage', status: 'ok' }
    ]
  };
}

function getSystemStats() {
  seedStore();
  return {
    users: store.users.size,
    auctions: store.auctions.size,
    reports: store.reports.size,
    transactions: store.transactions.size,
    payouts: store.payouts.size,
    notifications: store.notifications.size,
    cacheClearedAt: store.systemCacheClearedAt,
    lastHealthCheckAt: store.lastHealthCheckAt
  };
}

module.exports = {
  seedStore,
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  addUserWarning,
  removeUserWarning,
  recordUserActivity,
  setUserStatus,
  listAuctions,
  getAuction,
  createAuction,
  updateAuction,
  deleteAuction,
  addAuctionBid,
  removeAuctionBid,
  setAuctionStatus,
  listReports,
  getReport,
  createReport,
  updateReport,
  deleteReport,
  resolveReport,
  assignReport,
  listTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  setTransactionStatus,
  recordRefund,
  listPayouts,
  getPayout,
  createPayout,
  updatePayout,
  deletePayout,
  setPayoutStatus,
  listAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  listSettings,
  createSetting,
  updateSetting,
  deleteSetting,
  listNotifications,
  getNotification,
  createNotification,
  updateNotification,
  deleteNotification,
  createAuditLog,
  listAuditLogs,
  getAuditLog,
  deleteAuditLog,
  flagAuditLog,
  searchAuditLogs,
  createIntegration,
  getIntegration,
  updateIntegration,
  deleteIntegration,
  testIntegration,
  createInvitation,
  deleteInvitation,
  listSystemSessions,
  createSystemSession,
  deleteSystemSession,
  clearSystemCache,
  getSystemHealth,
  getSystemStats
};
