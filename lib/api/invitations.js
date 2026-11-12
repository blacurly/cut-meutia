import { createHash } from "node:crypto";
import { ApiError, readObject } from "./http.js";
import { rpc, requestId, text } from "./validate.js";

export async function acceptInvitation(context, request) {
  const body = await readObject(request, ["token"]);
  const token = text(body.token, "invitation_token", { min: 32, max: 100, label: "Token undangan" });
  if (!/^[A-Za-z0-9_-]+$/.test(token)) {
    throw new ApiError(400, "invalid_invitation_token", "Token undangan tidak valid.");
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return rpc(context, "app_accept_staff_invitation", {
    p_token_hash: tokenHash,
    p_request_id: requestId(request),
  });
}
