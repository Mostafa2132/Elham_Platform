"use client";

import { ProfileView } from "@/components/profile/profile-view";
import { useParams } from "next/navigation";

export default function PublicProfilePage() {
  const params = useParams();
  const id = params?.id as string;

  return (
    <div className="max-w-4xl mx-auto py-6">
      <ProfileView profileId={id} />
    </div>
  );
}
