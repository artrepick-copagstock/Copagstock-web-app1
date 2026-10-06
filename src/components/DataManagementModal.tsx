import { FC, useState, ChangeEvent } from 'react';
import { Material, Order, StockIn, StockOut } from '../types';
import { StorageService } from '../services/storageService';
import { 
  X, 
  Download, 
  Upload, 
  RotateCcw, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  HardDrive,
  Camera,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  CloudUpload,
  Cloud,
  Server
} from 'lucide-react';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  materials: Material[];
  orders: Order[];
  stockInLogs: StockIn[];
  stockOutLogs: StockOut[];
  onDataReload: () => Promise<void>;
}

export const DataManagementModal: FC<DataManagementModalProps> = ({
  isOpen,
  onClose,
  materials,
  orders,
  stockInLogs,
  stockOutLogs,
  onDataReload
}) => {
  const [statusMessage, setStatusMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isReseeding, setIsReseeding] = useState(false);
  const [isBackingUpFirebase, setIsBackingUpFirebase] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  // Backup & sync all system data to Firebase Firestore (project copag)
  const handleBackupToFirebase = async () => {
    try {
      setIsBackingUpFirebase(true);
      setStatusMessage('');
      const res = await StorageService.backupAllDataToFirebase();
      if (res.success) {
        setStatusMessage(`สำรองข้อมูลทั้งหมดไปไว้ที่ Firebase (โปรเจกต์ copag) สำเร็จเรียบร้อย: ${res.materialsCount} รายการพัสดุ, ${res.ordersCount} ใบเบิก, ${res.stockInCount} ประวัติรับเข้า, ${res.stockOutCount} ประวัติจ่ายออก`);
        setIsError(false);
      } else {
        setStatusMessage(res.error || 'ไม่สามารถสำรองข้อมูลขึ้น Firebase ได้');
        setIsError(true);
      }
    } catch (err: any) {
      setStatusMessage('เกิดข้อผิดพลาดในการสำรองขึ้น Firebase: ' + (err?.message || 'โปรดลองอีกครั้ง'));
      setIsError(true);
    } finally {
      setIsBackingUpFirebase(false);
    }
  };

  if (!isOpen) return null;

  // Export full backup JSON
  const handleExportBackup = () => {
    const backupData = {
      app: 'COPAG MSU Material Requisition System',
      exportedAt: new Date().toISOString(),
      materials,
      orders,
      stockInLogs,
      stockOutLogs
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `COPAG_MSU_Inventory_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatusMessage('ส่งออกไฟล์สำรองข้อมูล JSON เรียบร้อยแล้ว');
    setIsError(false);
  };

  // Export Image Backup JSON
  const handleExportImageBackup = async () => {
    try {
      const backup = await StorageService.exportImageBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `COPAG_MSU_Material_Images_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage(`ส่งออกไฟล์สำรองรูปภาพพัสดุสำเร็จ (${backup.materialsWithImages} รูปภาพ)`);
      setIsError(false);
    } catch (err: any) {
      setStatusMessage('ไม่สามารถส่งออกไฟล์สำรองรูปภาพได้: ' + err.message);
      setIsError(true);
    }
  };

  // Import JSON file
  const handleImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.materials && Array.isArray(json.materials)) {
          localStorage.setItem('copag_msu_materials_v2', JSON.stringify(json.materials));
          for (const m of json.materials) {
            await StorageService.saveMaterial(m);
          }
        }
        if (json.orders && Array.isArray(json.orders)) {
          localStorage.setItem('copag_msu_orders_v2', JSON.stringify(json.orders));
        }
        if (json.stockInLogs && Array.isArray(json.stockInLogs)) {
          localStorage.setItem('copag_msu_stock_in_v2', JSON.stringify(json.stockInLogs));
        }
        if (json.stockOutLogs && Array.isArray(json.stockOutLogs)) {
          localStorage.setItem('copag_msu_stock_out_v2', JSON.stringify(json.stockOutLogs));
        }

        await onDataReload();
        setStatusMessage('นำเข้าข้อมูลสำเร็จและทำการอัปเดตระบบเรียบร้อยแล้ว');
        setIsError(false);
      } catch (err: any) {
        setStatusMessage('ไฟล์ไม่ถูกต้องหรือไม่ตรงตามโครงสร้างข้อมูลระบบ: ' + err.message);
        setIsError(true);
      }
    };
    reader.readAsText(file);
  };

  // Reseed only materials catalog
  const handleReseedMaterials = async () => {
    try {
      setIsReseeding(true);
      setStatusMessage('');
      await StorageService.seedMaterialsIfEmpty(true);
      await onDataReload();
      setStatusMessage('กู้คืนรายการพัสดุมาตรฐาน วก.มมส. (Double A, ตราม้า, MAX ฯลฯ) และซิงค์ขึ้น Firebase สำเร็จ');
      setIsError(false);
    } catch (e: any) {
      setStatusMessage('เกิดข้อผิดพลาดในการกู้คืนพัสดุ: ' + (e?.message || 'โปรดลองอีกครั้ง'));
      setIsError(true);
    } finally {
      setIsReseeding(false);
    }
  };

  // Reset to initial demo data (No window.confirm, uses in-app confirmation dialog)
  const handleExecuteResetToDemo = async () => {
    try {
      setIsResetting(true);
      setStatusMessage('');
      await StorageService.resetAllData();
      await onDataReload();
      setStatusMessage('รีเซ็ตข้อมูลสู่ค่าเริ่มต้นของ วก.มมส. สำเร็จเรียบร้อยแล้ว (ล้างประวัติใบเบิกและตั้งต้นสต็อกใหม่)');
      setIsError(false);
      setShowConfirmReset(false);
    } catch (e: any) {
      setStatusMessage('เกิดข้อผิดพลาดในการรีเซ็ตข้อมูล: ' + (e?.message || 'โปรดลองใหม่อีกครั้ง'));
      setIsError(true);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5">
        
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-base text-slate-800 dark:text-white">
              จัดการและสำรองข้อมูลระบบพัสดุ (Data Management)
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMessage && (
          <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            isError ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}>
            {isError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Current Data Stats */}
        <div className="bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
            <HardDrive className="w-4 h-4 text-amber-500" />
            <span>สถานะหน่วยความจำระบบปัจจุบัน:</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-slate-500 dark:text-slate-400 text-[11px]">
            <div>• พัสดุในทะเบียน: <strong className="text-slate-800 dark:text-white">{materials.length} รายการ</strong></div>
            <div>• คำขอใบเบิก: <strong className="text-slate-800 dark:text-white">{orders.length} ฉบับ</strong></div>
            <div>• ประวัติรับเข้า (In): <strong className="text-slate-800 dark:text-white">{stockInLogs.length} รายการ</strong></div>
            <div>• ประวัติจ่ายออก (Out): <strong className="text-slate-800 dark:text-white">{stockOutLogs.length} รายการ</strong></div>
            <div className="col-span-2">• พัสดุที่มีรูปภาพ: <strong className="text-emerald-600 dark:text-emerald-400">{materials.filter(m => m.imageUrl && m.imageUrl.trim()).length} รายการ</strong></div>
          </div>
        </div>

        {/* Management Actions */}
        <div className="space-y-3">
          {/* 1. Firebase Cloud Backup (Project: copag) */}
          <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 hover:border-blue-400 transition flex items-center justify-between gap-3 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <CloudUpload className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                  สำรองและซิงค์ข้อมูลไปไว้ที่ Firebase (โปรเจกต์: copag)
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold border border-emerald-300">
                  Project: copag
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                ซิงค์รายการพัสดุ ({materials.length} รายการ), ใบเบิก ({orders.length} ฉบับ), และประวัติรับเข้า-จ่ายออกทั้งหมด ขึ้นสู่ Cloud Firestore โปรเจกต์ copag
              </p>
            </div>
            <button
              onClick={handleBackupToFirebase}
              disabled={isBackingUpFirebase}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-60"
            >
              {isBackingUpFirebase ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังสำรอง...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>สำรองขึ้น Firebase</span>
                </>
              )}
            </button>
          </div>

          {/* Image Backup Specific */}
          <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-400 transition flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                  สำรองข้อมูลรูปภาพพัสดุเฉพาะ (Material Images Vault Backup)
                </h4>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-bold">
                  ใหม่
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                ส่งออกไฟล์สำรองรูปภาพทั้งหมด ({materials.filter(m => m.imageUrl && m.imageUrl.trim()).length} รูป) เป็น JSON เพื่อเก็บสำรองหรือย้ายเครื่อง
              </p>
            </div>
            <button
              onClick={handleExportImageBackup}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>สำรองรูปภาพ</span>
            </button>
          </div>

          {/* Export */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-400 transition flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                สำรองข้อมูลทั้งหมด (Export Backup JSON)
              </h4>
              <p className="text-[11px] text-slate-500">
                ดาวน์โหลดข้อมูลพัสดุ สต็อก และใบเบิกทั้งหมดเป็นไฟล์ JSON สำหรับสำรอง
              </p>
            </div>
            <button
              onClick={handleExportBackup}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shrink-0 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ดาวน์โหลด</span>
            </button>
          </div>

          {/* Import */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-400 transition flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                กู้คืน / นำเข้าไฟล์ข้อมูล (Import JSON)
              </h4>
              <p className="text-[11px] text-slate-500">
                อัปโหลดไฟล์สำรองข้อมูล JSON เพื่อกู้คืนข้อมูลสู่ระบบ
              </p>
            </div>
            <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold shrink-0 transition flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>เลือกไฟล์</span>
              <input 
                type="file" 
                accept=".json" 
                onChange={handleImportFile}
                className="hidden" 
              />
            </label>
          </div>

          {/* Reseed Materials */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-400 transition flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                กู้คืนและซิงค์รายการพัสดุ (Reseed Materials)
              </h4>
              <p className="text-[11px] text-slate-500">
                โหลดรายการพัสดุมาตรฐาน วก.มมส. (Double A, ตราม้า, MAX ฯลฯ) พร้อมซิงค์ขึ้น Firebase โดยไม่กระทบใบเบิก
              </p>
            </div>
            <button
              type="button"
              onClick={handleReseedMaterials}
              disabled={isReseeding || isResetting}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-semibold shrink-0 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isReseeding ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังกู้คืน...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>กู้คืนพัสดุ</span>
                </>
              )}
            </button>
          </div>

          {/* Reset Demo Data */}
          <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10 hover:border-rose-300 transition space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <span>รีเซ็ตข้อมูลตัวอย่าง (Reset to Initial Demo)</span>
                  <span className="px-1.5 py-0.2 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded text-[10px] font-semibold">ล้างข้อมูล</span>
                </h4>
                <p className="text-[11px] text-slate-500">
                  คืนค่าข้อมูลเป็นพัสดุมาตรฐานของวิทยาลัยการเมืองการปกครอง (ล้างใบเบิกและปรับยอดคงเหลือพัสดุเป็น 0 เพื่อเริ่มนับจริง)
                </p>
              </div>
              {!showConfirmReset && (
                <button
                  type="button"
                  onClick={() => setShowConfirmReset(true)}
                  disabled={isResetting || isReseeding}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold shrink-0 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>รีเซ็ต</span>
                </button>
              )}
            </div>

            {/* In-app Confirmation Dialog Panel */}
            {showConfirmReset && (
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-rose-300 dark:border-rose-700 shadow-sm space-y-2.5">
                <div className="flex items-start gap-2 text-rose-700 dark:text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <span className="font-bold block text-rose-800 dark:text-rose-200">ยืนยันการรีเซ็ตข้อมูลทั้งหมดกลับสู่ค่าเริ่มต้น?</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">
                      คำขอเบิกพัสดุทั้งหมดและประวัติรับเข้า-ตัดจ่ายจะถูกลบออก ยอดคงเหลือพัสดุทุกรายการจะถูกปรับเป็น 0 ชิ้นเพื่อเริ่มนับสต็อกจริงใหม่
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-rose-100 dark:border-rose-900/40">
                  <button
                    type="button"
                    disabled={isResetting}
                    onClick={() => setShowConfirmReset(false)}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    disabled={isResetting}
                    onClick={handleExecuteResetToDemo}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isResetting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>กำลังรีเซ็ต...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>ยืนยันรีเซ็ตข้อมูล</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs rounded-xl hover:bg-slate-200 transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
