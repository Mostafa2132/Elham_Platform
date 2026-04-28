"use client";

import { ProtectedRoute } from "@/components/layout/protected-route";
import { ProfileView } from "@/components/profile/profile-view";

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileView />
    </ProtectedRoute>
  );
}
