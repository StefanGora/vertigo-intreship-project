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

  const user = JSON.parse(localStorage.getItem("auth_user") || "null");
  console.log(user)
  const isAdmin = user?.role === "admin";

  const [market, setMarket] = useState<Market | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const [selectedOutcomeId, setSelectedOutcomeId] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [isBetting, setIsBetting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const marketId = parseInt(id, 10);

  // ----------------------------
  // LOAD MARKET
  // ----------------------------
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
        setError(err instanceof Error ? err.message : "Failed to load market details");
      } finally {
        setIsLoading(false);
      }
    };

    loadMarket();
  }, [marketId]);

  // ----------------------------
  // BET VALIDATION
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
  // CONFIRM BET
  // ----------------------------
  const confirmBet = async () => {
    try {
      setIsBetting(true);
      setError(null);
      setBalanceError(null);

      await api.placeBet(marketId, selectedOutcomeId!, parseFloat(betAmount));

      setBetAmount("");
      setShowConfirm(false);

      const updated = await api.getMarket(marketId);
      setMarket(updated);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : "Failed to place bet";

      const isBalanceError =
        message.toLowerCase().includes("insufficient") ||
        message.toLowerCase().includes("balance");

      if (isBalanceError) {
        setShowConfirm(false);
        setBalanceError("Insufficient balance");
        return;
      }

      setError(message);
    } finally {
      setIsBetting(false);
    }
  };

  // ----------------------------
  // ADMIN ACTIONS (UPDATED)
  // ----------------------------
  const handleResolveMarket = async () => {
    if (!selectedOutcomeId) return;

    try {
      await api.admin.resolveMarket(marketId, selectedOutcomeId);

      const updated = await api.getMarket(marketId);
      setMarket(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve market");
    }
  };

  const handlePayoutMarket = async () => {
    try {
      await api.admin.payoutMarket(marketId);

      const updated = await api.getMarket(marketId);
      setMarket(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to payout market");
    }
  };

  // ----------------------------
  // CHART DATA
  // ----------------------------
  const total = market?.totalMarketBets ?? 0;

  const chartData =
    market?.outcomes.map((o) => ({
      name: o.title,
      value: o.totalBets,
      percentage: total > 0 ? ((o.totalBets / total) * 100).toFixed(1) : "0",
    })) || [];

  // ----------------------------
  // GUARDS
  // ----------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="flex flex-col items-center py-12 gap-4">
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
          <CardContent className="flex flex-col items-center py-12 gap-4">
            <p className="text-destructive">Market not found</p>
            <Button onClick={() => navigate({ to: "/" })}>
              Back to Markets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----------------------------
  // UI
  // ----------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-3xl mx-auto px-4 space-y-6">

        <Button variant="outline" onClick={() => navigate({ to: "/" })}>
          ← Back
        </Button>

        {/* ADMIN ACTIONS */}
        {isAdmin && market.status === "active" && (
          <div className="flex gap-2">
            <Button variant="destructive" onClick={handleResolveMarket}>
              Resolve Market
            </Button>

            <Button onClick={handlePayoutMarket}>
              Payout
            </Button>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex justify-between">
              <div>
                <CardTitle className="text-4xl">{market.title}</CardTitle>
                {market.description && (
                  <CardDescription className="text-lg mt-2">
                    {market.description}
                  </CardDescription>
                )}
              </div>

              <Badge>
                {market.status === "active" ? "Active" : "Resolved"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">

            {error && (
              <div className="bg-red-100 text-red-600 p-3 rounded">
                {error}
              </div>
            )}

            {/* CHART */}
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={100}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* OUTCOMES */}
            {market.outcomes.map((o) => (
              <div
                key={o.id}
                className={`p-4 border rounded cursor-pointer ${
                  selectedOutcomeId === o.id
                    ? "border-blue-500"
                    : "border-gray-200"
                }`}
                onClick={() =>
                  market.status === "active" && setSelectedOutcomeId(o.id)
                }
              >
                <h4>{o.title}</h4>
                <p>${o.totalBets.toFixed(2)}</p>
                <p>{o.odds}%</p>
              </div>
            ))}

            {/* BETTING */}
            {market.status === "active" && (
              <Card>
                <CardHeader>
                  <CardTitle>Place Your Bet</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <Input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                  />

                  <Button onClick={handlePlaceBet}>
                    Place Bet
                  </Button>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* CONFIRM MODAL */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <Card className="w-[400px]">
              <CardHeader>
                <CardTitle>Confirm Bet</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <p>
                  Outcome:{" "}
                  {market.outcomes.find(
                    (o) => o.id === selectedOutcomeId
                  )?.title}
                </p>

                <p>Amount: ${betAmount}</p>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowConfirm(false)}
                  >
                    Cancel
                  </Button>

                  <Button onClick={confirmBet} disabled={isBetting}>
                    Confirm
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* BALANCE MODAL */}
        {balanceError && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <Card className="w-[400px] border-red-500">
              <CardHeader>
                <CardTitle className="text-red-500">
                  Insufficient Balance
                </CardTitle>
              </CardHeader>

              <CardContent className="flex justify-end">
                <Button onClick={() => setBalanceError(null)}>
                  OK
                </Button>
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