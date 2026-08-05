import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userName={session.user.name}
        userEmail={session.user.email}
        role={session.user.role}
        companyName={session.company.name}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav
          userName={session.user.name}
          userEmail={session.user.email}
          role={session.user.role}
          companyName={session.company.name}
        />
        <Header companyName={session.company.name} branchName={session.branch?.name ?? null} role={session.user.role} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
