'use strict';

const asyncHandler = require('../middleware/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const { query } = require('../db/pool');
const ApiError = require('../utils/ApiError');

/**
 * Get change notifications for the authenticated user
 */
const list = asyncHandler(async (req, res) => {
  const { unreadOnly } = req.query;
  let whereClause = 'WHERE cn.recipient_account_id = $1';
  const params = [req.user.id];
  
  if (unreadOnly === 'true') {
    whereClause += ' AND cn.read_at IS NULL';
  }
  
  const result = await query(
    `SELECT cn.*, sv.name as schedule_version_name
     FROM change_notifications cn
     LEFT JOIN schedule_versions sv ON sv.id = cn.schedule_version_id
     ${whereClause}
     ORDER BY cn.created_at DESC`,
    params
  );
  
  return ok(res, result.rows);
});

/**
 * Mark a notification as read
 */
const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const result = await query(
    `UPDATE change_notifications 
     SET read_at = now() 
     WHERE id = $1 AND recipient_account_id = $2 
     RETURNING *`,
    [id, req.user.id]
  );
  
  if (!result.rows.length) {
    throw ApiError.notFound('Notification not found');
  }
  
  return ok(res, result.rows[0]);
});

/**
 * Mark all notifications as read
 */
const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE change_notifications 
     SET read_at = now() 
     WHERE recipient_account_id = $1 AND read_at IS NULL
     RETURNING *`,
    [req.user.id]
  );
  
  return ok(res, { updated: result.rowCount });
});

/**
 * Create a change notification (internal use)
 */
async function createNotification({ recipientAccountId, scheduleVersionId, allocationId, changeType, message }) {
  const { query } = require('../db/pool');
  const result = await query(
    `INSERT INTO change_notifications (recipient_account_id, schedule_version_id, allocation_id, change_type, message)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [recipientAccountId, scheduleVersionId, allocationId, changeType, message]
  );
  return result.rows[0];
}

module.exports = { list, markAsRead, markAllAsRead, createNotification };