/**
 * Public directory view for verified clients.
 * Supports search and browsing of public organization profiles.
 */

import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, ChevronDown, ChevronUp, Search } from "lucide-react";

import { useAppData } from "../utils/appData";
import DashboardLayout from "../components/DashboardLayout";
import { Input } from "../components/ui/input";
import { toastApiError } from "../utils/notifications";

type Client = {
  id: number | string;
  legal_name?: string;
  company_name?: string;
  country?: string;
  state?: string;
  summary?: string;
  established_year?: number;
  status?: string;
  website?: string;
  industry?: string;
  description?: string;
  upi?: string | null;
  master_upi?: string | null;
};

export default function Clients() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | number | null>(null);
  const { clients, refreshClients } = useAppData();

  useEffect(() => {
    refreshClients().catch((err) => {
      toastApiError(err, "Unable to load clients");
    });
  }, [refreshClients]);

  const normalized = useMemo(() => {
    /** Normalize client data into UI-friendly fields. */
    return clients.map((client) => {
      const name = client.company_name || client.legal_name || "Unnamed client";
      const country = client.country || "";
      const industry = client.industry || "";
      const website = client.website || "";
      const description = client.description || client.summary || "";
      const masterUPI = client.upi || client.master_upi || "";
      return { ...client, name, country, industry, website, description, masterUPI };
    });
  }, [clients]);

  const filtered = useMemo(() => {
    /** Apply a simple name/industry search filter. */
    const query = search.trim().toLowerCase();
    if (!query) return normalized;
    return normalized.filter((o) =>
      o.name.toLowerCase().includes(query) || o.industry.toLowerCase().includes(query)
    );
  }, [normalized, search]);

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-3xl">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground mb-2">Clients Directory</h1>
            <p className="text-muted-foreground">Browse verified organizations on Aplite.</p>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or industry..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="space-y-3">
            {filtered.map((org) => (
              <div key={String(org.id)} className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
                <button
                  type="button"
                  className="w-full px-6 py-4 flex items-center justify-between text-left"
                  onClick={() => setExpandedId(expandedId === org.id ? null : org.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{org.name}</span>
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {org.industry} - {org.country}
                      </p>
                    </div>
                  </div>
                  {expandedId === org.id ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </button>
                {expandedId === org.id && (
                  <div className="px-6 pb-4 border-t border-border pt-4 animate-fade-in">
                    <div className="space-y-2 text-sm">
                      {org.website && (
                        <p>
                          <span className="text-muted-foreground">Website:</span> {org.website}
                        </p>
                      )}
                      {org.description && (
                        <p>
                          <span className="text-muted-foreground">Description:</span> {org.description}
                        </p>
                      )}
                      {org.masterUPI && (
                        <p>
                          <span className="text-muted-foreground">Master UPI:</span> <code className="font-mono">{org.masterUPI}</code>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No organizations found.</p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
