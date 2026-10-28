import { describe, it, expect } from "vitest";
import { chaveDaBase64, mesmaChave } from "./chaveDePush";

describe("chaveDaBase64", () => {
  it("lê base64url sem preenchimento", () => {
    expect(Array.from(chaveDaBase64("AQID"))).toEqual([1, 2, 3]);
    expect(Array.from(chaveDaBase64("-_8"))).toEqual([251, 255]);
    expect(Array.from(chaveDaBase64(""))).toEqual([]);
  });
});

describe("mesmaChave", () => {
  it("compara byte a byte", () => {
    expect(mesmaChave(new Uint8Array([1, 2, 3]).buffer, new Uint8Array([1, 2, 3]))).toBe(true);
    expect(mesmaChave(new Uint8Array([1, 2, 4]).buffer, new Uint8Array([1, 2, 3]))).toBe(false);
    expect(mesmaChave(new Uint8Array([1, 2]).buffer, new Uint8Array([1, 2, 3]))).toBe(false);
  });
  it("sem a chave da inscrição, não é a mesma", () => {
    expect(mesmaChave(null, new Uint8Array([1]))).toBe(false);
    expect(mesmaChave(undefined, new Uint8Array([1]))).toBe(false);
  });
});
