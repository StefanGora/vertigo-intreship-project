import { eq, and, sql } from "drizzle-orm";
import db from "../../db";
import {
  betsTable,
  marketsTable,
  marketOutcomesTable,
  walletsTable,
  transactionsTable
} from "../../db/schema";
import { calculateUserWinnings } from "../../lib/odds";

export async function handleMarketPayout({
  params,
  user,
}: {
  params: { id: number };
  user: { id: number } | null;
}) {
  if (!user) return { error: "Unauthorized" };

  const marketId = Number(params.id);

  // -------------------------
  // MARKET CHECK
  // -------------------------
  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, marketId),
  });

  if (!market) {
    return { error: "Market not found" };
  }

  if (market.status === "active") {
    return { error: "Market still active" };
  }

  if (!market.resolvedOutcomeId) {
    return { error: "Market has no resolved outcome" };
  }

  // -------------------------
  // GET BETS
  // -------------------------
  const bets = await db.query.betsTable.findMany({
    where: eq(betsTable.marketId, marketId),
  });

  if (bets.length === 0) {
    return { error: "No bets found for market" };
  }

  // -------------------------
  // CALCULATE TOTALS
  // -------------------------
  const totalBets = bets.reduce((acc, b) => acc + b.amount, 0);

  const winningBets = bets.filter(
    (b) => b.outcomeId === market.resolvedOutcomeId
  );

  const winningTotal = winningBets.reduce(
    (acc, b) => acc + b.amount,
    0
  );

  if (winningTotal === 0) {
    return {
      error: "No winning bets — cannot distribute payouts",
    };
  }

  // -------------------------
  // PAYOUT PROCESS
  // -------------------------
  const payouts = [];

  for (const bet of winningBets) {
    const payout = calculateUserWinnings(
      bet.amount,
      winningTotal,
      totalBets
    );

    // -------------------------
    // GET WALLET (FIXED)
    // -------------------------
    const wallet = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, bet.userId))
      .limit(1);

    const userWallet = wallet[0];

    if (!userWallet) {
      console.log(`Wallet not found for user ${bet.userId}`);
      continue;
    }

    const oldBalance = userWallet.balance;
    const newBalance = oldBalance + payout;

    // -------------------------
    // UPDATE WALLET
    // -------------------------
    await db
      .update(walletsTable)
      .set({
        balance: sql`${walletsTable.balance} + ${payout}`,
      })
      .where(eq(walletsTable.userId, bet.userId));

    // -------------------------
    // INSERT TRANSACTION
    // -------------------------
    const [transaction] = await db
      .insert(transactionsTable)
      .values({
        walletId: userWallet.id, // ✅ FIX HERE
        type: "payout",
        amount: payout,
        betId: bet.id,
      })
      .returning();

    // -------------------------
    // LOG
    // -------------------------
    console.log("===== Payout occurred =====");
    console.log({
      timestamp: transaction.createdAt,
      type: transaction.type,
      walletId: userWallet.id,
      userId: bet.userId,
      betId: bet.id,
      amount: payout,
      oldBalance,
      newBalance,
    });

    payouts.push({
      userId: bet.userId,
      betId: bet.id,
      amount: payout,
    });
  }

  // -------------------------
  // RESPONSE
  // -------------------------
  return {
    success: true,
    marketId,
    resolvedOutcomeId: market.resolvedOutcomeId,
    totalBets,
    winningTotal,
    payouts,
  };
}


export async function handleResolveMarket({
  params,
  body,
  user,
  set,
}: {
  params: { id: number };
  body: { outcomeId: number };
  user: { id: number } | null;
}) {
  if (!user) return { error: "Unauthorized" };

  const marketId = Number(params.id);
  const outcomeId = Number(body.outcomeId);

  // 1. fetch market
  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, marketId),
  });

  if (!market) {
    set.status = 400;
    return { error: "Market not found" };
  }

  // 2. already resolved check
  if (market.status === "resolved") {
    set.status = 400;
    return { error: "Market already resolved" };
  }

  // 3. optional safety: ensure outcome belongs to market
  const outcome = await db.query.marketOutcomesTable.findFirst({
    where: and(
      eq(marketOutcomesTable.id, outcomeId),
      eq(marketOutcomesTable.marketId, marketId)
    ),
  });

  if (!outcome) {
    set.status = 404;
    return { error: "Invalid outcome for this market" };
  }

  // 4. update market
  await db
    .update(marketsTable)
    .set({
      status: "resolved",
      resolvedOutcomeId: outcomeId,
    })
    .where(eq(marketsTable.id, marketId));

  console.log(`Admin ${user.id} resolved market ${marketId}`);
  
  set.status = 201;
  return {
    success: true,
    marketId,
    resolvedOutcomeId: outcomeId,
  };
}


