import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <main style={{ background: "#07060F", minHeight: "100vh", color: "#FFFFFE", padding: "2rem" }}>
      <h1>Dashboard — coming soon</h1>
      <p>Logged in as: {session.user.name} ({session.user.role})</p>
    </main>
  );
}
