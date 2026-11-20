import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD, STORAGE_KEY } from "../config.js";

function isCartItem(item) {
  return item && typeof item.id === "string" && typeof item.qty === "number" && item.qty > 0;
}

export class CartStore {
  #items = [];
  #listeners = new Set();

  constructor() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      this.#items = Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
    } catch {
      this.#items = [];
    }
  }

  get items() { return this.#items.map((item) => ({ ...item })); }
  get count() { return this.#items.reduce((sum, item) => sum + item.qty, 0); }

  add(product, options) {
    const qty = Math.max(1, Math.min(99, Number(options.qty) || 1));
    const existing = this.#items.find((item) => item.id === product.id && item.color === options.color && item.size === options.size);
    if (existing) existing.qty = Math.min(99, existing.qty + qty);
    else this.#items.push({
      id: product.id,
      brand: product.brand,
      name: product.name,
      image: product.image,
      price: product.price,
      color: options.color || "-",
      size: options.size || "-",
      qty
    });
    this.#commit();
  }

  remove(index) {
    this.#items.splice(index, 1);
    this.#commit();
  }

  totals(firstOrder = false) {
    const subtotal = this.#items.reduce((sum, item) => sum + (Number(item.price) || 0) * item.qty, 0);
    const delivery = !this.#items.length || firstOrder || subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
    return { subtotal, delivery, total: subtotal + delivery };
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    listener(this);
    return () => this.#listeners.delete(listener);
  }

  #commit() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#items));
    this.#listeners.forEach((listener) => listener(this));
  }
}
