import { PLACEHOLDER_IMAGE } from "../config.js";

export const won = (value) => value == null ? "가격 문의" : `${Number(value).toLocaleString("ko-KR")}원`;

export function debounce(callback, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}

export function createElement(tag, options = {}) {
  const element = document.createElement(tag);
  if (options.className) element.className = options.className;
  if (options.text != null) element.textContent = options.text;
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([name, value]) => {
      if (value != null) element.setAttribute(name, String(value));
    });
  }
  return element;
}

export function setSafeImage(image, src, alt = "") {
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";
  image.src = src || PLACEHOLDER_IMAGE;
  image.addEventListener("error", () => {
    image.src = PLACEHOLDER_IMAGE;
    image.classList.add("image-fallback");
  }, { once: true });
  return image;
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}
