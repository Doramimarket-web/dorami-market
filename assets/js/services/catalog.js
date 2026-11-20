export class CatalogRepository {
  #summaries = [];
  #brandFiles = new Map();
  #chunkCache = new Map();
  #sizeGuides = {};

  async initialize() {
    const [summariesResponse, brandsResponse, guidesResponse] = await Promise.all([
      fetch("./data/catalog-index.json"),
      fetch("./data/brands.json"),
      fetch("./data/size-guides.json")
    ]);
    if (![summariesResponse, brandsResponse, guidesResponse].every((response) => response.ok)) {
      throw new Error("카탈로그 데이터를 불러오지 못했습니다.");
    }
    this.#summaries = await summariesResponse.json();
    const brands = await brandsResponse.json();
    this.#brandFiles = new Map(brands.map((brand) => [brand.name, brand.file]));
    this.#sizeGuides = await guidesResponse.json();
    return { products: this.#summaries, brands };
  }

  findSummary(id) {
    return this.#summaries.find((product) => product.id === id);
  }

  async getProduct(id, brand) {
    const file = this.#brandFiles.get(brand);
    if (!file) throw new Error("브랜드 상세 데이터를 찾을 수 없습니다.");
    if (!this.#chunkCache.has(file)) {
      this.#chunkCache.set(file, fetch(`./data/brands/${file}`).then((response) => {
        if (!response.ok) throw new Error("상품 상세 정보를 불러오지 못했습니다.");
        return response.json();
      }));
    }
    const products = await this.#chunkCache.get(file);
    const product = products.find((item) => item.id === id);
    if (!product) throw new Error("상품을 찾을 수 없습니다.");
    return product;
  }

  getSizeGuide(brand) {
    return this.#sizeGuides[brand] || null;
  }
}
