import { FC, useState } from 'react';
import { Material, Order, StockOut, ActiveTab } from '../types';
import { TopDisbursedAnalytics } from './TopDisbursedAnalytics';
import { 
  Package, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  PlusCircle,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';

interface DashboardViewProps {
  materials: Material[];
  orders: Order[];
  stockOutLogs?: StockOut[];
  setActiveTab: (tab: ActiveTab) => void;
  onSelectMaterialForLedger: (materialId: string) => void;
  onAddMaterialToCart: (material: Material) => void;
}

export const DashboardView: FC<DashboardViewProps> = ({
  materials,
  orders,
  stockOutLogs = [],
  setActiveTab,
  onSelectMaterialForLedger,
  onAddMaterialToCart
}) => {
  const [showAiAdvisor, setShowAiAdvisor] = useState(false);

  // Calculations
  const totalItemsCount = materials.length;
  const totalValuation = materials.reduce((sum, m) => sum + (m.currentStock * m.unitPrice), 0);
  const outOfStockItems = materials.filter(m => m.currentStock <= 0);
  const lowStockItems = materials.filter(m => m.currentStock > 0 && m.currentStock <= m.minQty);
  const criticalItems = [...outOfStockItems, ...lowStockItems];
  
  const pendingOrders = orders.filter(o => o.status === 'รออนุมัติ');
  const approvedOrders = orders.filter(o => o.status === 'อนุมัติแล้ว');
  const disbursedOrders = orders.filter(o => o.status === 'เบิกจ่ายแล้ว');

  // Category summary
  const deprecatedCategories = new Set<string>(['ผลิตภัณฑ์ทำความสะอาด', 'แฟ้มและอุปกรณ์จัดเก็บ', 'เครื่องเขียน', 'กระดาษและสิ่งพิมพ์']);
  const categories = Array.from(new Set<string>(materials.map(m => m.category))).filter((c: string) => c && !deprecatedCategories.has(c));
  const categoryStats = categories.map(cat => {
    const catMaterials = materials.filter(m => m.category === cat);
    const value = catMaterials.reduce((sum, m) => sum + (m.currentStock * m.unitPrice), 0);
    const count = catMaterials.length;
    return { name: cat, count, value };
  }).sort((a, b) => b.value - a.value);

  // AI Advice generation based on real data
  const generateAiInsights = () => {
    const insights = [];
    if (outOfStockItems.length > 0) {
      insights.push(`พบวัสดุหมดสต็อกจำนวน ${outOfStockItems.length} รายการ ได้แก่ ${outOfStockItems.map(m => m.name).slice(0, 3).join(', ')} แนะนำให้ออกใบสั่งซื้อฉุกเฉิน`);
    }
    if (lowStockItems.length > 0) {
      insights.push(`มีวัสดุใกล้หมดขั้นต่ำ (Safety Stock) ${lowStockItems.length} รายการ ควรทยอยจัดสรรงบประมาณไตรมาสถัดไป`);
    }
    const paper = materials.find(m => m.name.includes('A4'));
    if (paper) {
      const avg = paper.monthlyAverage || 12;
      const stock = paper.currentStock || 0;
      const monthsLeft = avg > 0 ? (stock / avg).toFixed(1) : '0';
      insights.push(`วัสดุกระดาษ A4 มีอัตราการใช้เฉลี่ยเดือนละ ${avg} ${paper.unit} ปัจจุบันคงเหลือ ${stock} ${paper.unit} พอใช้ได้อีกประมาณ ${monthsLeft} เดือน`);
    }
    if (categoryStats.length > 0 && categoryStats[0]) {
      insights.push(`หมวดหมู่วัสดุที่มีมูลค่าคงคลังสูงสุดคือ "${categoryStats[0].name}" มูลค่ารวม ${(categoryStats[0].value || 0).toLocaleString()} บาท`);
    } else {
      insights.push('ระบบพร้อมบันทึกรายการวัสดุและคำนวณมูลค่าคงคลัง');
    }
    return insights;
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 rounded-2xl p-5 sm:p-6 text-white shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-amber-400 font-semibold text-sm">ยินดีต้อนรับสู่แดชบอร์ดบริหารพัสดุ</span>
            <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded-full border border-amber-500/30">
              วิทยาลัยการเมืองการปกครอง
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            ภาพรวมสถานะคลังวัสดุและคำขอเบิกจ่าย
          </h2>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            ติดตามสต็อกคงเหลือ บัญชีคุมพัสดุ อนุมัติใบเบิก และพิมพ์เอกสารแบบฟอร์มราชการตามระเบียบพัสดุ มหาวิทยาลัยมหาสารคาม
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            id="start-requisition-banner-btn"
            onClick={() => setActiveTab('requisition')}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-sm rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>สร้างใบเบิกใหม่</span>
          </button>
          
          <button
            id="toggle-ai-advisor-btn"
            onClick={() => setShowAiAdvisor(!showAiAdvisor)}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-medium text-sm rounded-xl border border-slate-700 transition flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>AI พยากรณ์สต็อก</span>
          </button>
        </div>
      </div>

      {/* AI Advisor Panel (Collapsible) */}
      {showAiAdvisor && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-5 text-slate-800 dark:text-amber-100 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-base text-amber-900 dark:text-amber-200">
                  AI ระบบวิเคราะห์และวางแผนเติมสต็อกอัจฉริยะ (COPAG Inventory AI Advisor)
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  วิเคราะห์จากรอบการเบิกจ่าย ประวัติการใช้งาน และระดับความปลอดภัย (Safety Stock Limits)
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAiAdvisor(false)}
              className="text-xs text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
            >
              ปิด
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            {generateAiInsights().map((insight, idx) => (
              <div key={idx} className="bg-white/80 dark:bg-slate-900/60 rounded-xl p-3 border border-amber-200/60 dark:border-amber-900/40 text-xs leading-relaxed flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 font-bold text-[11px] mt-0.5">
                  {idx + 1}
                </span>
                <span className="text-slate-700 dark:text-slate-200">{insight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4 Main Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total SKUs */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              รายการวัสดุทั้งหมด
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white">
              {totalItemsCount} <span className="text-sm font-normal text-slate-500">รายการ</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              ครอบคลุม {categories.length} หมวดหมู่พัสดุ
            </p>
          </div>
          <button
            onClick={() => setActiveTab('inventory')}
            className="mt-4 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>ดูทะเบียนพัสดุ</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 2: Total Valuation */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              มูลค่าคงคลังรวม
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white">
              ฿{(totalValuation || 0).toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              คำนวณจากราคาจัดซื้อล่าสุด
            </p>
          </div>
          <div className="mt-4 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>ตรวจสอบยอดสมดุล</span>
          </div>
        </div>

        {/* Card 3: Critical Stock */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              ต้องสั่งเติมด่วน
            </span>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              criticalItems.length > 0 
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400' 
                : 'bg-emerald-50 text-emerald-600'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white">
              {criticalItems.length} <span className="text-sm font-normal text-slate-500">รายการ</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {outOfStockItems.length} รายการหมด / {lowStockItems.length} รายการใกล้หมด
            </p>
          </div>
          <button
            onClick={() => setActiveTab('inventory')}
            className="mt-4 text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>ตรวจสอบรายการวิกฤต</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 4: Orders in Pipeline */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              ใบเบิกรอดำเนินการ
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white">
              {pendingOrders.length} <span className="text-sm font-normal text-slate-500">รออนุมัติ</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              พร้อมเบิกจ่าย {approvedOrders.length} ฉบับ / สำเร็จแล้ว {disbursedOrders.length} ฉบับ
            </p>
          </div>
          <button
            onClick={() => setActiveTab('orders')}
            className="mt-4 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>เปิดรายการใบเบิก</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* Top 10 Disbursed Materials Analytics (Top Disbursed by Fiscal Year / Month / Custom Period) */}
      <TopDisbursedAnalytics
        materials={materials}
        orders={orders}
        stockOutLogs={stockOutLogs}
        onSelectMaterialForLedger={onSelectMaterialForLedger}
        onAddMaterialToCart={onAddMaterialToCart}
        onNavigateToRequisition={() => setActiveTab('requisition')}
      />

      {/* Two Column Layout: Critical Low Stock Items & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Low Stock Alert Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-base text-slate-800 dark:text-white">
                พัสดุที่ต้องจัดซื้อเติมคลัง (ต่ำกว่าจุดปลอดภัย)
              </h3>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              พบ {criticalItems.length} รายการ
            </span>
          </div>

          {criticalItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-2 opacity-80" />
              <p className="font-medium text-slate-700 dark:text-slate-300">พัสดุทุกรายการอยู่ในเกณฑ์ปกติ</p>
              <p className="text-xs text-slate-400">สต็อกคงเหลือเกินจุดสั่งซื้อขั้นต่ำทั้งหมด</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <th className="pb-3 px-2">รหัส</th>
                    <th className="pb-3 px-2">ชื่อวัสดุ</th>
                    <th className="pb-3 px-2">หมวดหมู่</th>
                    <th className="pb-3 px-2 text-center">คงเหลือ</th>
                    <th className="pb-3 px-2 text-center">จุดเตือน (Min)</th>
                    <th className="pb-3 px-2 text-center">สถานะ</th>
                    <th className="pb-3 px-2 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {criticalItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-750 transition">
                      <td className="py-3 px-2 font-mono font-medium text-xs text-amber-600 dark:text-amber-400">
                        {item.id}
                      </td>
                      <td className="py-3 px-2 font-medium text-slate-800 dark:text-slate-200">
                        {item.name}
                      </td>
                      <td className="py-3 px-2 text-xs text-slate-500 dark:text-slate-400">
                        {item.category}
                      </td>
                      <td className="py-3 px-2 text-center font-bold text-slate-900 dark:text-white">
                        <span className={item.currentStock === 0 ? 'text-rose-600' : 'text-amber-600'}>
                          {item.currentStock}
                        </span>{' '}
                        <span className="text-xs font-normal text-slate-400">{item.unit}</span>
                      </td>
                      <td className="py-3 px-2 text-center text-xs text-slate-500">
                        {item.minQty} {item.unit}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          item.currentStock === 0
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {item.refillStatus}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onSelectMaterialForLedger(item.id)}
                            title="เปิดสมุดคุมบัญชีพัสดุ"
                            className="p-1.5 text-xs text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </button>
                          {item.currentStock > 0 && (
                            <button
                              onClick={() => onAddMaterialToCart(item)}
                              title="เพิ่มเข้าใบเบิก"
                              className="px-2 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-medium rounded-lg transition cursor-pointer"
                            >
                              เบิก
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 1 Col: Category Inventory Breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-800 dark:text-white">
              สัดส่วนมูลค่าตามหมวดหมู่
            </h3>
            <span className="text-xs text-slate-400">ภาพรวม</span>
          </div>

          <div className="space-y-3">
            {categoryStats.map(cat => {
              const percentage = totalValuation > 0 ? (cat.value / totalValuation) * 100 : 0;
              return (
                <div key={cat.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-700 dark:text-slate-200 truncate pr-2">
                      {cat.name} ({cat.count})
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 shrink-0 font-mono">
                      ฿{(cat.value || 0).toLocaleString()} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.max(percentage, 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-700/80">
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
              <div className="font-semibold text-slate-800 dark:text-white">
                ระเบียบงานพัสดุ มหาวิทยาลัยมหาสารคาม:
              </div>
              <p className="leading-relaxed text-[11px] text-slate-500 dark:text-slate-400">
                การเบิกวัสดุต้องได้รับความเห็นชอบจากหัวหน้าหน่วยงานหรือคณบดี และตรวจสอบยอดคงเหลือก่อนการตัดจ่ายทุกครั้ง
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Recent Orders Overview */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base text-slate-800 dark:text-white">
              คำขอเบิกจ่ายพัสดุล่าสุด
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              รายการเอกสารใบเบิกวัสดุของอาจารย์และบุคลากรภายในวิทยาลัย
            </p>
          </div>
          <button
            onClick={() => setActiveTab('orders')}
            className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>ดูคำขอทั้งหมด ({orders.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {orders.slice(0, 3).map(order => (
            <div 
              key={order.id} 
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 hover:border-amber-400 transition space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                  {order.docNo}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  order.status === 'เบิกจ่ายแล้ว' 
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : order.status === 'อนุมัติแล้ว'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                }`}>
                  {order.status}
                </span>
              </div>

              <div>
                <div className="font-semibold text-sm text-slate-800 dark:text-white truncate">
                  {order.requesterName}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {order.department}
                </div>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 italic bg-white dark:bg-slate-800 p-1.5 rounded border border-slate-100 dark:border-slate-700">
                "{order.purpose}"
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-400">{order.date}</span>
                <span className="font-bold text-slate-800 dark:text-white">
                  {order.totalItems} ชิ้น (฿{(order.totalAmount || 0).toLocaleString()})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
