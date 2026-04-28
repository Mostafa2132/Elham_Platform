import { ProtectedRoute } from "@/components/layout/protected-route";
import { CreatePostForm } from "@/components/sections/create-post-form";

export default async function CreatePostPage({ params }: { params: Promise<{ locale: "en" | "ar" }> }) {
  const { locale } = await params;
  return (
    <ProtectedRoute>
      <CreatePostForm locale={locale} />
    </ProtectedRoute>
  );
}
