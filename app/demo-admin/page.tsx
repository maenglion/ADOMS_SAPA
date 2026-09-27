import { cookies } from "next/headers";
import type { Metadata } from "next";
import { SERVICE_ADMIN_COOKIE, validAdminSession } from "@/lib/demo-admin-auth";
import AdminLogin from "./AdminLogin";
import QaConsole from "./QaConsole";
import "./demo-admin.css";

export const dynamic = "force-dynamic";

const adminTitle = "시연용 관리자 시스템";
const adminDescription = "시연리뷰, 캐시관리, 성능점검, 시연데이터";

export const metadata: Metadata = {
  title: adminTitle,
  description: adminDescription,
  openGraph: {
    title: adminTitle,
    description: adminDescription,
    images: [{
      url: "/demo-admin/opengraph-image",
      width: 1200,
      height: 630,
      alt: "ADOMS 시연용 관리자 시스템",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: adminTitle,
    description: adminDescription,
    images: ["/demo-admin/opengraph-image"],
  },
};

export default async function DemoAdminPage() {
  const store = await cookies();
  const authenticated = validAdminSession(store.get(SERVICE_ADMIN_COOKIE)?.value);
  return authenticated ? <QaConsole /> : <AdminLogin />;
}
