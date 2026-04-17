import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ActiveBetCard } from "@/components/activeBet-card";
import { ResolvedBetCard } from "@/components/resolvedBet-card";
import { useAuth } from "@/lib/auth-context";
import { api, ActiveBet, ResolvedBet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function ProfilePage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [activeBets, setActiveBets] = useState<ActiveBet[]>([]);
  const [resolvedBets, setResolvedBets] = useState<ResolvedBet[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<"active" | "resolved">("active");

  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const [balance, setBalance] = useState<number | null>(null);

  /**
   * Redirect if not authenticated
   */
  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: "/auth/login" });
    }
  }, [isAuthenticated, navigate]);

  /**
   * Fetch bets
   */
  const loadUserBets = async (
    nextCursor: string | null,
    overrideStatus?: "active" | "resolved",
    silent = false
  ) => {
    try {
      if (!silent) setIsLoading(true);

      const currentStatus = overrideStatus ?? status;

      let response;

      if (currentStatus === "active") {
        response = await api.listUserBets("active", nextCursor);
        setActiveBets(response.data);
      } else {
        response = await api.listUserBets("resolved", nextCursor);
        setResolvedBets(response.data);
      }

      setCursor(response.cursor);
      setError(null);
    } catch (err) {
      if (!silent) {
        setError(
          err instanceof Error ? err.message : "Failed to load bets"
        );
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadBalance = async () => {
      try {
        const res = await api.getUserBalance();
        setBalance(res.balance);
      } catch (err) {
        console.error("Failed to load balance");
      }
    };

    if (isAuthenticated) {
      loadBalance();
    }
  }, [isAuthenticated]);

  /**
   * Reload on status change
   */
  useEffect(() => {
    setCursorStack([]);
    setCursor(null);

    loadUserBets(null, status);
  }, [status]);

    /**
   * Polling
   */
    useEffect(() => {
    const interval = setInterval(() => {
      const currentCursor =
        cursorStack[cursorStack.length - 1] ?? null;

      loadUserBets(currentCursor, status, true); // silent refresh
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
  }, [status, cursorStack]);

  /**
   * Pagination
   */
  const goNext = async () => {
    if (!cursor) return;

    setCursorStack((prev) => [...prev, cursor]);
    await loadUserBets(cursor);
  };

  const goPrev = async () => {
    setCursorStack((prev) => {
      const newStack = [...prev];
      newStack.pop();

      const previousCursor =
        newStack.length > 0
          ? newStack[newStack.length - 1]
          : null;

      loadUserBets(previousCursor);

      return newStack;
    });
  };

  /**
   * Choose correct dataset
   */
  const bets = status === "active" ? activeBets : resolvedBets;

  /**
   * UI: loading
   */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading bets...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /**
   * UI: not authenticated fallback (optional safety)
   */
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 text-gray-900">
            Prediction Markets
          </h1>
          <p className="text-gray-600 mb-8 text-lg">
            Create and participate in prediction markets
          </p>
          <div className="space-x-4">
            <Button onClick={() => navigate({ to: "/auth/login" })}>
              Login
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/auth/register" })}
            >
              Sign Up
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8">

    {/* Header */}
    <div className="flex items-center justify-between mb-8">
      
      {/* LEFT */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600 mt-2">
          Welcome, {user?.username}!
        </p>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-4">
        
        {/* Balance */}
        <div className="px-4 py-2 bg-white rounded shadow text-sm font-medium">
          Balance: ${balance?.toFixed(2) ?? "0.00"}
        </div>

        <Button
          variant="outline"
          onClick={() => navigate({ to: "/auth/logout" })}
        >
          Logout
        </Button>

        <Button onClick={() => navigate({ to: "/markets/new" })}>
          Create Market
        </Button>

        <Button
          variant="outline"
          onClick={() => navigate({ to: "/" })}
        >
          Dashboard
        </Button>
      </div>
    </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <Button
            variant={status === "active" ? "default" : "outline"}
            onClick={() => setStatus("active")}
          >
            Active Bets
          </Button>

          <Button
            variant={status === "resolved" ? "default" : "outline"}
            onClick={() => setStatus("resolved")}
          >
            Resolved Bets
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-6">
            {error}
          </div>
        )}

        {/* Content */}
        {bets.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">No bets found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {status === "active"
              ? activeBets.map((bet) => (
                  <ActiveBetCard key={bet.betId} bet={bet} />
                ))
              : resolvedBets.map((bet) => (
                  <ResolvedBetCard key={bet.betId} bet={bet} />
                ))}
          </div>
        )}

        {/* Pagination */}
        <div className="mt-6 flex justify-center gap-4">
          <Button
            disabled={cursorStack.length === 0 || isLoading}
            onClick={goPrev}
          >
            Previous
          </Button>

          <Button
            disabled={!cursor || isLoading}
            onClick={goNext}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/user/profile")({
  component: ProfilePage,
});