import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth.middleware";
import { handleLisActiveBets, handleLisResolvedBets, handleGetUserBalance } from "./handlers/user.handlers";

export const userRoutes = new Elysia({ prefix: "/api/user" })
.use(authMiddleware)
.guard(
    {
      beforeHandle({ user, set }) {
        if (!user) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
      },
    },
    (app) =>
      app
        .get("/bets/active", handleLisActiveBets, {
          query: t.Object({
            cursor: t.Optional(t.String()),
          }),
        })
        .get("/bets/resolved", handleLisResolvedBets, {
          query: t.Object({
            cursor: t.Optional(t.String()),
          }),
        })
        .get("/balance", handleGetUserBalance)
  );