export type Locale = "en" | "ar";
export type Role = "user" | "admin";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  twitter: string | null;
  instagram: string | null;
  github: string | null;
  role: Role;
  is_pro: boolean;
  created_at: string;
};

export type Post = {
  id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Pick<Profile, "full_name" | "avatar_url" | "email" | "username" | "is_pro"> | null;
  likes_count?: number;
  liked_by_me?: boolean;
  saved_by_me?: boolean;
  collection_id?: string | null;
  is_authentic?: boolean;
  seal_requested?: boolean;
};

export type Like = {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
};

export type Ad = {
  id: string;
  title: string | null;
  image_url: string;
  link: string;
  placement: "feed" | "sidebar" | "both";
  active: boolean;
  created_at: string;
};

export type Announcement = {
  id: string;
  message: string;
  active: boolean;
  created_at: string;
};
