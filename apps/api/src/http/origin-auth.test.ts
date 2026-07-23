import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createOriginAuthMiddleware, ORIGIN_AUTH_HEADER } from "./origin-auth";

describe("origin authentication", () => {
  it("rejects missing and incorrect secrets before reaching a route", async () => {
    const app = express();
    app.use(createOriginAuthMiddleware("o".repeat(32)));
    app.post("/api/write", express.json(), (_request, response) => response.sendStatus(204));

    const missing = await request(app).post("/api/write").send({ large: "body" }).expect(403);
    expect(missing.headers["cache-control"]).toBe("no-store");
    await request(app)
      .post("/api/write")
      .set(ORIGIN_AUTH_HEADER, "wrong")
      .send({})
      .expect(403);
  });

  it("allows the exact secret and narrowly exempts health checks", async () => {
    const secret = "o".repeat(32);
    const app = express();
    app.use(createOriginAuthMiddleware(secret));
    app.get("/api/health", (_request, response) => response.json({ ok: true }));
    app.get("/api/value", (_request, response) => response.json({ ok: true }));

    await request(app).get("/api/health").expect(200);
    await request(app).get("/api/value").set(ORIGIN_AUTH_HEADER, secret).expect(200);
  });
});
