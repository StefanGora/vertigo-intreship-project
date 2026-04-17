import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth.middleware";
import { adminMiddleware } from "../middleware/admin.middleware"; 
import { handleResolveMarket, handleMarketPayout } from "./handlers/admin.handlers";


export const adminRoutes = new Elysia({ prefix: "/api/admin" })
.use(authMiddleware)
.use(adminMiddleware)
.guard(
    {
      beforeHandle({ user, set }) {
        if (!user) {
            set.status = 401;
            return { error: "Unauthorized" };
        }

        if (user.role !== "admin") {
            set.status = 403;
            return { error: "Forbidden" };
        }
      },
    },
    (app) =>
      app
        .patch("/markets/:id/resolve", handleResolveMarket, {
            params: t.Object({
                        id: t.Numeric(),
                      }),
            body: t.Object({
                outcomeId : t.String(),
            }),
        })
        .post("/markets/:id/payout", handleMarketPayout, {
            params: t.Object({
                        id: t.Numeric(),
                      }),
        }),
  );