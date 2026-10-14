import { FC, useState, ChangeEvent } from 'react';
import { Material, Order, StockIn, StockOut } from '../types';
import { StorageService } from '../services/storageService';
import { GoogleSheetsService, SPREADSHEET_TITLE } from '../services/googleSheetsService';
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
  Server,
  FileSpreadsheet,
  ExternalLink,
  FileDown,
  FileUp
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

  // Google Sheets state
  const [isBackingUpGoogleSheet, setIsBackingUpGoogleSheet] = useState(false);
  const [isImportingGoogleSheet, setIsImportingGoogleSheet] = useState(false);
  const [googleSpreadsheetUrl, setGoogleSpreadsheetUrl] = useState<string>('');
  const [customSheetInput, setCustomSheetInput] = useState<string>('');
  const [showConfirmGoogleImport, setShowConfirmGoogleImport] = useState(false);

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

  // Backup to Google Sheet (ระบบสารสนเทศเบิกจ่ายพัสดุ วิทยาลัยการเมืองการปกครอง)
  const handleBackupToGoogleSheet = async () => {
    try {
      setIsBackingUpGoogleSheet(true);
      setStatusMessage('');
      const res = await GoogleSheetsService.backupToGoogleSheet(
        materials,
        orders,
        stockInLogs,
        stockOutLogs,
        true
      );
      if (res.success) {
        setGoogleSpreadsheetUrl(res.spreadsheetUrl);
        setStatusMessage(`สำรองข้อมูลทั้งหมดขึ้น Google Sheet "${SPREADSHEET_TITLE}" สำเร็จเรียบร้อย (${res.stats.materialsCount} รายการพัสดุ, ${res.stats.ordersCount} ใบเบิก, ${res.stats.stockInCount} รับเข้า, ${res.stats.stockOutCount} จ่ายออก)`);
        setIsError(false);
      }
    } catch (err: any) {
      console.warn('Google Sheet Backup note:', err);
      if (err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed-by-user') || err?.message?.includes('หน้าต่างยืนยันตัวตน')) {
        setStatusMessage('หน้าต่างเลือกบัญชี Google ถูกปิดก่อนทำรายการเสร็จสิ้น กรุณากดปุ่มสำรองข้อมูลอีกครั้งและเลือกบัญชี Google เพื่ออนุญาตสิทธิ์');
      } else {
        setStatusMessage('เกิดข้อผิดพลาดในการสำรองขึ้น Google Sheet: ' + (err?.message || 'โปรดลองอีกครั้ง'));
      }
      setIsError(true);
    } finally {
      setIsBackingUpGoogleSheet(false);
    }
  };

  // Import from Google Sheet (ระบบสารสนเทศเบิกจ่ายพัสดุ วิทยาลัยการเมืองการปกครอง)
  const handleExecuteGoogleImport = async () => {
    try {
      setIsImportingGoogleSheet(true);
      setStatusMessage('');
      const res = await GoogleSheetsService.importFromGoogleSheet(
        customSheetInput.trim() || undefined,
        true
      );
      if (res.materials.length > 0) {
        localStorage.setItem('copag_msu_materials_v2', JSON.stringify(res.materials));
        for (const m of res.materials) {
          await StorageService.saveMaterial(m);
        }
        if (res.orders && res.orders.length > 0) {
          localStorage.setItem('copag_msu_orders_v2', JSON.stringify(res.orders));
        }
        if (res.stockInLogs.length > 0) {
          localStorage.setItem('copag_msu_stock_in_v2', JSON.stringify(res.stockInLogs));
        }
        if (res.stockOutLogs.length > 0) {
          localStorage.setItem('copag_msu_stock_out_v2', JSON.stringify(res.stockOutLogs));
        }
        await onDataReload();
        setGoogleSpreadsheetUrl(res.spreadsheetUrl);
        const orderText = res.orders && res.orders.length > 0 ? `, ${res.orders.length} ใบเบิก` : '';
        setStatusMessage(`นำเข้าข้อมูลจาก Google Sheet "${SPREADSHEET_TITLE}" สำเร็จเรียบร้อย (${res.materials.length} รายการพัสดุ${orderText}) ระบบได้ปรับปรุงสต็อกและซิงค์ข้อมูลให้ทันที`);
        setIsError(false);
      }
    } catch (err: any) {
      console.warn('Google Sheet Import note:', err);
      if (err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed-by-user') || err?.message?.includes('หน้าต่างยืนยันตัวตน')) {
        setStatusMessage('หน้าต่างเลือกบัญชี Google ถูกปิดก่อนทำรายการเสร็จสิ้น กรุณากดปุ่มนำเข้าข้อมูลอีกครั้งและเลือกบัญชี Google เพื่ออนุญาตสิทธิ์');
      } else {
        setStatusMessage('เกิดข้อผิดพลาดในการนำเข้าจาก Google Sheet: ' + (err?.message || 'โปรดตรวจสอบสิทธิ์หรือชื่อสเปรดชีต'));
      }
      setIsError(true);
    } finally {
      setIsImportingGoogleSheet(false);
      setShowConfirmGoogleImport(false);
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto animate-fadeIn">
        
        {/* Header - Fixed & Pinned at top */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0 bg-white dark:bg-slate-800 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white leading-tight">
                จัดการและสำรองข้อมูลระบบพัสดุ (Data Management)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                ระบบจัดการฐานข้อมูล สำรอง และกู้คืนข้อมูล
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 scrollbar-thin">

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

          {/* 2. Google Sheets Backup & Import (ระบบสารสนเทศเบิกจ่ายพัสดุ วิทยาลัยการเมืองการปกครอง) */}
          <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/30 hover:border-emerald-500 transition space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-5 h-5 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                    Google Sheets: {SPREADSHEET_TITLE}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 font-extrabold border border-emerald-300">
                    Google Drive
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  สำรองและนำเข้าข้อมูลพัสดุ สต็อกคงเหลือ ใบเบิก และประวัติรับเข้า-จ่ายออก ผ่าน Google Sheets (แยก 4 ชีตอัตโนมัติ)
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleBackupToGoogleSheet}
                  disabled={isBackingUpGoogleSheet || isImportingGoogleSheet}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                  title="สำรองข้อมูลระบบทั้งหมดลงใน Google Sheet 'ระบบสารสนเทศเบิกจ่ายพัสดุ วิทยาลัยการเมืองการปกครอง'"
                >
                  {isBackingUpGoogleSheet ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังส่งออก...</span>
                    </>
                  ) : (
                    <>
                      <FileUp className="w-3.5 h-3.5" />
                      <span>สำรองขึ้น Google Sheet</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfirmGoogleImport(true)}
                  disabled={isBackingUpGoogleSheet || isImportingGoogleSheet}
                  className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                  title="นำเข้าข้อมูลจาก Google Sheet กลับเข้าสู่ระบบ"
                >
                  {isImportingGoogleSheet ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>กำลังนำเข้า...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-3.5 h-3.5" />
                      <span>นำเข้าจาก Google Sheet</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Link to opened/backed up Google Sheet */}
            {googleSpreadsheetUrl && (
              <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between text-xs">
                <span className="text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  สเปรดชีตพร้อมใช้งาน:
                </span>
                <a
                  href={googleSpreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 hover:underline bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-emerald-300 text-[11px]"
                >
                  <span>เปิดดูใน Google Sheets</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {/* In-app Confirmation Dialog for Google Import */}
            {showConfirmGoogleImport && (
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-amber-300 dark:border-amber-700 shadow-sm space-y-2.5 animate-fadeIn">
                <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div className="space-y-1 w-full">
                    <span className="font-bold block text-xs sm:text-sm text-slate-800 dark:text-white">
                      ยืนยันการนำเข้าข้อมูลจาก Google Sheet?
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      ระบบจะอ่านข้อมูลจากสเปรดชีต <strong>"{SPREADSHEET_TITLE}"</strong> ใน Google Drive ของคุณ และนำมาปรับปรุงรายการพัสดุ ยอดคงเหลือ และประวัติในระบบ
                    </p>
                    <div className="pt-1">
                      <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                        ระบุ URL หรือ ID ของสเปรดชีต (เว้นว่างไว้เพื่อค้นหาชื่อเริ่มต้นอัตโนมัติ):
                      </label>
                      <input
                        type="text"
                        placeholder="https://docs.google.com/spreadsheets/d/... (หรือปล่อยว่าง)"
                        value={customSheetInput}
                        onChange={e => setCustomSheetInput(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    disabled={isImportingGoogleSheet}
                    onClick={() => setShowConfirmGoogleImport(false)}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    disabled={isImportingGoogleSheet}
                    onClick={handleExecuteGoogleImport}
                    className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isImportingGoogleSheet ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>กำลังนำเข้า...</span>
                      </>
                    ) : (
                      <>
                        <FileDown className="w-3.5 h-3.5" />
                        <span>ยืนยันเริ่มนำเข้า</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
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
      </div>

        {/* Footer - Pinned at bottom */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 shrink-0 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
            ข้อมูลจัดเก็บในระบบ Local Storage และเชื่อมโยงกับ Cloud
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl transition cursor-pointer ml-auto"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
};
