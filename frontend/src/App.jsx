import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import Sidebar from "./components/Sidebar.jsx";
import BrandPage from "./components/BrandPage.jsx";
import CollectionDetail from "./components/CollectionDetail.jsx";
import EmptyHero from "./components/EmptyHero.jsx";
import Toast from "./components/Toast.jsx";

export default function App() {
  const [adapters, setAdapters] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState(null); // { message, isError }

  const showToast = useCallback((message, isError = true) => {
    setToast({ message, isError, at: Date.now() });
  }, []);

  /* ------------------------------- loading ------------------------------- */

  const loadBrands = useCallback(async () => {
    const next = await api("/brands");
    setBrands(next);
    setSelectedBrandId((current) => {
      if (current && next.some((brand) => brand.id === current)) return current;
      return next[0]?.id ?? null;
    });
    return next;
  }, []);

  // Keep a ref so polling always fetches the currently open collection.
  const selectedCollectionRef = useRef(null);
  selectedCollectionRef.current = selectedCollectionId;

  const loadDetail = useCallback(async () => {
    const id = selectedCollectionRef.current;
    if (!id) {
      setDetail(null);
      return;
    }
    try {
      const next = await api(`/collections/${id}`);
      // Ignore stale responses if the user navigated away meanwhile.
      if (selectedCollectionRef.current === id) setDetail(next);
    } catch {
      if (selectedCollectionRef.current === id) {
        setSelectedCollectionId(null);
        setDetail(null);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadBrands(), loadDetail()]);
  }, [loadBrands, loadDetail]);

  /* boot */
  useEffect(() => {
    (async () => {
      try {
        const [adapterList] = await Promise.all([api("/adapters"), loadBrands()]);
        setAdapters(adapterList);
      } catch (error) {
        showToast(`Could not reach the server: ${error.message}`);
      }
    })();
  }, [loadBrands, showToast]);

  /* poll while any scrape is running so status and results appear live */
  const anythingRunning = useMemo(
    () =>
      brands.some((brand) =>
        brand.collections.some((collection) => collection.scrapeStatus === "running"),
      ) || detail?.scrapeStatus === "running",
    [brands, detail],
  );

  useEffect(() => {
    if (!anythingRunning) return undefined;
    const timer = setTimeout(refresh, 1500);
    return () => clearTimeout(timer);
  }, [anythingRunning, brands, detail, refresh]);

  /* ------------------------------- actions ------------------------------- */

  const selectBrand = useCallback((id) => {
    setSelectedBrandId(id);
    setSelectedCollectionId(null);
    setDetail(null);
  }, []);

  const selectCollection = useCallback(
    async (id) => {
      setSelectedCollectionId(id);
      selectedCollectionRef.current = id;
      await loadDetail();
    },
    [loadDetail],
  );

  const backToBrand = useCallback(() => {
    setSelectedCollectionId(null);
    setDetail(null);
  }, []);

  const addBrand = useCallback(
    async (name, website) => {
      const brand = await api("/brands", {
        method: "POST",
        body: JSON.stringify({ name, website }),
      });
      setSelectedCollectionId(null);
      setDetail(null);
      await loadBrands();
      setSelectedBrandId(brand.id);
      showToast(`Brand "${brand.name}" added.`, false);
    },
    [loadBrands, showToast],
  );

  const deleteBrand = useCallback(
    async (brand) => {
      if (!window.confirm(`Delete brand "${brand.name}" and all its collections?`)) return;
      await api(`/brands/${brand.id}`, { method: "DELETE" });
      setSelectedBrandId(null);
      setSelectedCollectionId(null);
      setDetail(null);
      await loadBrands();
    },
    [loadBrands],
  );

  const addCollection = useCallback(
    async (brandId, url) => {
      const collection = await api(`/brands/${brandId}/collections`, {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      await loadBrands();
      showToast(`Collection "${collection.name}" added — scraping now…`, false);
    },
    [loadBrands, showToast],
  );

  const deleteCollection = useCallback(
    async (collection) => {
      if (!window.confirm(`Stop tracking "${collection.name}"?`)) return;
      await api(`/collections/${collection.id}`, { method: "DELETE" });
      if (selectedCollectionRef.current === collection.id) {
        setSelectedCollectionId(null);
        setDetail(null);
      }
      await loadBrands();
    },
    [loadBrands],
  );

  const scrapeCollection = useCallback(
    async (collectionId) => {
      await api(`/collections/${collectionId}/scrape`, { method: "POST" });
      await refresh();
    },
    [refresh],
  );

  /* -------------------------------- render ------------------------------- */

  const selectedBrand = brands.find((brand) => brand.id === selectedBrandId) ?? null;
  const quickAdd = useCallback(async () => {
    const existing = brands.find((brand) => brand.name.toLowerCase() === "onitsuka tiger");
    if (existing) selectBrand(existing.id);
    else await addBrand("Onitsuka Tiger", "https://www.onitsukatiger.com");
  }, [brands, selectBrand, addBrand]);

  return (
    <div className="layout">
      <Sidebar
        brands={brands}
        selectedBrandId={selectedBrandId}
        onSelectBrand={selectBrand}
        onAddBrand={addBrand}
        onError={showToast}
      />
      <main className="main">
        {selectedCollectionId && detail ? (
          <CollectionDetail
            detail={detail}
            brandName={selectedBrand?.name}
            onBack={backToBrand}
            onScrape={scrapeCollection}
            onError={showToast}
          />
        ) : selectedBrand ? (
          <BrandPage
            brand={selectedBrand}
            adapters={adapters}
            onAddCollection={addCollection}
            onDeleteBrand={deleteBrand}
            onDeleteCollection={deleteCollection}
            onScrape={scrapeCollection}
            onView={selectCollection}
            onError={showToast}
          />
        ) : (
          <EmptyHero adapters={adapters} onQuickAdd={quickAdd} onError={showToast} />
        )}
      </main>
      <Toast toast={toast} />
    </div>
  );
}
