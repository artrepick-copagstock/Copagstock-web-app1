import { useState, useEffect, useCallback } from 'react';
import { Material, Order, StockIn, StockOut, OrderItem, ActiveTab, OrderStatus, AppUser, UserRole } from './types';
import { StorageService, isAllowedMsuEmail } from './services/storageService';
import { Header } from './components/Header';
import { LoginPage } from './components/LoginPage';
import { DashboardView } from './components/DashboardView';
import { RequisitionView } from './components/RequisitionView';
import { InventoryView } from './components/InventoryView';
import { StockLedgerView } from './components/StockLedgerView';
import { OrdersListView } from './components/OrdersListView';
import { BatchStockInView } from './components/BatchStockInView';
import { AccountManagementView } from './components/AccountManagementView';
import { OfficialRequisitionModal } from './components/OfficialRequisitionModal';
import { DataManagementModal } from './components/DataManagementModal';
import { Loader2 } from 'lucide-react';
import { auth } from './firebase';
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import { syncCustomCategoriesFromFirestore } from './utils/materialIdGenerator';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const u = StorageService.getCurrentUser();
    if (u) {
      const isSuper = Boolean(u.email && u.email.toLowerCase() === 'kanjanapat.m@msu.ac.th');
      u.role = isSuper ? 'admin' : 'user';
    }
    return u;
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const user = StorageService.getCurrentUser();
    return user && user.email.toLowerCase() === 'kanjanapat.m@msu.ac.th' ? 'dashboard' : 'requisition';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data Stores - initialize immediately with cached materials so UI is never blank
  const [materials, setMaterials] = useState<Material[]>(() => StorageService.getCachedMaterials());
  const [orders, setOrders] = useState<Order[]>([]);
  const [stockInLogs, setStockInLogs] = useState<StockIn[]>([]);
  const [stockOutLogs, setStockOutLogs] = useState<StockOut[]>([]);

  // Requisition Cart
  const [cart, setCart] = useState<OrderItem[]>([]);

  // Active material for Stock Card (Ledger)
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('1ก01');

  // Modals
  const [previewOrder, setPreviewOrder] = useState<Order | null>(null);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);

  // Load all data with auto-recovery safeguard
  const loadData = useCallback(async () => {
    try {
      syncCustomCategoriesFromFirestore().catch(() => {});
      let [mats, ords, inLogs, outLogs] = await Promise.all([
        StorageService.getMaterials(),
        StorageService.getOrders(),
        StorageService.getStockInLogs(),
        StorageService.getStockOutLogs()
      ]);

      // Auto-recovery safeguard: If materials array is somehow empty, force-seed default catalog
      if (!mats || mats.length === 0) {
        mats = await StorageService.seedMaterialsIfEmpty(true);
      }

      // Synchronize all materials with latest stock-in unit price, 3 recent purchases, and exact ledger quantities
      const syncedMats = StorageService.syncMaterialsWithLedger(mats, inLogs, outLogs);

      setMaterials(syncedMats);
      setOrders(ords);
      setStockInLogs(inLogs);
      setStockOutLogs(outLogs);

      setSelectedMaterialId(prev => {
        if (mats.length > 0 && (!prev || !mats.find(m => m.id === prev))) {
          return mats[0].id;
        }
        return prev;
      });
    } catch (e) {
      console.error('Error loading inventory data:', e);
      const fallbackMats = await StorageService.seedMaterialsIfEmpty(true);
      setMaterials(fallbackMats);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
  };

  // Strict Role Navigation Guard:
  // Regular users (non-admin) can ONLY access 'requisition' (คีย์ใบเบิก) and 'orders' (ประวัติใบเบิก)
  useEffect(() => {
    const isSuper = currentUser?.email?.toLowerCase() === 'kanjanapat.m@msu.ac.th';
    if (currentUser && !isSuper && activeTab !== 'requisition' && activeTab !== 'orders') {
      setActiveTab('requisition');
    }
  }, [currentUser, activeTab]);

  // Sync with Firebase auth state (only if active session already exists)
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && fbUser.email) {
        const email = fbUser.email.toLowerCase();
        if (isAllowedMsuEmail(email)) {
          const activeSession = StorageService.getCurrentUser();
          // Only sync if user is already logged in for this session
          if (activeSession && activeSession.email.toLowerCase() === email) {
            const isSuperAdmin = email === 'kanjanapat.m@msu.ac.th';
            const user: AppUser = {
              ...activeSession,
              email: email,
              name: fbUser.displayName || activeSession.name,
              role: isSuperAdmin ? 'admin' : 'user',
              photoUrl: fbUser.photoURL || activeSession.photoUrl,
              uid: fbUser.uid,
              status: 'active',
              lastLoginAt: new Date().toISOString()
            };
            await StorageService.saveOrUpdateUser(user);
            StorageService.setCurrentUser(user);
            setCurrentUser(user);
          }
        } else {
          // Block unauthorized emails
          await fbSignOut(auth);
          await StorageService.signOut();
          setCurrentUser(null);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = (user: AppUser) => {
    const isSuperAdmin = user.email.toLowerCase() === 'kanjanapat.m@msu.ac.th';
    const finalUser: AppUser = {
      ...user,
      role: isSuperAdmin ? 'admin' : 'user',
      position: isSuperAdmin ? 'ผู้ดูแลระบบสารสนเทศพัสดุ (Admin)' : 'อาจารย์/บุคลากร'
    };
    StorageService.setCurrentUser(finalUser);
    setCurrentUser(finalUser);
    if (!isSuperAdmin) {
      setActiveTab('requisition');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = async () => {
    await StorageService.signOut();
    if (auth) {
      try {
        await fbSignOut(auth);
      } catch (err) {
        console.error('Sign out error:', err);
      }
    }
    setCurrentUser(null);
  };

  // Cart helper from Dashboard or Inventory
  const handleAddMaterialToCart = (mat: Material) => {
    if (mat.currentStock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.materialId === mat.id);
      if (existing) {
        if (existing.quantity >= mat.currentStock) return prev;
        return prev.map(item =>
          item.materialId === mat.id
            ? { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * item.unitPrice }
            : item
        );
      }
      return [
        ...prev,
        {
          materialId: mat.id,
          materialName: mat.name,
          category: mat.category,
          unit: mat.unit,
          unitPrice: mat.unitPrice,
          quantity: 1,
          totalPrice: mat.unitPrice,
          currentStockSnapshot: mat.currentStock
        }
      ];
    });
    setActiveTab('requisition');
  };

  // Submit Order
  const handleSubmitOrder = async (order: Order) => {
    await StorageService.createOrder(order);
    await loadData();
  };

  // Update Order Status (Approve / Disburse / Cancel)
  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const result = await StorageService.updateOrderStatus(orderId, status);
    if (result.success) {
      await loadData();
    }
    return result;
  };

  // Edit Order Details & Quantities (ปรับยอดและแก้ไขคำขอ)
  const handleEditOrder = async (orderId: string, payload: any) => {
    const result = await StorageService.editOrder(orderId, payload);
    if (result.success) {
      await loadData();
    }
    return result;
  };

  // Save Material (Add / Edit)
  const handleSaveMaterial = async (material: Material) => {
    // 1. Immediately update React state so the UI reflects the added material instantly
    setMaterials(prev => {
      const idx = prev.findIndex(m => m.id === material.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...material };
        return copy;
      }
      return [...prev, material];
    });

    // 2. Persist to storage & Firestore
    await StorageService.saveMaterial(material);

    // 3. Reload in background to ensure all counters/views stay synchronized
    await loadData();
  };

  // Delete Material
  const handleDeleteMaterial = async (id: string) => {
    await StorageService.deleteMaterial(id);
    await loadData();
  };

  // Update Material Image
  const handleUpdateMaterialImage = async (materialId: string, imageUrl: string) => {
    await StorageService.updateMaterialImage(materialId, imageUrl);
    await loadData();
  };

  // Delete Order (ลบใบเบิกถาวร)
  const handleDeleteOrder = async (orderId: string) => {
    const result = await StorageService.deleteOrder(orderId);
    if (result.success) {
      await loadData();
    }
    return result;
  };

  // Stock In
  const handleAddStockIn = async (entry: StockIn) => {
    await StorageService.addStockIn(entry);
    await loadData();
  };

  // Stock Out
  const handleAddStockOut = async (entry: StockOut) => {
    await StorageService.addStockOut(entry);
    await loadData();
  };

  // Delete Stock In (ลบรายการรับเข้า)
  const handleDeleteStockIn = async (id: string) => {
    const res = await StorageService.deleteStockIn(id);
    if (res.success) {
      await loadData();
    } else {
      alert(res.error || 'ไม่สามารถลบรายการได้');
    }
  };

  // Delete Stock Out (ลบรายการจ่ายออก พร้อมคืนสต็อก)
  const handleDeleteStockOut = async (id: string) => {
    const res = await StorageService.deleteStockOut(id, true);
    if (res.success) {
      await loadData();
    } else {
      alert(res.error || 'ไม่สามารถลบรายการได้');
    }
  };

  // Jump to ledger for a specific material
  const handleSelectMaterialForLedger = (matId: string) => {
    setSelectedMaterialId(matId);
    setActiveTab('ledger');
  };

  const isAdmin = currentUser?.role === 'admin';
  const pendingOrdersCount = isAdmin
    ? orders.filter(o => o.status === 'รออนุมัติ').length
    : orders.filter(o => {
        const userEmail = (currentUser?.email || '').trim().toLowerCase();
        const userName = (currentUser?.name || '').trim().toLowerCase();
        const orderEmail = (o.requesterEmail || '').trim().toLowerCase();
        const orderName = (o.requesterName || '').trim().toLowerCase();
        const isMine = (userEmail && orderEmail && userEmail === orderEmail) ||
                       (userName && orderName && (orderName.includes(userName) || userName.includes(orderName)));
        return isMine && o.status === 'รออนุมัติ';
      }).length;

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      
      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
        pendingOrdersCount={pendingOrdersCount}
        onOpenDataModal={() => setIsDataModalOpen(true)}
        onRefreshData={handleRefresh}
        isRefreshing={isRefreshing}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Content View */}
      <main 
        className="flex-1 w-full max-w-full mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-5" 
        style={{ width: '100%', maxWidth: '100%' }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <p className="text-sm font-medium text-slate-500">กำลังเชื่อมต่อฐานข้อมูลคลังพัสดุ วก.มมส...</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                materials={materials}
                orders={orders}
                stockOutLogs={stockOutLogs}
                setActiveTab={setActiveTab}
                onSelectMaterialForLedger={handleSelectMaterialForLedger}
                onAddMaterialToCart={handleAddMaterialToCart}
              />
            )}

            {activeTab === 'requisition' && (
              <RequisitionView
                materials={materials}
                orders={orders}
                cart={cart}
                setCart={setCart}
                onSubmitOrder={handleSubmitOrder}
                onPreviewOfficialDocument={order => setPreviewOrder(order)}
                currentUser={currentUser}
                onReloadData={loadData}
                stockInLogs={stockInLogs}
                stockOutLogs={stockOutLogs}
                onSelectMaterialForLedger={handleSelectMaterialForLedger}
              />
            )}

            {activeTab === 'inventory' && (
              <InventoryView
                materials={materials}
                onSaveMaterial={handleSaveMaterial}
                onDeleteMaterial={handleDeleteMaterial}
                onSelectMaterialForLedger={handleSelectMaterialForLedger}
                onAddMaterialToCart={handleAddMaterialToCart}
                onReloadData={loadData}
                onUpdateMaterialImage={handleUpdateMaterialImage}
                stockInLogs={stockInLogs}
                stockOutLogs={stockOutLogs}
                orders={orders}
                onPreviewOfficialDocument={order => setPreviewOrder(order)}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'batch_stockin' && (
              <BatchStockInView
                materials={materials}
                stockInLogs={stockInLogs}
                currentUserName={currentUser?.name || 'เจ้าหน้าที่พัสดุ'}
                onAddBatchStockIn={async (docNo, date, supplier, receiverName, note, items, obligationNo, budgetType) => {
                  await StorageService.addBatchStockIn(docNo, date, supplier, receiverName, note, items, obligationNo, budgetType);
                  await loadData();
                }}
                onUpdateStockIn={async (logId, updatedData) => {
                  const res = await StorageService.updateStockIn(logId, updatedData);
                  if (res.success) {
                    await loadData();
                  }
                  return res;
                }}
                onDeleteStockIn={async (logId) => {
                  const res = await StorageService.deleteStockIn(logId);
                  if (res.success) {
                    await loadData();
                  }
                  return res;
                }}
                onNavigateToLedger={(matId) => {
                  if (matId) setSelectedMaterialId(matId);
                  setActiveTab('ledger');
                }}
              />
            )}

            {activeTab === 'ledger' && (
              <StockLedgerView
                materials={materials}
                selectedMaterialId={selectedMaterialId}
                onSelectMaterial={setSelectedMaterialId}
                stockInLogs={stockInLogs}
                stockOutLogs={stockOutLogs}
                onAddStockIn={handleAddStockIn}
                onAddStockOut={handleAddStockOut}
                onDeleteStockIn={handleDeleteStockIn}
                onDeleteStockOut={handleDeleteStockOut}
                isAdmin={currentUser?.role === 'admin'}
              />
            )}

            {activeTab === 'orders' && (
              <OrdersListView
                orders={orders}
                materials={materials}
                onUpdateOrderStatus={handleUpdateOrderStatus}
                onEditOrder={handleEditOrder}
                onDeleteOrder={handleDeleteOrder}
                onPreviewOfficialDocument={order => setPreviewOrder(order)}
                currentUser={currentUser}
              />
            )}

            {activeTab === 'users' && (
              <AccountManagementView
                currentUser={currentUser}
              />
            )}
          </>
        )}
      </main>

      {/* Official Requisition Document Preview Modal */}
      {previewOrder && (
        <OfficialRequisitionModal
          order={previewOrder}
          onClose={() => setPreviewOrder(null)}
          adminName={currentUser?.role === 'admin' ? currentUser.name : 'กาญจนภาษณ์ มาตบุรม'}
          materials={materials}
          isAdmin={currentUser?.role === 'admin'}
        />
      )}

      {/* Data Management / Backup Modal */}
      <DataManagementModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        materials={materials}
        orders={orders}
        stockInLogs={stockInLogs}
        stockOutLogs={stockOutLogs}
        onDataReload={loadData}
      />

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-6 px-4 text-center text-xs mt-12">
        <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 mx-auto flex flex-col sm:flex-row items-center justify-between gap-2" style={{ width: '100%', maxWidth: '100%' }}>
          <div>
            วิทยาลัยการเมืองการปกครอง มหาวิทยาลัยมหาสารคาม (COPAG MSU)
          </div>
          <div className="text-slate-400">
            ระบบสารสนเทศทะเบียนคลังพัสดุและเบิกจ่ายวัสดุ • พัฒนาด้วย Google AI Studio
          </div>
        </div>
      </footer>

    </div>
  );
}
