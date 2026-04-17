import { Elysia } from "elysia";

export const adminMiddleware = new Elysia({ name: "admin-middleware" })
  .derive(({ user, set }) => {

    if (user.role !== "admin") {
      set.status = 403;
      return { admin: null };
    }

    return {
      admin: user,
    };
  })
  .as("plugin");