import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "@tanstack/react-router";
import { ResolvedBet } from "@/lib/api";

interface ResolvedBetCardProps {
  bet: ResolvedBet;
}

export function ResolvedBetCard({ bet }: ResolvedBetCardProps) {
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

          <Badge variant="secondary">Resolved</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="p-3 rounded-md border">
          <p className="text-xs text-muted-foreground">Result</p>

          <p
            className={`text-xl font-bold ${
              bet.result === "won"
                ? "text-green-600"
                : "text-red-500"
            }`}
          >
            {bet.result.toUpperCase()}
          </p>
        </div>

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