import { Market } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "@tanstack/react-router";

interface MarketCardProps {
  market: Market;
}

export function MarketCard({ market }: MarketCardProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl">{market.title}</CardTitle>
            <CardDescription className="flex flex-col gap-1">
              <span>By: {market.creator || "Unknown"}</span>
              <span>Date: {market.creationDate || "Unknown"}</span>
              <span>Participants: {market.participants || "Unknown"}</span>
            </CardDescription>
            
          </div>
          <Badge variant={market.status === "active" ? "default" : "secondary"}>
            {market.status === "active" ? "Active" : "Resolved"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Outcomes */}
        <div className="space-y-2">
          {market.outcomes.map((outcome) => (
            <div
              key={outcome.id}
              className="flex items-center justify-between bg-secondary/20 p-3 rounded-md"
            >
              <div>
                <p className="text-sm font-medium">{outcome.title}</p>
                <p className="text-xs text-muted-foreground">
                  ${outcome.totalBets.toFixed(2)} total
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{outcome.odds}%</p>
              </div>
            </div>
          ))}
        </div>

        {/* Total Market Value */}
        <div className="p-3 rounded-md border border-primary/20 bg-primary/5">
          <p className="text-xs text-muted-foreground">Total Market Value</p>
          <p className="text-2xl font-bold text-primary">${market.totalMarketBets.toFixed(2)}</p>
        </div>

        {/* Action Button */}
        <Button className="w-full" onClick={() => navigate({ to: `/markets/${market.id}` })}>
          {market.status === "active" ? "Place Bet" : "View Results"}
        </Button>
      </CardContent>
    </Card>
  );
}
