"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, UserPlus } from "lucide-react";
import { ROLE_LABELS, ROLE_RANK } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";
import { useToast } from "@/components/ui/toast";

interface TeamUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  branch: { id: string; name: string } | null;
}

interface Branch { id: string; name: string; address: string | null; city: string | null }

export default function TeamPage() {
  const { toast } = useToast();
  const { t, locale } = useI18n();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [myRole, setMyRole] = useState<string>("OWNER");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [branchId, setBranchId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/team", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t("team.loadFailed"));
      setUsers(body.data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("team.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
    fetch("/api/settings/branches", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => setBranches(b.data?.branches ?? []))
      .catch(() => {});
  }, [load]);

  useEffect(() => {
    fetch("/api/dashboard/overview?range=7d", { cache: "no-store" })
      .then((r) => r.json())
      .then((b) => b.data?.role && setMyRole(b.data.role))
      .catch(() => {});
  }, []);

  const manageableRoles = (Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[]).filter((r) => ROLE_RANK[myRole as keyof typeof ROLE_RANK] > ROLE_RANK[r]);

  async function changeRole(userId: string, newRole: string) {
    const res = await fetch("/api/team/role", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    });
    const body = await res.json();
    if (!res.ok) {
      toast(body.error ?? t("team.roleFailed"), "error");
      return;
    }
    load();
  }

  async function toggleStatus(user: TeamUser) {
    const next = user.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    const res = await fetch("/api/team/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, status: next }),
    });
    const body = await res.json();
    if (!res.ok) {
      toast(body.error ?? t("team.statusFailed"), "error");
      return;
    }
    load();
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError(null);
    setInviting(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, branchId: branchId || null }),
      });
      const body = await res.json();
      if (!res.ok) {
        setInviteError(body.error ?? t("team.inviteFailed"));
        setInviting(false);
        return;
      }
      setShowInvite(false);
      setName(""); setEmail(""); setRole("EMPLOYEE"); setBranchId("");
      load();
    } catch {
      setInviteError(t("common.networkError"));
      setInviting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t("team.title")}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("team.subtitle")}</p>
        </div>
        <Button onClick={() => setShowInvite((v) => !v)}>
          <UserPlus className="size-4" />
          {t("team.invite")}
        </Button>
      </div>

      {error && (
        <Card className="border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40">
          <CardBody className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300">
            <AlertCircle className="size-4" />
            {error}
            <Button variant="danger" size="sm" className="ms-auto" onClick={load}>{t("common.retry")}</Button>
          </CardBody>
        </Card>
      )}

      {showInvite && (
        <Card>
          <CardHeader title={t("team.inviteCardTitle")} subtitle={t("team.inviteCardSubtitle")} />
          <CardBody>
            <form onSubmit={invite} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input label={t("team.fullName")} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
              <Input label={t("team.email")} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" />
              <Select
                label={t("team.role")}
                options={manageableRoles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
              <Select
                label={t("team.branch")}
                options={[{ value: "", label: t("common.allBranches") }, ...branches.map((b) => ({ value: b.id, label: b.name }))]}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              />
              <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3">
                {inviteError && <p className="text-sm text-rose-600">{inviteError}</p>}
                <Button variant="ghost" size="md" onClick={() => { setShowInvite(false); setError(null); }}>
                  {t("common.cancel") || "Cancel"}
                </Button>
                <Button type="submit" loading={inviting} className="ms-auto">
                  {t("team.sendInvite")}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title={t("team.members")} subtitle={users.length === 1 ? t("team.memberCount", { count: String(users.length) }) : t("team.memberCountPlural", { count: String(users.length) })} />
        <CardBody className="-mx-5 overflow-x-auto px-5">
          {loading ? (
            <div className="grid gap-3 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-start text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
                  <th className="py-2 pe-4 font-semibold">{t("team.member")}</th>
                  <th className="py-2 pe-4 font-semibold">{t("team.role")}</th>
                  <th className="py-2 pe-4 font-semibold">{t("team.branch")}</th>
                  <th className="py-2 pe-4 font-semibold">{t("team.lastLogin")}</th>
                  <th className="py-2 pe-4 font-semibold">{t("team.status")}</th>
                  <th className="py-2 text-end font-semibold">{t("team.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 pe-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{u.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{u.email}</div>
                    </td>
                    <td className="py-3 pe-4">
                      {ROLE_RANK[myRole as keyof typeof ROLE_RANK] > ROLE_RANK[u.role as keyof typeof ROLE_RANK] ? (
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u.id, e.target.value)}
                          className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          {Object.entries(ROLE_LABELS).map(([val, label]) => (
                            <option key={val} value={val} disabled={ROLE_RANK[myRole as keyof typeof ROLE_RANK] <= ROLE_RANK[val as keyof typeof ROLE_RANK]}>{label}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge variant="brand">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]}</Badge>
                      )}
                    </td>
                    <td className="py-3 pe-4 text-slate-600 dark:text-slate-400">{u.branch?.name ?? t("common.allBranches")}</td>
                    <td className="py-3 pe-4 text-slate-500 dark:text-slate-400">{u.lastLoginAt ? formatDate(u.lastLoginAt, locale) : t("common.never")}</td>
                    <td className="py-3 pe-4">
                      <Badge variant={u.status === "ACTIVE" ? "success" : "neutral"}>{t(`team.statusLabels.${u.status}`)}</Badge>
                    </td>
                    <td className="py-3 text-end">
                      {u.role !== "OWNER" && u.role !== myRole && (
                        <Button variant="ghost" size="sm" onClick={() => toggleStatus(u)}>
                          {u.status === "ACTIVE" ? t("team.disable") : t("team.enable")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {!loading && !error && users.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t("team.empty") || "No team members yet."}</p>
        </div>
      )}
    </div>
  );
}
