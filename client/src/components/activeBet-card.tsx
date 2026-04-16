import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "@tanstack/react-router";
import { ActiveBet } from "@/lib/api";

interface ActiveBetCardProps {
  bet: ActiveBet;
}

export function ActiveBetCard({ bet }: ActiveBetCardProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl">
              {bet.market.title}
            </CardTitle>

            <CardDescription className="flex flex-col gap-1">
              <span>Outcome: {bet.outcome.title}</span>
              <span>Amount: ${bet.amount}</span>
              <span>
                Date: {new Date(bet.createdAt).toLocaleDateString()}
              </span>
            </CardDescription>
          </div>

          <Badge>Active</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {"odds" in bet.outcome && (
          <div className="p-3 rounded-md border border-primary/20 bg-primary/5">
            <p className="text-xs text-muted-foreground">Current Odds</p>
            <p className="text-xl font-bold text-primary">
              {bet.outcome.odds}%
            </p>
          </div>
        )}

        <Button
          className="w-full"
          onClick={() =>
            navigate({ to: `/markets/${bet.market.id}` })
          }
        >
          View Market
        </Button>
      </CardContent>
    </Card>
  );
}