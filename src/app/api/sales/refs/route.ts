import type { NextRequest } from "next/server";
import { apiOk, requireSession, runApi } from "@/lib/api";
import { getSaleRefs } from "@/server/sales";

export async function GET(req: NextRequest) {
  return runApi(async () => {
    const session = await requireSession(req);
    const refs = await getSaleRefs(session.company.id);
    return apiOk(refs);
  });
}
