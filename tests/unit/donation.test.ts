import { describe, expect, it } from "vitest";
import { DONATION_URL, donationHref } from "../../shared/donation.js";

describe("enlace de donación", () => {
  it("solo deja pasar una página de Ko-fi bien escrita", () => {
    expect(donationHref("https://ko-fi.com/ejemplo")).toBe("https://ko-fi.com/ejemplo");
    expect(donationHref("https://ko-fi.com/ejemplo_2")).toBe("https://ko-fi.com/ejemplo_2");
  });

  it("sin enlace, o con uno raro, no se enseña nada", () => {
    for (const url of [
      "",
      "ko-fi.com/ejemplo",
      "http://ko-fi.com/ejemplo",
      "https://ko-fi.com/",
      "https://ko-fi.com/ejemplo/tienda",
      "https://ko-fi.com/ejemplo?ref=x",
      "https://ko-fi.com.malo.example/ejemplo",
      "javascript:alert(1)",
    ]) {
      expect(donationHref(url)).toBeNull();
    }
  });

  it("el enlace guardado está vacío o es válido", () => {
    if (DONATION_URL !== "") expect(donationHref()).toBe(DONATION_URL);
  });
});
