import { beforeEach, expect, it } from "vitest";
import { EMAIL_MEMORY_TTL_MS, emailMemory } from "./cloud-email-memory";

beforeEach(() => localStorage.clear());

it("guarda, lê e apaga o e-mail", () => {
  expect(emailMemory.read()).toBeNull();
  emailMemory.save("person@example.invalid", 1_000);
  expect(emailMemory.read(2_000)).toBe("person@example.invalid");
  emailMemory.clear();
  expect(emailMemory.read(2_000)).toBeNull();
});
it("expira em uma hora e apaga o que expirou", () => {
  emailMemory.save("person@example.invalid", 1_000);
  expect(emailMemory.read(1_000 + EMAIL_MEMORY_TTL_MS)).toBe("person@example.invalid");
  expect(emailMemory.read(1_001 + EMAIL_MEMORY_TTL_MS)).toBeNull();
  expect(localStorage.length).toBe(0);
});
it("descarta registro adulterado, de formato errado ou do futuro", () => {
  for (const raw of ["não é json", "null", '{"email":1,"at":1}', '{"email":"a@b.c"}']) {
    localStorage.setItem("nexohub.cloud.emailLink", raw);
    expect(emailMemory.read(5_000)).toBeNull();
    expect(localStorage.length).toBe(0);
  }
  emailMemory.save("person@example.invalid", 9_000);
  expect(emailMemory.read(5_000)).toBeNull();
});
