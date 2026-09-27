import { cookies } from "next/headers";
import { SERVICE_ADMIN_COOKIE, validAdminSession } from "@/lib/demo-admin-auth";
import AdminLogin from "./AdminLogin";
import QaConsole from "./QaConsole";
import "./demo-admin.css";

export const dynamic = "force-dynamic";

export default async function DemoAdminPage() {
  const store = await cookies();
  const authenticated = validAdminSession(store.get(SERVICE_ADMIN_COOKIE)?.value);
  return authenticated ? <QaConsole /> : <AdminLogin />;
}
