import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedGuardianSession, GuardianAuthError } from "../../../lib/guardian/auth-helper";
import { getGuardianProfile } from "../../../lib/guardian/portal-service";
import { GuardianNav } from "../../../components/guardian-nav";

export const metadata = {
  title: "Portal Wali Murid - NataSekolah",
  description: "Pusat pemantauan kegiatan belajar, kehadiran, keuangan, dan hafalan santri.",
};

export default async function GuardianPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let auth;
  try {
    auth = await getAuthenticatedGuardianSession();
  } catch (err: unknown) {
    if (err instanceof GuardianAuthError) {
      redirect("/wali/aktivasi");
    }
    redirect("/login");
  }

  const profile = await getGuardianProfile(auth.guardian.id, auth.institution.id);

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-[#18181b] flex flex-col antialiased">
      <Suspense fallback={<div className="h-16 border-b border-stone-200 bg-white" />}>
        <GuardianNav
          guardianName={profile.guardian.fullName}
          institutionName={profile.institution.name}
          childrenList={profile.children}
          activeStudentId={profile.children[0]?.student.id || ""}
        />
      </Suspense>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-5 pb-24 lg:pb-12">
        {children}
      </main>
    </div>
  );
}
