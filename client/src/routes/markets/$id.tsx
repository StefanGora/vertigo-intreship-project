import { useEffect, useState } from "react";
import { useParams, useNavigate, createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { api, Market } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const COLORS = [
  "#4f46e5",
  "#06b6d4",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
];

function MarketDetailPage() {
  const { id } = useParams({ from: "/markets/$id" });
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [market, setMarket] = useState<Market | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedOutcomeId, setSelectedOutcomeId] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [isBetting, setIsBetting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const marketId = parseInt(id, 10);

  useEffect(() => {
    const loadMarket = async () => {
      try {
        setIsLoading(true);
        const data = await api.getMarket(marketId);
        setMarket(data);

        if (data.outcomes.length > 0) {
          setSelectedOutcomeId(data.outcomes[0].id);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load market details"
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadMarket();
  }, [marketId]);

  // ----------------------------
  // Validation
  // ----------------------------
  const handlePlaceBet = () => {
    const amount = parseFloat(betAmount);

    if (!selectedOutcomeId || isNaN(amount) || amount <= 0) {
      setError("Bet amount must be a positive number");
      return;
    }

    setShowConfirm(true);
  };

  // ----------------------------
  // Confirm bet
  // ----------------------------
  const confirmBet = async () => {
    try {
      setIsBetting(true);
      setError(null);

      await api.placeBet(
        marketId,
        selectedOutcomeId!,
        parseFloat(betAmount)
      );

      setBetAmount("");
      setShowConfirm(false);

      const updated = await api.getMarket(marketId);
      setMarket(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to place bet"
      );
    } finally {
      setIsBetting(false);
    }
  };

  // ----------------------------
  // Chart data
  // ----------------------------
  const total = market?.totalMarketBets ?? 0;

  const chartData =
    market?.outcomes.map((o) => ({
      name: o.title,
      value: o.totalBets,
      percentage:
        total > 0
          ? ((o.totalBets / total) * 100).toFixed(1)
          : "0",
    })) || [];

  // ----------------------------
  // UI STATES
  // ----------------------------

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-muted-foreground">
              Please log in to view this market
            </p>
            <Button onClick={() => navigate({ to: "/auth/login" })}>
              Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading market...</p>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-destructive">Market not found</p>
            <Button onClick={() => navigate({ to: "/" })}>
              Back to Markets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-3xl mx-auto px-4 space-y-6">

        <Button variant="outline" onClick={() => navigate({ to: "/" })}>
          ← Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-4xl">{market.title}</CardTitle>
                {market.description && (
                  <CardDescription className="text-lg mt-2">
                    {market.description}
                  </CardDescription>
                )}
              </div>

              <Badge
                variant={
                  market.status === "active" ? "default" : "secondary"
                }
              >
                {market.status === "active" ? "Active" : "Resolved"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* CHART */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">
                Market Distribution
              </h3>

              <div className="w-full h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={100}
                      label={({ name, percentage }) =>
                        `${name} (${percentage}%)`
                      }
                    >
                      {chartData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) =>
                        `$${value.toFixed(2)}`
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* OUTCOMES */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Outcomes</h3>

              {market.outcomes.map((outcome) => (
                <div
                  key={outcome.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedOutcomeId === outcome.id
                      ? "border-primary bg-primary/5"
                      : "border-secondary bg-secondary/5 hover:border-primary/50"
                  }`}
                  onClick={() =>
                    market.status === "active" &&
                    setSelectedOutcomeId(outcome.id)
                  }
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <h4 className="font-semibold">
                        {outcome.title}
                      </h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Total bets: ${outcome.totalBets.toFixed(2)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-3xl font-bold text-primary">
                        {outcome.odds}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        odds
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* TOTAL */}
            <div className="rounded-lg p-6 border border-primary/20 bg-primary/5">
              <p className="text-sm text-muted-foreground mb-1">
                Total Market Value
              </p>
              <p className="text-4xl font-bold text-primary">
                ${market.totalMarketBets.toFixed(2)}
              </p>
            </div>

            {/* BETTING */}
            {market.status === "active" && (
              <Card className="bg-secondary/5">
                <CardHeader>
                  <CardTitle>Place Your Bet</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Selected Outcome</Label>
                    <div className="p-3 bg-white border rounded-md">
                      {
                        market.outcomes.find(
                          (o) => o.id === selectedOutcomeId
                        )?.title
                      }
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Bet Amount ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={betAmount}
                      onChange={(e) =>
                        setBetAmount(e.target.value)
                      }
                      placeholder="Enter amount"
                      disabled={isBetting}
                    />
                  </div>

                  <Button
                    className="w-full text-lg py-6"
                    onClick={handlePlaceBet}
                    disabled={
                      isBetting ||
                      !selectedOutcomeId ||
                      !betAmount
                    }
                  >
                    Place Bet
                  </Button>
                </CardContent>
              </Card>
            )}

            {market.status === "resolved" && (
              <Card>
                <CardContent className="py-6">
                  <p className="text-muted-foreground">
                    This market has been resolved.
                  </p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* CONFIRM MODAL */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-[400px]">
              <CardHeader>
                <CardTitle>Confirm Bet</CardTitle>
                <CardDescription>
                  Are you sure you want to place this bet?
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <p>
                  <strong>Outcome:</strong>{" "}
                  {
                    market.outcomes.find(
                      (o) => o.id === selectedOutcomeId
                    )?.title
                  }
                </p>

                <p>
                  <strong>Amount:</strong> ${betAmount}
                </p>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowConfirm(false)}
                  >
                    Cancel
                  </Button>

                  <Button
                    onClick={confirmBet}
                    disabled={isBetting}
                  >
                    Confirm
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/markets/$id")({
  component: MarketDetailPage,
});