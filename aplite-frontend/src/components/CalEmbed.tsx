/**
 * Cal.com embed wrapper used in onboarding verification flows.
 * Keeps the scheduling widget isolated behind a simple component API.
 */

import { useState } from "react";
import { Calendar } from "lucide-react";

import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";

type CalEmbedProps = {
  calLink?: string;
  username?: string;
  eventSlug?: string;
  onSchedule?: () => void;
  scheduled?: boolean;
  variant?: "modal" | "inline" | "card";
};

type CalConfig = { username: string; eventSlug: string } | null;

function parseCalLink(raw: string): CalConfig {
  /** Parse a Cal.com URL into username + event slug. */
  const value = (raw || "").trim();
  if (!value) return null;
  const cleaned = value
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^cal\.com\//i, "")
    .split("?", 1)[0]
    .split("#", 1)[0];
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return { username: parts[0], eventSlug: parts[1] };
}

export function CalEmbed({
  calLink,
  username,
  eventSlug,
  onSchedule,
  scheduled = false,
  variant = "modal",
}: CalEmbedProps) {
  const parsed = calLink ? parseCalLink(calLink) : null;
  const resolved = parsed || (username && eventSlug ? { username, eventSlug } : null);
  const [open, setOpen] = useState(false);

  if (!resolved) {
    return (
      <div className="text-sm text-muted-foreground">
        Cal.com booking is not configured. Set NEXT_PUBLIC_CAL_LINK or NEXT_PUBLIC_CAL_USERNAME and NEXT_PUBLIC_CAL_EVENT_SLUG.
      </div>
    );
  }

  const src = `https://cal.com/${resolved.username}/${resolved.eventSlug}?embed=true`;

  if (variant === "card") {
    if (scheduled) {
      return (
        <div className="bg-success/5 border border-success/20 rounded-xl p-6 text-center">
          <Calendar className="h-12 w-12 mx-auto text-success mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Call Scheduled</h3>
          <p className="text-muted-foreground mb-4">We&apos;ll send you a calendar invite with the meeting details.</p>
          {onSchedule && (
            <Button variant="outline" onClick={onSchedule}>
              Reschedule
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <Calendar className="h-12 w-12 mx-auto text-accent mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Schedule Verification Call</h3>
        <p className="text-muted-foreground mb-6">Complete your verification with a brief call with our team.</p>
        {onSchedule && (
          <Button variant="hero" onClick={onSchedule}>
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Call
          </Button>
        )}
        <p className="text-xs text-muted-foreground mt-4">Typically takes 5-10 minutes.</p>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border overflow-hidden">
          <iframe title="Schedule verification call" src={src} className="w-full h-[640px]" />
        </div>
        {onSchedule && (
          <div className="flex items-center gap-3">
            <Checkbox id="scheduled" onCheckedChange={(checked) => checked && onSchedule()} />
            <Label htmlFor="scheduled">I scheduled my verification call</Label>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <Button type="button" variant="hero" onClick={() => setOpen(true)}>
        Book verification call
      </Button>
      <p className="text-muted-foreground mt-3">
        Once you book, we will verify the details on the call and activate your account.
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Book your call</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-border overflow-hidden">
            <iframe title="Schedule verification call" src={src} className="w-full h-[640px]" />
          </div>
          {onSchedule && (
            <div className="flex items-center gap-3">
              <Checkbox id="scheduled-modal" onCheckedChange={(checked) => checked && onSchedule()} />
              <Label htmlFor="scheduled-modal">I scheduled my verification call</Label>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
