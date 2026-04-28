"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";

export function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    setLoading(false);
    if (!response.ok) return toast.error("Failed to send message");
    toast.success("Message sent successfully");
    setForm({ name: "", email: "", message: "" });
  };

  return (
    <form onSubmit={onSubmit} className="glass space-y-4 rounded-2xl p-6">
      <input className="w-full rounded-xl bg-black/20 p-3" placeholder="Name" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
      <input className="w-full rounded-xl bg-black/20 p-3" placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} />
      <textarea className="w-full rounded-xl bg-black/20 p-3" rows={5} placeholder="Message" value={form.message} onChange={(e) => setForm((v) => ({ ...v, message: e.target.value }))} />
      <Button type="submit" disabled={loading}>{loading ? "Sending..." : "Send Message"}</Button>
    </form>
  );
}
