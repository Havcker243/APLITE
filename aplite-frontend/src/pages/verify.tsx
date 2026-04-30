import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  ArrowLeft,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { verifyApliteId, VerifyApliteIdResult } from "../utils/api";

function formatDate(iso: string | null) {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function VerifyPage() {
  const router = useRouter();
  const [inputId, setInputId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyApliteIdResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState<string | null>(null);

  // Run lookup from URL query param on load
  useEffect(() => {
    const id = typeof router.query.id === "string" ? router.query.id : null;
    if (id) {
      setInputId(id);
      void runLookup(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.id]);

  async function runLookup(id: string) {
    const trimmed = id.trim();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setSearched(trimmed);
    try {
      const data = await verifyApliteId(trimmed);
      setResult(data);
    } catch {
      setError("Could not complete the verification lookup. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void router.push(`/verify?id=${encodeURIComponent(inputId.trim())}`, undefined, { shallow: true });
    void runLookup(inputId);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            <span className="text-xl font-semibold text-foreground">Aplite</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button variant="hero" asChild>
              <Link href="/signup">Get verified</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="pt-24 pb-16 px-6">
        <div className="container mx-auto max-w-lg">
          {/* Back */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          {/* Search */}
          <div className="mb-10">
            <h1 className="text-2xl font-semibold text-foreground mb-6">
              Verify an Aplite ID
            </h1>
            <form onSubmit={handleSubmit} className="flex gap-3">
              <Input
                value={inputId}
                onChange={(e) => setInputId(e.target.value)}
                placeholder="bulldogbites@aplite"
                className="flex-1 font-mono"
                aria-label="Aplite ID"
              />
              <Button type="submit" variant="hero" disabled={loading || !inputId.trim()}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Checking verification status…</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
              <p className="font-medium text-foreground mb-1">Lookup failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            result.verified ? (
              <VerifiedCard result={result} searched={searched} />
            ) : (
              <NotVerifiedCard searched={searched} />
            )
          )}

          {/* Info */}
          {!result && !loading && !error && (
            <div className="text-center py-16">
              <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">
                Enter an Aplite ID above to check if a business is verified.
              </p>
              <div className="flex gap-3 justify-center mt-4 text-sm">
                <button
                  type="button"
                  className="font-mono text-primary underline underline-offset-2 hover:text-primary/80"
                  onClick={() => { setInputId("bulldogbites@aplite"); void runLookup("bulldogbites@aplite"); }}
                >
                  Try bulldogbites@aplite
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  className="font-mono text-primary underline underline-offset-2 hover:text-primary/80"
                  onClick={() => { setInputId("fastfreight@aplite"); void runLookup("fastfreight@aplite"); }}
                >
                  Try fastfreight@aplite
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VerifiedCard({ result, searched }: { result: VerifyApliteIdResult; searched: string | null }) {
  return (
    <div className="bg-card border border-success/30 rounded-xl p-8 shadow-card animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-7 w-7 text-success" />
        </div>
        <div>
          <p className="text-xl font-semibold text-foreground">{result.name}</p>
          <p className="text-sm text-success font-medium">Verified by Aplite</p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <Row label="Aplite ID" value={`${result.handle}@aplite`} mono />
        <Row label="Status" value="Verified Business" className="text-success font-medium" />
        {result.last_verified && (
          <Row label="Last verified" value={formatDate(result.last_verified)} />
        )}
        {result.website && (
          <Row label="Website" value={result.website} />
        )}
        {result.industry && (
          <Row label="Industry" value={result.industry} />
        )}
        {result.country && (
          <Row label="Country" value={result.country} />
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button variant="hero" className="flex-1" asChild>
          <Link href="/">Verify another</Link>
        </Button>
        <Button variant="outline" className="flex-1" asChild>
          <Link href="/signup">Get your business verified</Link>
        </Button>
      </div>
    </div>
  );
}

function NotVerifiedCard({ searched }: { searched: string | null }) {
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [email, setEmail] = useState("");

  function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setEmailSubmitted(true);
  }

  return (
    <div className="bg-card border border-destructive/30 rounded-xl p-8 shadow-card animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>
        <div>
          <p className="text-xl font-semibold text-foreground">Not Verified</p>
          <p className="text-sm text-destructive font-medium">Proceed with caution</p>
        </div>
      </div>

      {searched && (
        <div className="bg-muted/50 rounded-lg px-4 py-3 mb-4 font-mono text-sm text-muted-foreground">
          {searched.includes("@") ? searched : `${searched}@aplite`}
        </div>
      )}

      <p className="text-muted-foreground text-sm mb-6">
        We could not verify this business. This ID is not registered with Aplite.
        Do not send money based solely on this ID.
      </p>

      {!emailSubmitted ? (
        <div className="border-t border-border pt-6">
          <p className="text-sm font-medium text-foreground mb-3">
            Do you know this business? Request they get verified:
          </p>
          <form onSubmit={handleRequest} className="flex gap-3">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="flex-1"
              required
            />
            <Button type="submit" variant="outline">Send</Button>
          </form>
        </div>
      ) : (
        <div className="border-t border-border pt-6">
          <div className="flex items-center gap-2 text-success text-sm">
            <CheckCircle2 className="h-4 w-4" />
            <span>Request sent. We'll follow up within 24 hours.</span>
          </div>
        </div>
      )}

      <div className="mt-6">
        <Button variant="ghost" asChild className="w-full">
          <Link href="/">Verify a different ID</Link>
        </Button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className="flex justify-between items-center text-sm border-b border-border/50 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium text-foreground ${mono ? "font-mono" : ""} ${className ?? ""}`}>
        {value}
      </span>
    </div>
  );
}
