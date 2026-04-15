import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { api, Market } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { MarketCard } from "@/components/market-card";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

function DashboardPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<"active" | "resolved">("active");
  const [sortBy, setSortBy] = useState<
    "date" | "bets" | "participants"
  >("date");

  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  // ✅ updated loader with silent mode
  const loadMarkets = async (
    nextCursor: string | null,
    silent = false
  ) => {
    try {
      if (!silent) setIsLoading(true);

      const response = await api.listMarkets(
        status,
        sortBy,
        nextCursor
      );

      setMarkets(response.data);
      setCursor(response.cursor);
    } catch (err) {
      if (!silent) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load markets"
        );
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // ✅ initial load + filters
  useEffect(() => {
    setMarkets([]);
    setCursorStack([]);
    setCursor(null);
    loadMarkets(null);
  }, [status, sortBy]);

  // ✅ POLLING (silent refresh, keeps current page)
  useEffect(() => {
    const interval = setInterval(() => {
      const currentCursor =
        cursorStack[cursorStack.length - 1] ?? null;

      loadMarkets(currentCursor, true); // silent refresh
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
  }, [status, sortBy, cursorStack]);

  // ----------------------------
  // Navigation (FIXED)
  // ----------------------------

  const goNext = async () => {
    if (!cursor) return;

    setCursorStack((prev) => [...prev, cursor]);
    await loadMarkets(cursor);
  };

  const goPrev = async () => {
    setCursorStack((prev) => {
      const newStack = [...prev];
      newStack.pop();

      const previousCursor =
        newStack.length > 0
          ? newStack[newStack.length - 1]
          : null;

      loadMarkets(previousCursor);

      return newStack;
    });
  };

  // ----------------------------
  // UI
  // ----------------------------

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
            <Button
              onClick={() => navigate({ to: "/auth/login" })}
            >
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
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Markets
            </h1>
            <p className="text-gray-600 mt-2">
              Welcome back, {user?.username}!
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/auth/logout" })}
            >
              Logout
            </Button>
            <Button
              onClick={() => navigate({ to: "/markets/new" })}
            >
              Create Market
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <Button
            variant={status === "active" ? "default" : "outline"}
            onClick={() => setStatus("active")}
          >
            Active Markets
          </Button>
          <Button
            variant={status === "resolved" ? "default" : "outline"}
            onClick={() => setStatus("resolved")}
          >
            Resolved Markets
          </Button>

          <Select
            value={sortBy}
            onValueChange={(value) =>
              setSortBy(
                value as "date" | "bets" | "participants"
              )
            }
          >
            <SelectTrigger className="bg-white text-black border rounded px-2 py-1">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="bets">Bet Size</SelectItem>
              <SelectItem value="participants">
                Participants
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-6">
            {error}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">
                Loading markets...
              </p>
            </CardContent>
          </Card>
        ) : markets.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">
                No markets found.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        )}

        {/* Navigation */}
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

export const Route = createFileRoute("/")({
  component: DashboardPage,
});