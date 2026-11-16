// Notifications, staff daycares, and the Admin payment confirmation.
import { readObject } from "./http.js";
import { boolean, integer, oneOf, requestId, rpc, text, uuid } from "./validate.js";

export async function listNotifications(context, searchParams) {
  const unread = searchParams.get("unread");
  const limit = searchParams.get("limit");
  return rpc(context, "app_list_my_notifications", {
    p_only_unread: unread === "true" || unread === "1",
    p_limit: limit == null ? 50 : integer(Number(limit), "limit", { min: 1, max: 100, label: "Batas" }),
  });
}

export async function markNotification(context, request, id) {
  uuid(id, "notification_id", "ID notifikasi");
  const body = await readObject(request, ["read"]);
  await rpc(context, "app_mark_notification", { p_notification_id: id, p_read: boolean(body.read, "read", "Status baca") });
  return { id, read: body.read };
}

export const listMyDaycares = context => rpc(context, "app_list_my_daycares");

// Pengasuh: enrollments currently assigned to the caller (logbook entry point).
export const listMyAssignments = context => rpc(context, "app_caregiver_list_assignments");

// Admin: transactions waiting for a manual confirmation (default: created and
// pending), or one status via ?status=.
export async function listAdminPayments(context, searchParams) {
  const status = searchParams.get("status");
  return rpc(context, "app_admin_list_payments", {
    p_status: status ? oneOf(status, "status", ["created", "pending", "succeeded", "failed", "expired"], "Status pembayaran") : null,
  });
}

// Manual payment confirmation until a payment gateway is integrated.
export async function recordPaymentResult(context, request, transactionId) {
  uuid(transactionId, "transaction_id", "ID transaksi");
  const body = await readObject(request, ["status", "provider", "provider_transaction_id", "receipt_reference", "provider_fee_amount", "reason"]);
  await rpc(context, "app_admin_record_payment_result", {
    p_transaction_id: transactionId,
    p_status: oneOf(body.status, "status", ["pending", "succeeded", "failed", "expired"], "Status pembayaran"),
    p_provider: text(body.provider, "provider", { min: 2, max: 50, label: "Penyedia pembayaran" }),
    p_provider_transaction_id: text(body.provider_transaction_id, "provider_transaction_id", { max: 100, label: "ID transaksi penyedia", optional: true }),
    p_method_details: {},
    p_provider_fee_amount: body.provider_fee_amount == null ? 0
      : integer(body.provider_fee_amount, "provider_fee_amount", { min: 0, max: 100_000_000, label: "Biaya penyedia" }),
    p_receipt_reference: text(body.receipt_reference, "receipt_reference", { max: 100, label: "Nomor bukti", optional: true }),
    p_reason: text(body.reason, "reason", { min: 5, max: 500, label: "Catatan verifikasi" }),
    p_request_id: requestId(request),
  });
  return { transaction_id: transactionId, status: body.status };
}
