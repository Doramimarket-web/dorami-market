import { CATALOG_PAGE_SIZE, DETAIL_IMAGE_BATCH, FREE_DELIVERY_THRESHOLD } from "./config.js";
import { MARKET_CONFIG } from "./market.config.js";
import { createElement, debounce, setSafeImage, won, copyText } from "./lib/utils.js";
import { CatalogRepository } from "./services/catalog.js";
import { CartStore } from "./state/cart.js";

const elements = {
  grid: document.querySelector("#product-grid"),
  count: document.querySelector("#result-count"),
  search: document.querySelector("#search-input"),
  brand: document.querySelector("#brand-select"),
  loadMore: document.querySelector("#load-more"),
  notice: document.querySelector("#catalog-notice"),
  cartCount: document.querySelector("#cart-count"),
  detailDialog: document.querySelector("#detail-dialog"),
  detailContent: document.querySelector("#detail-content"),
  cartDialog: document.querySelector("#cart-dialog"),
  cartList: document.querySelector("#cart-list"),
  cartSummary: document.querySelector("#cart-summary"),
  firstOrder: document.querySelector("#first-order"),
  sizeDialog: document.querySelector("#size-dialog"),
  sizeContent: document.querySelector("#size-content"),
  sizeGuideButton: document.querySelector("#open-size-guide"),
  firstOrderOption: document.querySelector("#first-order-option"),
  brandChips: document.querySelector("#brand-chips"),
  brandDirectory: document.querySelector("#brand-directory"),
  brandsDialog: document.querySelector("#brands-dialog"),
  openAllBrands: document.querySelector("#open-all-brands"),
  catalog: document.querySelector("#catalog"),
  catalogTitle: document.querySelector("#catalog-title"),
  toast: document.querySelector("#toast")
};

const repository = new CatalogRepository();
const cart = new CartStore();
let allProducts = [];
let filteredProducts = [];
let visibleCount = CATALOG_PAGE_SIZE;
let activeProduct = null;
let detailImageCount = DETAIL_IMAGE_BATCH;
let brandRows = [];
let primaryBrandNames = [];
let toastTimer;

function applyMarketConfig() {
  document.title = MARKET_CONFIG.pageTitle;
  document.querySelector('meta[name="description"]')?.setAttribute("content", MARKET_CONFIG.description);
  document.querySelector("#site-name").textContent = MARKET_CONFIG.siteName;
  document.querySelector("#site-label").textContent = MARKET_CONFIG.siteLabel;
  document.querySelector("#site-identity").setAttribute("aria-label", MARKET_CONFIG.homeAriaLabel);
  document.querySelector("#hero-image").src = MARKET_CONFIG.heroImage;
  document.querySelector("#hero-image").alt = MARKET_CONFIG.heroAlt;
  document.querySelector("#footer-name").textContent = MARKET_CONFIG.siteName;
  document.querySelector("#footer-message").textContent = MARKET_CONFIG.footerMessage;
  document.querySelector("#first-order-label").textContent = MARKET_CONFIG.firstOrderLabel;
  elements.sizeGuideButton.hidden = !MARKET_CONFIG.features.sizeGuide;
  elements.firstOrderOption.hidden = !MARKET_CONFIG.features.firstOrderFreeDelivery;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}

function renderSkeletons() {
  elements.grid.replaceChildren(...Array.from({ length: 8 }, () => createElement("div", { className: "skeleton" })));
}

function makeProductCard(product) {
  const article = createElement("article", { className: "product-card" });
  const button = createElement("button", {
    className: "product-card__button",
    attrs: { type: "button", "data-product-id": product.id, "aria-label": `${product.brand} ${product.name} 상세 보기` }
  });
  const imageWrap = createElement("div", { className: "product-card__image-wrap" });
  const image = setSafeImage(createElement("img", { className: "product-card__image" }), product.image, product.name);
  const body = createElement("div", { className: "product-card__body" });
  body.append(
    createElement("p", { className: "product-card__brand", text: product.brand }),
    createElement("h3", { className: "product-card__name", text: product.name }),
    createElement("p", { className: "product-card__price", text: won(product.price) })
  );
  imageWrap.append(image);
  button.append(imageWrap, body);
  article.append(button);
  return article;
}

function renderProducts() {
  const visible = filteredProducts.slice(0, visibleCount);
  elements.grid.replaceChildren(...visible.map(makeProductCard));
  elements.grid.setAttribute("aria-busy", "false");
  elements.count.textContent = `총 ${filteredProducts.length.toLocaleString("ko-KR")}개 상품`;
  elements.loadMore.hidden = visible.length >= filteredProducts.length;
  if (!visible.length) {
    elements.grid.append(createElement("p", { className: "empty-state", text: "검색 조건에 맞는 상품이 없습니다." }));
  }
}

function filterProducts() {
  const query = elements.search.value.trim().toLocaleLowerCase("ko-KR");
  const brand = elements.brand.value;
  filteredProducts = allProducts.filter((product) => {
    const matchesBrand = !brand || product.brand === brand;
    const haystack = `${product.brand} ${product.name}`.toLocaleLowerCase("ko-KR");
    return matchesBrand && (!query || haystack.includes(query));
  });
  visibleCount = CATALOG_PAGE_SIZE;
  renderProducts();
  syncBrandControls();
}

function makeBrandFilterButton(label, value, count = null, className = "brand-chip") {
  const button = createElement("button", {
    className,
    attrs: { type: "button", "data-brand-filter": value, "aria-pressed": "false" }
  });
  button.append(createElement("span", { text: label }));
  if (count != null) button.append(createElement("small", { text: count.toLocaleString("ko-KR") }));
  return button;
}

function renderBrandNavigation(brands) {
  brandRows = [...brands];
  const ranked = [...brands].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"));
  const primary = ranked.slice(0, MARKET_CONFIG.primaryBrandCount);
  primaryBrandNames = primary.map((brand) => brand.name);
  elements.brandChips.replaceChildren(
    makeBrandFilterButton("전체", ""),
    ...primary.map((brand) => makeBrandFilterButton(brand.name, brand.name))
  );

  const alphabetical = [...brands].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  elements.brandDirectory.replaceChildren(
    makeBrandFilterButton("전체 상품", "", allProducts.length, "brand-directory__item"),
    ...alphabetical.map((brand) => makeBrandFilterButton(brand.name, brand.name, brand.count, "brand-directory__item"))
  );
  syncBrandControls();
}

function syncBrandControls() {
  const selected = elements.brand.value;
  document.querySelectorAll("[data-brand-filter]").forEach((button) => {
    const isSelected = button.dataset.brandFilter === selected;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
  const isSecondaryBrand = selected && !primaryBrandNames.includes(selected);
  elements.openAllBrands.classList.toggle("is-selected", Boolean(isSecondaryBrand));
  elements.openAllBrands.firstChild.textContent = isSecondaryBrand ? `${selected} · 전체 브랜드 ` : "전체 브랜드 ";
  elements.catalogTitle.textContent = selected ? `${selected} 상품` : "전체 상품";
}

function setBrandFilter(brand, { scroll = false, closeDirectory = false } = {}) {
  if (!brandRows.some((row) => row.name === brand)) brand = "";
  elements.brand.value = brand;
  filterProducts();
  if (closeDirectory) closeDialog(elements.brandsDialog);
  if (scroll) requestAnimationFrame(() => elements.catalog.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function addSelectOptions(select, values) {
  const options = values.map((value) => createElement("option", { text: value.name, attrs: { value: value.name } }));
  select.append(...options);
}

function makeSelect(id, values) {
  const select = createElement("select", { attrs: { id } });
  (values?.length ? values : ["선택 없음"]).forEach((value) => select.append(createElement("option", { text: value, attrs: { value } })));
  return select;
}

async function openProduct(id, updateHash = true) {
  const summary = repository.findSummary(id);
  if (!summary) return;
  elements.detailContent.replaceChildren(createElement("p", { className: "detail-loading", text: "상품 상세 정보를 불러오는 중..." }));
  openDialog(elements.detailDialog);
  if (updateHash) history.replaceState(null, "", `#product=${encodeURIComponent(id)}`);
  try {
    activeProduct = await repository.getProduct(id, summary.brand);
    detailImageCount = DETAIL_IMAGE_BATCH;
    renderDetail();
  } catch (error) {
    elements.detailContent.replaceChildren(createElement("p", { className: "detail-error", text: error.message }));
  }
}

function renderDetail() {
  const product = activeProduct;
  const head = createElement("div", { className: "detail-head" });
  const hero = setSafeImage(createElement("img", { className: "detail-hero" }), product.image, product.name);
  hero.loading = "eager";
  const info = createElement("div", { className: "detail-info" });
  const colorSelect = makeSelect("detail-color", product.colors);
  const sizeSelect = makeSelect("detail-size", product.sizes);
  const quantity = createElement("input", { attrs: { id: "detail-qty", type: "number", min: 1, max: 99, value: 1, inputmode: "numeric" } });
  const addButton = createElement("button", { className: "button button--primary button--full", text: product.price == null ? "가격 문의 상품" : "장바구니 담기", attrs: { type: "button" } });
  addButton.disabled = product.price == null;
  addButton.addEventListener("click", () => {
    cart.add(product, { color: colorSelect.value, size: sizeSelect.value, qty: quantity.value });
    closeDialog(elements.detailDialog);
    clearProductHash();
    renderCart();
    openDialog(elements.cartDialog);
    showToast("장바구니에 담았습니다.");
  });
  info.append(
    createElement("p", { className: "eyebrow", text: product.brand }),
    createElement("h2", { text: product.name, attrs: { id: "detail-title" } }),
    createElement("p", { className: "detail-price", text: won(product.price) }),
    createElement("label", { className: "field-label", text: "색상", attrs: { for: "detail-color" } }), colorSelect,
    createElement("label", { className: "field-label", text: "사이즈", attrs: { for: "detail-size" } }), sizeSelect,
    createElement("label", { className: "field-label", text: "수량", attrs: { for: "detail-qty" } }), quantity,
    addButton
  );
  head.append(hero, info);

  const gallery = createElement("section", { className: "detail-gallery" });
  gallery.append(createElement("h3", { text: "상품 상세" }));
  product.photos.slice(0, detailImageCount).forEach((url, index) => {
    gallery.append(setSafeImage(createElement("img"), url, `${product.name} 상세 이미지 ${index + 1}`));
  });
  if (detailImageCount < product.photos.length) {
    const more = createElement("button", { className: "button button--outline", text: `상세 이미지 더 보기 (${product.photos.length - detailImageCount})`, attrs: { type: "button" } });
    more.addEventListener("click", () => {
      detailImageCount += DETAIL_IMAGE_BATCH;
      renderDetail();
    });
    gallery.append(more);
  }
  elements.detailContent.replaceChildren(head, gallery);
}

function clearProductHash() {
  if (location.hash.startsWith("#product=")) history.replaceState(null, "", `${location.pathname}${location.search}`);
}

function renderCart() {
  const items = cart.items;
  elements.cartList.replaceChildren();
  if (!items.length) {
    elements.cartList.append(createElement("p", { className: "empty-state", text: "장바구니가 비어 있습니다." }));
  } else {
    items.forEach((item, index) => {
      const row = createElement("article", { className: "cart-row" });
      const image = setSafeImage(createElement("img"), item.image, item.name);
      const info = createElement("div");
      info.append(
        createElement("h3", { text: `${item.brand} · ${item.name}` }),
        createElement("p", { text: `${item.color} / ${item.size} / ${item.qty}개` }),
        createElement("p", { text: won(item.price * item.qty) })
      );
      const remove = createElement("button", { className: "remove-button", text: "삭제", attrs: { type: "button", "aria-label": `${item.name} 삭제` } });
      remove.addEventListener("click", () => cart.remove(index));
      row.append(image, info, remove);
      elements.cartList.append(row);
    });
  }
  const firstOrder = MARKET_CONFIG.features.firstOrderFreeDelivery && elements.firstOrder.checked;
  const totals = cart.totals(firstOrder);
  elements.cartSummary.replaceChildren();
  [["상품 합계", totals.subtotal], ["배송비", totals.delivery], ["총 예상 금액", totals.total]].forEach(([label, value]) => {
    const row = createElement("p");
    row.append(createElement("span", { text: label }), createElement("strong", { text: won(value) }));
    elements.cartSummary.append(row);
  });
}

function buildOrderText() {
  const items = cart.items;
  const firstOrder = MARKET_CONFIG.features.firstOrderFreeDelivery && elements.firstOrder.checked;
  const totals = cart.totals(firstOrder);
  const lines = [`[${MARKET_CONFIG.orderTitle}]`];
  items.forEach((item) => lines.push("", `${item.brand}.${item.name}`, `색상: ${item.color} / 사이즈: ${item.size} / 수량: ${item.qty}`, `금액: ${won(item.price * item.qty)}`));
  lines.push("", `상품 합계: ${won(totals.subtotal)}`, `배송비: ${won(totals.delivery)}`, `총 예상 금액: ${won(totals.total)}`);
  if (firstOrder) lines.push(`※ ${MARKET_CONFIG.firstOrderLabel} (사용 여부 확인 필요)`);
  else if (totals.subtotal >= FREE_DELIVERY_THRESHOLD) lines.push("※ 30만원 이상 무료배송");
  return lines.join("\n");
}

function openSizeGuide() {
  const brand = elements.brand.value;
  const body = createElement("div", { className: "guide-body" });
  if (!brand) {
    body.append(createElement("p", { text: "상품 목록에서 브랜드를 먼저 선택하면 해당 브랜드의 사이즈표를 확인할 수 있습니다." }));
  } else {
    body.append(createElement("h3", { text: `${brand} 사이즈표` }));
    const url = repository.getSizeGuide(brand);
    if (url) body.append(setSafeImage(createElement("img"), url, `${brand} 사이즈표`));
    else body.append(createElement("p", { text: "이 브랜드의 사이즈표는 준비 중입니다." }));
  }
  elements.sizeContent.replaceChildren(body);
  openDialog(elements.sizeDialog);
}

function bindEvents() {
  elements.search.addEventListener("input", debounce(filterProducts));
  elements.brand.addEventListener("change", () => setBrandFilter(elements.brand.value));
  elements.brandChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-brand-filter]");
    if (button) setBrandFilter(button.dataset.brandFilter, { scroll: true });
  });
  elements.brandDirectory.addEventListener("click", (event) => {
    const button = event.target.closest("[data-brand-filter]");
    if (button) setBrandFilter(button.dataset.brandFilter, { scroll: true, closeDirectory: true });
  });
  elements.openAllBrands.addEventListener("click", () => openDialog(elements.brandsDialog));
  elements.loadMore.addEventListener("click", () => { visibleCount += CATALOG_PAGE_SIZE; renderProducts(); });
  elements.grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-product-id]");
    if (button) openProduct(button.dataset.productId);
  });
  document.querySelector("#open-cart").addEventListener("click", () => { renderCart(); openDialog(elements.cartDialog); });
  document.querySelector("#open-size-guide").addEventListener("click", openSizeGuide);
  document.querySelector("#copy-order").addEventListener("click", async () => {
    if (!cart.items.length) { showToast("장바구니가 비어 있습니다."); return; }
    try { await copyText(buildOrderText()); showToast("주문서를 복사했습니다."); }
    catch { showToast("주문서를 복사하지 못했습니다."); }
  });
  elements.firstOrder.addEventListener("change", renderCart);
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => {
    closeDialog(document.querySelector(`#${button.dataset.close}`));
  }));
  [elements.detailDialog, elements.cartDialog, elements.sizeDialog, elements.brandsDialog].forEach((dialog) => {
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  });
  elements.detailDialog.addEventListener("close", clearProductHash);
  window.addEventListener("hashchange", () => {
    const match = location.hash.match(/^#product=(.+)$/);
    if (match) openProduct(decodeURIComponent(match[1]), false);
  });
}

async function initialize() {
  applyMarketConfig();
  renderSkeletons();
  bindEvents();
  cart.subscribe((store) => {
    elements.cartCount.textContent = store.count;
    if (elements.cartDialog.open) renderCart();
  });
  try {
    const { products, brands } = await repository.initialize();
    allProducts = products;
    filteredProducts = products;
    addSelectOptions(elements.brand, brands);
    renderBrandNavigation(brands);
    renderProducts();
    const match = location.hash.match(/^#product=(.+)$/);
    if (match) openProduct(decodeURIComponent(match[1]), false);
  } catch (error) {
    elements.notice.hidden = false;
    elements.notice.textContent = `${error.message} 로컬에서 확인할 때는 웹 서버를 실행해 주세요.`;
    elements.grid.replaceChildren(createElement("p", { className: "empty-state", text: "카탈로그를 표시할 수 없습니다." }));
    elements.grid.setAttribute("aria-busy", "false");
  }
}

initialize();
