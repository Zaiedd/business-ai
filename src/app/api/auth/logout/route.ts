import type { NextRequest } from "next/server";
import { clearSessionCookie, getSession, revokeSession, writeAudit } from "@/lib/auth";
import { apiOk, runApi } from "@/lib/api";

export async function POST(req: NextRequest) {
  return runApi(async () => {
    const session = await getSession(req);
    if (session) {
      await revokeSession(session.token);
      await writeAudit({ action: "AUTH.LOGOUT", companyId: session.company.id, userId: session.user.id, req });
    }
    const response = apiOk({ success: true });
    clearSessionCookie(response, req);
    return response;
  });
}
