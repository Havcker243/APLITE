import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useAuth } from "../utils/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";

export default function ContactPage() {
  /** Render the contact page content. */
  const { token } = useAuth();
  const backHref = token ? "/dashboard" : "/";
  const backLabel = token ? "Back to dashboard" : "Back to Aplite";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const subject = encodeURIComponent("Aplite support request");
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
    if (!message.trim()) {
      toast.error("Please enter a message.");
      return;
    }
    window.location.href = `mailto:support@aplite.io?subject=${subject}&body=${body}`;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <Head>
        <title>Contact · Aplite</title>
      </Head>

      <main className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="mb-10 rounded-2xl border border-border bg-background/80 p-8 shadow-card backdrop-blur">
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
            {backLabel}
          </Link>
          <h1 className="mt-4 text-3xl font-semibold text-foreground">Contact support</h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Reach out for onboarding help, verification questions, or account support.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <form className="rounded-xl border border-border bg-card p-6 shadow-card space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us how we can help."
                required
              />
            </div>
            <Button type="submit" variant="hero">
              Send message
            </Button>
          </form>

          <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-4 text-sm text-muted-foreground">
            <div>
              <h2 className="text-base font-semibold text-foreground">Support</h2>
              <p className="mt-2">Email us at support@aplite.io.</p>
              <p className="mt-2">We respond within the same business day during business hours.</p>
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Status</h2>
              <p className="mt-2">
                Check current system status on the{" "}
                <Link href="/status" className="text-accent hover:underline">
                  status page
                </Link>
                .
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">FAQ</h2>
              <p className="mt-2">
                Common questions are answered in the{" "}
                <Link href="/faq" className="text-accent hover:underline">
                  FAQ
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
