/**
 * Status badge for onboarding/verification states.
 * Maps backend status values to UI color and label treatments.
 */

import React from "react";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "../utils/cn";

type VerificationBadgeProps = {
  status: string;
  showDescription?: boolean;
};

const STATUS_CONFIG: Record<
  string,
  { label: string; description: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  UNVERIFIED: {
    label: "Unverified",
    description: "Complete onboarding to start verification",
    icon: AlertCircle,
    className: "bg-muted text-muted-foreground",
  },
  NOT_STARTED: {
    label: "Unverified",
    description: "Complete onboarding to start verification",
    icon: AlertCircle,
    className: "bg-muted text-muted-foreground",
  },
  PENDING_CALL: {
    label: "Pending Verification",
    description: "Awaiting verification call",
    icon: Clock,
    className: "bg-pending/10 text-pending-foreground",
  },
  PENDING_REVIEW: {
    label: "Pending Review",
    description: "Awaiting manual verification review",
    icon: Clock,
    className: "bg-pending/10 text-pending-foreground",
  },
  PENDING: {
    label: "Pending Verification",
    description: "Awaiting verification call",
    icon: Clock,
    className: "bg-pending/10 text-pending-foreground",
  },
  REJECTED: {
    label: "Rejected",
    description: "Fix the issues and resubmit onboarding",
    icon: AlertCircle,
    className: "bg-destructive/10 text-destructive",
  },
  VERIFIED: {
    label: "Verified",
    description: "Full access to all features",
    icon: CheckCircle2,
    className: "bg-verified/10 text-verified",
  },
};

export default function VerificationBadge({ status, showDescription = true }: VerificationBadgeProps) {
  const normalized = (status || "UNVERIFIED").toUpperCase();
  const config = STATUS_CONFIG[normalized] || STATUS_CONFIG.UNVERIFIED;
  const Icon = config.icon;

  return (
    <div className={cn("rounded-lg p-3", config.className)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{config.label}</span>
      </div>
      {showDescription && <p className="text-xs mt-1 opacity-80">{config.description}</p>}
    </div>
  );
}
