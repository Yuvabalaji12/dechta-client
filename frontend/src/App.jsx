import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from './contexts/ThemeContext';
import { useCart } from './contexts/CartContext';
import { useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';
import { hardware, services, serviceData } from './data/products';
import { fetchProducts, fetchActiveVendors, fetchVendorProducts, placeOrder } from './api/apiClient';
import LoadingScreen from './components/LoadingScreen';
import Navbar from './components/Navbar';
import CategoryBar from './components/CategoryBar';
import HomePage from './pages/HomePage';
import ProductPage from './pages/ProductPage';
import InteriorsPage from './pages/InteriorsPage';
import BulkOrderPage from './pages/BulkOrderPage';
import CartDrawer from './components/CartDrawer';
import LoginModal from './components/LoginModal';
import CheckoutModal from './components/CheckoutModal';
import PaymentModal from './components/PaymentModal';
import SuccessModal from './components/SuccessModal';
import ServiceDrawer from './components/ServiceDrawer';
import HireWorkerPage from './pages/HireWorkerPage';
import ProfileModal from './components/ProfileModal';
import SupportModal from './components/SupportModal';
import WishlistModal from './components/WishlistModal';
import BookingsModal from './components/BookingsModal';
import Footer from './components/Footer';
import CraneButton from './components/CraneButton';
import FloatingTexture from './components/FloatingTexture';
import CartNotification from './components/CartNotification';
import EstimateConsultantWidget from './components/EstimateConsultantWidget';
import EstimateConsultantModal from './components/EstimateConsultantModal';
import EstimateConsultantChatModal from './components/EstimateConsultantChatModal';
import FolderSelectModal from './components/FolderSelectModal';
import MobileBottomNav from './components/MobileBottomNav';
import NotifyModal from './components/NotifyModal';
import WishlistAnimation from './components/WishlistAnimation';

// Views for mobile-first navigation
import WishlistView from './components/views/WishlistView';
import BookingsView from './components/views/BookingsView';
import ProfileView from './components/views/ProfileView';
import PrivacyPolicyView from './components/views/PrivacyPolicyView';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('home');
  const [activeCategory, setActiveCategory] = useState('all');
  const [currentProduct, setCurrentProduct] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerKey, setDrawerKey] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [bookingsOpen, setBookingsOpen] = useState(false);
  const [bookingId, setBookingId] = useState(null);
  const [cartNotifItem, setCartNotifItem] = useState(null);
  const [consultantModalOpen, setConsultantModalOpen] = useState(false);
  const [consultantChatOpen, setConsultantChatOpen] = useState(false);
  const [folderSelectOpen, setFolderSelectOpen] = useState(false);
  const [selectedProductForFolder, setSelectedProductForFolder] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [notifyProduct, setNotifyProduct] = useState(null);
  const [wishlistAnims, setWishlistAnims] = useState([]);

  const [activeVendors, setActiveVendors] = useState([]);
  const [liveProducts, setLiveProducts] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);

  // ── Load products & vendors from backend on mount ─────────
  useEffect(() => {
    fetchProducts()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setLiveProducts(res.data);
          console.log('[APP] Products loaded:', res.data.length);
        } else {
          console.warn('[APP] fetchProducts returned unexpected shape:', res);
        }
      })
      .catch((e) => {
        console.error('[APP] fetchProducts failed — is client backend running on port 5001?', e.message);
      });

    fetchActiveVendors()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setActiveVendors(res.data);
        }
      })
      .catch((e) => console.warn('[API] fetchActiveVendors failed:', e.message));
  }, []);

  // ── Load products for a specific vendor shop ──────────────
  const loadShopProducts = useCallback((vendor) => {
    setSelectedVendor(vendor);
    if (!vendor?.id) return;
    fetchVendorProducts(vendor.id)
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setLiveProducts(res.data);
        }
      })
      .catch((e) => console.warn('[API] fetchVendorProducts failed:', e.message));
  }, []);
  const { showToast } = useToast();
  const { addToCart: cartAddToCart, clearCart } = useCart();
  const { authLoading, isLoggedIn, userData, toggleWishlist, addBooking } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 4500);
    return () => clearTimeout(timer);
  }, []);

  // Unused effect removed

  const openProduct = useCallback((product, source) => {
    setCurrentProduct({ 
      ...product, 
      source,
      vendorName: product.vendorName || (selectedVendor ? selectedVendor.shop_name : null)
    });
    setCurrentPage('product');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [selectedVendor]);

  const openInteriors = useCallback(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setCurrentPage('interiors');
    setActiveCategory('services');
  }, []);

  const goHome = useCallback((targetCat = 'all') => {
    setCurrentPage('home');
    if (targetCat) setActiveCategory(targetCat);
    setCurrentProduct(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleWishlistClick = useCallback((product, event) => {
    // Determine the animation start coordinates
    let startX = window.innerWidth / 2;
    let startY = window.innerHeight / 2;

    if (event) {
      // Look for the closest valid target or use mouse position
      const targetElement = event.currentTarget || event.target;
      if (targetElement && typeof targetElement.getBoundingClientRect === 'function') {
        const rect = targetElement.getBoundingClientRect();
        startX = rect.left + (rect.width / 2);
        startY = rect.top + (rect.height / 2);
      } else {
        startX = event.clientX;
        startY = event.clientY;
      }
    }

    if (userData.wishlistFolders && userData.wishlistFolders.length > 0) {
      setSelectedProductForFolder(product);
      setFolderSelectOpen(true);
    } else {
      // Direct save to default wishlist
      const isRemoving = userData.wishlist.includes(product.id);
      toggleWishlist(product.id);

      if (isRemoving) {
        showToast('Removed from Wishlist');
      } else {
        showToast('Saved to Wishlist');
        // Only animate when ADDING to wishlist
        setWishlistAnims(prev => [...prev, {
          id: Date.now() + Math.random(),
          startX,
          startY
        }]);
      }
    }
  }, [userData.wishlistFolders, userData.wishlist, toggleWishlist, showToast]);

  const openDrawerForService = useCallback((key) => {
    setDrawerKey(key);
    setDrawerOpen(true);
  }, []);

  const navPages = ['wishlist', 'bookings', 'profile', 'privacy'];
  const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 1024;
  const isNavPage = navPages.includes(currentPage);
  const hideGlobalUIOnMobile = isMobile() && isNavPage;

  const handleNotifyClick = useCallback((product) => {
    setNotifyProduct(product);
    setNotifyModalOpen(true);
  }, []);

  const handleMobileNav = useCallback((page, desktopModalSetter) => {
    if (isMobile()) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else {
      desktopModalSetter(true);
    }
  }, []);

  const handleAddToCart = useCallback((item) => {
    // Enrich cart item with full product data from liveProducts
    // This ensures vendor_id is always correctly populated for order routing
    const fullProduct = liveProducts.find(p => String(p.id) === String(item.id));
    const enriched = fullProduct ? {
      ...item,
      vendor_id:     fullProduct.vendor_id     || null,
      selling_price: fullProduct.selling_price  || item.price,
      price:         item.price || fullProduct.selling_price || fullProduct.price,
      images:        fullProduct.images         || [],
      category:      fullProduct.category       || '',
      shop_name:     fullProduct.shop_name      || null,
    } : item;

    cartAddToCart(enriched);
    setCartNotifItem(enriched);
  }, [cartAddToCart, liveProducts]);

  const handlePlaceOrder = useCallback(async (items, total, extraData) => {
    const bId = Math.floor(1000 + Math.random() * 9000);
    setBookingId(bId);

    // ── Save order to backend DB so vendor can see it ─────────
    try {
      const orderPayload = {
        items: items.map(i => ({
          id:           i.id,
          name:         i.name,
          price:        i.price || i.selling_price,
          qty:          i.qty || 1,
          vendor_id:    i.vendor_id || null,
          images:       i.images,
        })),
        total_amount:     total,
        customer_name:    userData.name  || '',
        customer_phone:   userData.phone || '',
        delivery_address: extraData?.address || '',
        schedule:         extraData?.schedule || null,
        instructions:     extraData?.instructions || null,
        tip:              extraData?.tip || 0,
      };
      const res = await placeOrder(orderPayload);
      if (res.success) {
        console.log('[ORDER] Saved to DB, bookingId:', res.data?.bookingId);
      }
    } catch (e) {
      // Non-blocking — UI still completes even if API fails
      console.warn('[ORDER] API save failed (order still shown locally):', e.message);
    }

    // ── Update local state for immediate UI feedback ──────────
    addBooking({
      id: bId,
      date: extraData?.schedule?.date || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      time: extraData?.schedule?.time || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      items,
      total,
      status: 'Confirmed',
      tip: extraData?.tip || 0,
      instructions: extraData?.instructions || null,
      isScheduled: !!extraData?.schedule,
      gst: extraData?.gst || null
    });

    clearCart();
    setOrderData(null);
    setPaymentOpen(false);
    setCheckoutOpen(false);
    setSuccessOpen(true);
  }, [addBooking, clearCart, userData]);

  const setCategory = useCallback((cat) => {
    setActiveCategory(cat);

    if (cat === 'services') {
      setActiveCategory('services');
      openInteriors();
      return;
    }

    if (cat === 'hire') {
      setActiveCategory('hire');
      setCurrentPage('hire');
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    const scrollToHardware = () => {
      // Find the parent section to ensure we see the title
      const sliderEl = document.getElementById('hardware-slider');
      if (sliderEl && sliderEl.parentElement) {
        // Adjust -140px to account for the fixed Navbar and CategoryBar
        const yOffset = -140;
        const y = sliderEl.parentElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    };

    if (currentPage !== 'home') {
      goHome(cat);
      // Wait for home page to render before scrolling
      setTimeout(() => {
        if (cat === 'hardware') {
          scrollToHardware();
        } else if (cat === 'hire') {
          setCurrentPage('hire');
        } else if (cat === 'all') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);
    } else {
      if (cat === 'hardware') {
        scrollToHardware();
      } else if (cat === 'hire') {
        setCurrentPage('hire');
      } else if (cat === 'all') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [currentPage, goHome, openInteriors]);

  // Wait for both: app loading animation AND auth session check
  if (loading || authLoading) return <LoadingScreen />;

  return (
    <div className="overflow-x-hidden relative bg-white text-qc-black dark:bg-[#020617] dark:text-white transition-colors duration-300 min-h-screen selection:bg-cyan-500 selection:text-white font-sans pb-20 lg:pb-0">
      <FloatingTexture />
      {currentPage === 'home' && (
        <>
          <div className="hidden md:block absolute top-0 left-0 w-full h-[450px] overflow-hidden pointer-events-none z-10">
            <img src="https://pngimg.com/d/wrench_PNG1117.png" className="absolute -left-20 top-[32%] w-64 md:w-80 h-auto object-contain scale-x-[-1] rotate-[15deg] drop-shadow-2xl opacity-90" alt="Spanner" />
            <img src="https://pngimg.com/d/hammer_PNG3886.png" className="absolute -right-16 top-[35%] w-64 md:w-80 h-auto object-contain -rotate-[35deg] drop-shadow-2xl opacity-90" alt="Hammer" />
          </div>
          <div className="absolute top-0 left-0 w-full h-[860px] md:h-[780px] bg-cyan-400 z-0" />
        </>
      )}

      {currentPage !== 'privacy' && !hideGlobalUIOnMobile && (
        <>
          <Navbar
            allProducts={[...hardware, ...services, ...(liveProducts || [])]}
            onOpenProduct={openProduct}
            onCartClick={() => setCartOpen(!cartOpen)}
            onLoginClick={() => setLoginOpen(true)}
            onProfileClick={() => setProfileOpen(true)}
            onWishlistClick={() => setWishlistOpen(true)}
            onBookingsClick={() => setBookingsOpen(true)}
            onSupportClick={() => setSupportOpen(true)}
            onLogoClick={goHome}
          />
          <CategoryBar activeCategory={activeCategory} setCategory={setCategory} />
        </>
      )}

      {currentPage === 'home' && (
        <CraneButton onClick={() => setCurrentPage('hire')} />
      )}

      {currentPage === 'home' && (
        <HomePage
          hardware={hardware}
          services={services}
          liveProducts={liveProducts}
          activeVendors={activeVendors}
          selectedVendor={selectedVendor}
          onSelectVendor={loadShopProducts}
          onOpenProduct={openProduct}
          onAddToCart={handleAddToCart}
          onWishlistClick={handleWishlistClick}
          onNotifyClick={handleNotifyClick}
          onOpenDrawer={openDrawerForService}
          onOpenHireMap={() => setCurrentPage('hire')}
          onOpenInteriors={openInteriors}
        />
      )}

      {currentPage === 'hire' && (
        <HireWorkerPage onBack={() => goHome('all')} />
      )}

      {currentPage === 'product' && currentProduct && (
        <ProductPage product={currentProduct} onBack={goHome} onAddToCart={handleAddToCart} onWishlistClick={handleWishlistClick} onNotifyClick={handleNotifyClick} />
      )}


      {currentPage === 'interiors' && (
        <InteriorsPage onBack={() => goHome('all')} onOpenConsultant={() => setConsultantModalOpen(true)} />
      )}

      {currentPage === 'wishlist' && (
        <WishlistView liveProducts={liveProducts} openProduct={openProduct} isPage={true} onBack={goHome} />
      )}

      {currentPage === 'bookings' && (
        <BookingsView isPage={true} onBack={goHome} />
      )}

      {currentPage === 'profile' && (
        <ProfileView isPage={true} onBack={goHome} />
      )}

      {currentPage === 'privacy' && (
        <PrivacyPolicyView onBack={goHome} />
      )}

      {currentPage !== 'privacy' && !hideGlobalUIOnMobile && (
        <Footer 
          onOpenDrawer={openDrawerForService} 
          onOpenHireMap={() => setCurrentPage('hire')} 
          onPrivacyClick={() => setCurrentPage('privacy')}
        />
      )}

      {/* Overlays */}
      <CartNotification item={cartNotifItem} onClose={() => setCartNotifItem(null)} />
      <CartDrawer 
        open={cartOpen} 
        onClose={() => setCartOpen(false)} 
        onProductClick={(item) => {
          // Find the full product object from our data
          let fullProduct = hardware.find(p => p.id == item.id);
          if (!fullProduct) fullProduct = services.find(p => p.id == item.id);
          if (!fullProduct) {
            Object.values(serviceData).forEach(cat => {
              const found = cat.items.find(p => p.id == item.id);
              if (found) fullProduct = found;
            });
          }
          if (!fullProduct && liveProducts) {
            fullProduct = liveProducts.find(p => p.id == item.id);
          }

          if (fullProduct) {
            openProduct(fullProduct);
            setCartOpen(false);
          }
        }}
        onCheckout={() => {
          setCartOpen(false);
          if (isLoggedIn) {
            setCheckoutOpen(true);
          } else {
            setLoginOpen(true);
          }
        }} 
      />
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} onPay={(data) => { setOrderData(data); setPaymentOpen(true); }} />
      <PaymentModal open={paymentOpen} onClose={() => setPaymentOpen(false)} onSuccess={handlePlaceOrder} orderData={orderData} />
      <SuccessModal open={successOpen} bookingId={bookingId} onClose={() => setSuccessOpen(false)} />
      <ServiceDrawer open={drawerOpen} serviceKey={drawerKey} onClose={() => setDrawerOpen(false)} onViewCart={() => { setDrawerOpen(false); setCartOpen(true); }} />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
      <WishlistModal open={wishlistOpen} onClose={() => setWishlistOpen(false)} liveProducts={liveProducts} openProduct={openProduct} />
      <BookingsModal open={bookingsOpen} onClose={() => setBookingsOpen(false)} />
      <FolderSelectModal open={folderSelectOpen} onClose={() => setFolderSelectOpen(false)} product={selectedProductForFolder} />
      {currentPage !== 'privacy' && currentPage !== 'hire' && (
        <>
          <EstimateConsultantWidget onOpenModal={() => setConsultantModalOpen(true)} />
          <EstimateConsultantModal open={consultantModalOpen} onClose={() => setConsultantModalOpen(false)} onOpenChat={() => { setConsultantModalOpen(false); setConsultantChatOpen(true); }} />
          <EstimateConsultantChatModal open={consultantChatOpen} onClose={() => setConsultantChatOpen(false)} />
        </>
      )}
      <NotifyModal open={notifyModalOpen} onClose={() => setNotifyModalOpen(false)} product={notifyProduct} />

      {/* Render Wishlist Animations */}
      {wishlistAnims.map(anim => (
        <WishlistAnimation
          key={anim.id}
          id={anim.id}
          startX={anim.startX}
          startY={anim.startY}
          onComplete={(idToRemove) => {
            setWishlistAnims(prev => prev.filter(a => a.id !== idToRemove));
          }}
        />
      ))}

      {currentPage !== 'privacy' && (
        <MobileBottomNav
          currentPage={currentPage}
          onHomeClick={goHome}
          onWishlistClick={() => handleMobileNav('wishlist', setWishlistOpen)}
          onBookingsClick={() => handleMobileNav('bookings', setBookingsOpen)}
          onProfileClick={() => handleMobileNav('profile', setProfileOpen)}
          onLoginClick={() => setLoginOpen(true)}
        />
      )}
    </div>
  );
}