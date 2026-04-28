"use client";

export function PostSkeleton() {
  return (
    <div className="glass rounded-2xl overflow-hidden p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <div className="skeleton h-3 w-32 rounded" />
          <div className="skeleton h-3 w-20 rounded" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-5/6 rounded" />
        <div className="skeleton h-3 w-4/6 rounded" />
      </div>
      <div className="skeleton h-48 w-full rounded-xl" />
      <div className="flex gap-2">
        <div className="skeleton h-8 w-16 rounded-lg" />
        <div className="skeleton h-8 w-10 rounded-lg" />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-0">
      <div className="skeleton h-44 w-full rounded-t-2xl" />
      <div className="glass rounded-b-2xl px-6 pb-6 pt-0">
        <div className="flex items-end gap-4 -mt-10 mb-4">
          <div className="skeleton h-20 w-20 rounded-full border-4 border-[var(--bg-soft)]" />
          <div className="pb-2 space-y-2 flex-1">
            <div className="skeleton h-4 w-36 rounded" />
            <div className="skeleton h-3 w-24 rounded" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-3/4 rounded" />
        </div>
      </div>
    </div>
  );
}

export function AdSkeleton() {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="skeleton h-36 w-full" />
      <div className="p-3 space-y-2">
        <div className="skeleton h-3 w-3/4 rounded" />
        <div className="skeleton h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
}
