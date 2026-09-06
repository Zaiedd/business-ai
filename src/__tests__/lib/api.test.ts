import { describe, expect, it } from "vitest";
import { ForbiddenError, UnauthorizedError, apiError, apiOk, escapeCsv } from "@/lib/api";

describe("API Response Utilities & Custom Errors", () => {
  it("apiOk formats JSON response wrapper", async () => {
    const res = apiOk({ message: "Success" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ data: { message: "Success" } });
  });

  it("apiError formats JSON error response wrapper", async () => {
    const res = apiError("Invalid request", 400, "BAD_REQUEST");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toEqual({ error: "Invalid request", code: "BAD_REQUEST" });
  });

  it("UnauthorizedError and ForbiddenError produce correct instances", () => {
    const unauth = new UnauthorizedError();
    expect(unauth.message).toBe("Unauthorized");

    const forbidden = new ForbiddenError();
    expect(forbidden.message).toBe("Forbidden");
  });

  it("escapeCsv handles CSV special characters", () => {
    expect(escapeCsv("Normal text")).toBe("Normal text");
    expect(escapeCsv("Hello, world")).toBe('"Hello, world"');
    expect(escapeCsv('Quote "test"')).toBe('"Quote ""test"""');
  });
});
