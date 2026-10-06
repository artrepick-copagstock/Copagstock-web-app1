import { FC, useRef, useState, useMemo, useEffect } from 'react';
import { Order, Material, AppUser } from '../types';
import { X, Printer, Download, Building2, Loader2, CheckCircle2, AlertCircle, Layers, Edit3, UserCheck, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import { toCanvas } from 'html-to-image';
import { RequisitionSignerModal, RequisitionSigners } from './RequisitionSignerModal';
import { StorageService } from '../services/storageService';
import { exportSingleRequisitionToExcel } from '../utils/excelExport';

interface OfficialRequisitionModalProps {
  order: Order | null;
  onClose: () => void;
  adminName?: string;
  materials?: Material[];
  isAdmin?: boolean;
}

interface RequisitionItemWithIndex {
  item: Order['items'][0];
  globalIndex: number;
}

interface RequisitionPage {
  pageNumber: number;
  totalPages: number;
  items: RequisitionItemWithIndex[];
  isFirstPage: boolean;
  isLastPage: boolean;
  broughtForwardAmount?: number;
  carriedForwardAmount?: number;
}

export const OfficialRequisitionModal: FC<OfficialRequisitionModalProps> = ({
  order,
  onClose,
  adminName,
  materials,
  isAdmin = false
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'warning' } | null>(null);
  const [forceMultiPage, setForceMultiPage] = useState(false);

  // Clean admin name (strip parentheses and "วก.มมส.")
  const cleanAdminName = (rawName?: string) => {
    if (!rawName) return '';
    return rawName
      .replace(/\s*\(?วก\.?\s*มมส\.?\)?/gi, '')
      .replace(/\s*\([^)]*\)/g, '')
      .trim();
  };

  const effectiveAdminName = cleanAdminName(adminName) || 
    cleanAdminName(order?.disburserName) || 
    'เจ้าหน้าที่พัสดุ';

  // Extract unique material categories from order items
  const getItemCategory = (item: any) => {
    if (item.category && item.category.trim()) return item.category.trim();
    const matched = materials?.find(m => m.id === item.materialId || m.name === item.materialName);
    return matched?.category?.trim() || 'วัสดุสำนักงาน';
  };

  const itemCategories = useMemo(() => {
    if (!order) return [];
    return Array.from(
      new Set(order.items.map(item => getItemCategory(item)).filter(Boolean))
    );
  }, [order, materials]);

  const categoriesText = itemCategories.length > 0 ? itemCategories.join(', ') : 'วัสดุสำนักงาน';

  // Convert date format to Thai format (เช่น 15 กันยายน 2568)
  const formatThaiDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const monthsThai = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
      const day = d.getDate();
      const month = monthsThai[d.getMonth()];
      const year = d.getFullYear() + 543;
      return `${day} ${month} พ.ศ. ${year}`;
    } catch {
      return dateStr;
    }
  };

  // Signer management states
  const [isSignerModalOpen, setIsSignerModalOpen] = useState(false);
  const [focusRole, setFocusRole] = useState<'requester' | 'officer' | 'head' | 'ledger' | 'disburser' | null>(null);
  const [systemUsers, setSystemUsers] = useState<AppUser[]>([]);

  // Load system accounts for quick selection
  useEffect(() => {
    StorageService.getUsers().then(users => {
      if (users && users.length > 0) {
        setSystemUsers(users);
      }
    }).catch(err => console.warn('Could not load users for requisition signer picker:', err));
  }, []);

  // Initialize signers with order defaults or saved supply settings
  const [signers, setSigners] = useState<RequisitionSigners>(() => {
    let savedSupply: Partial<RequisitionSigners> = {};
    try {
      const saved = localStorage.getItem('requisition_signers_settings');
      if (saved) {
        savedSupply = JSON.parse(saved) || {};
      }
    } catch {}

    const reqName = order?.requesterName || 'อาจารย์ / บุคลากร';
    const reqPos = order?.requesterPosition || 'อาจารย์/บุคลากร';
    const reqDept = order?.department || 'วิทยาลัยการเมืองการปกครอง';
    const reqDate = order?.date ? formatThaiDate(order.date) : 'วันที่ ......../......../............';

    return {
      requesterName: reqName,
      requesterPosition: reqPos,
      requesterDepartment: reqDept,
      requesterDate: `วันที่ ${reqDate}`,
      officerName: savedSupply.officerName || effectiveAdminName,
      officerPosition: savedSupply.officerPosition || 'เจ้าหน้าที่พัสดุ',
      officerDate: savedSupply.officerDate || 'วันที่ ......../......../............',
      headName: savedSupply.headName || '........................................................',
      headPosition: savedSupply.headPosition || 'หัวหน้าเจ้าหน้าที่พัสดุ',
      headDate: savedSupply.headDate || 'วันที่ ......../......../............',
      ledgerOfficerName: savedSupply.ledgerOfficerName || effectiveAdminName,
      ledgerOfficerPosition: savedSupply.ledgerOfficerPosition || 'ผู้ตัดบัญชีพัสดุ',
      ledgerOfficerDate: savedSupply.ledgerOfficerDate || 'วันที่ ......../......../............',
      disburserName: savedSupply.disburserName || order?.disburserName || effectiveAdminName,
      disburserPosition: savedSupply.disburserPosition || 'ผู้จ่ายของ',
      disburserDate: savedSupply.disburserDate || (order?.disbursedDate ? `จ่ายแล้วเมื่อ ${formatThaiDate(order.disbursedDate)}` : 'วันที่ ......../......../............')
    };
  });

  // Re-sync when order changes
  useEffect(() => {
    if (order) {
      setSigners(prev => ({
        ...prev,
        requesterName: order.requesterName || prev.requesterName,
        requesterPosition: order.requesterPosition || prev.requesterPosition,
        requesterDepartment: order.department || prev.requesterDepartment,
        requesterDate: order.date ? `วันที่ ${formatThaiDate(order.date)}` : prev.requesterDate
      }));
    }
  }, [order?.id, order?.docNo]);

  const handleSaveSigners = (newSigners: RequisitionSigners, saveAsDefault: boolean) => {
    setSigners(newSigners);
    if (saveAsDefault) {
      try {
        const supplyDataToSave = {
          officerName: newSigners.officerName,
          officerPosition: newSigners.officerPosition,
          officerDate: newSigners.officerDate,
          headName: newSigners.headName,
          headPosition: newSigners.headPosition,
          headDate: newSigners.headDate,
          ledgerOfficerName: newSigners.ledgerOfficerName,
          ledgerOfficerPosition: newSigners.ledgerOfficerPosition,
          ledgerOfficerDate: newSigners.ledgerOfficerDate,
          disburserName: newSigners.disburserName,
          disburserPosition: newSigners.disburserPosition,
          disburserDate: newSigners.disburserDate
        };
        localStorage.setItem('requisition_signers_settings', JSON.stringify(supplyDataToSave));
      } catch {}
    }
  };

  const handleOpenSignerModal = (role?: 'requester' | 'officer' | 'head' | 'ledger' | 'disburser') => {
    if (!isAdmin) return;
    setFocusRole(role || null);
    setIsSignerModalOpen(true);
  };

  const cleanSignerDisplay = (nameStr: string) => {
    if (!nameStr) return '........................................................';
    const trimmed = nameStr.trim();
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      return trimmed.slice(1, -1).trim();
    }
    return trimmed;
  };

  // Smart Pagination: If items exceed 6 on Page 1, split to Page 2+
  const pages: RequisitionPage[] = useMemo(() => {
    if (!order || !order.items || order.items.length === 0) return [];

    const allItems: RequisitionItemWithIndex[] = order.items.map((item, idx) => ({
      item,
      globalIndex: idx + 1
    }));

    // If 6 or fewer items and not simulated forceMultiPage, everything fits on 1 page
    if (allItems.length <= 6 && !forceMultiPage) {
      return [{
        pageNumber: 1,
        totalPages: 1,
        items: allItems,
        isFirstPage: true,
        isLastPage: true
      }];
    }

    // Determine items on Page 1 (header + requester block takes ~110mm)
    let p1Count = 6;
    if (forceMultiPage && allItems.length <= 6) {
      p1Count = Math.max(1, Math.ceil(allItems.length / 2));
    } else if (allItems.length - p1Count < 1) {
      p1Count = Math.max(3, allItems.length - 1);
    }

    const p1Items = allItems.slice(0, p1Count);
    const p1Subtotal = p1Items.reduce((sum, x) => sum + (x.item.totalPrice || 0), 0);

    let remaining = allItems.slice(p1Count);
    const subPages: RequisitionItemWithIndex[][] = [];

    while (remaining.length > 0) {
      // Last page with signatures can hold up to 8 items
      if (remaining.length <= 8) {
        subPages.push(remaining);
        break;
      }
      // Intermediate pages without signatures can hold up to 10 items
      const count = Math.min(10, remaining.length - 2);
      subPages.push(remaining.slice(0, count));
      remaining = remaining.slice(count);
    }

    const totalPages = 1 + subPages.length;

    const resultPages: RequisitionPage[] = [
      {
        pageNumber: 1,
        totalPages,
        items: p1Items,
        isFirstPage: true,
        isLastPage: totalPages === 1,
        carriedForwardAmount: p1Subtotal
      }
    ];

    let runningSubtotal = p1Subtotal;
    subPages.forEach((pItems, idx) => {
      const pageNum = idx + 2;
      const isLast = pageNum === totalPages;
      const pageSum = pItems.reduce((sum, x) => sum + (x.item.totalPrice || 0), 0);
      const prevSubtotal = runningSubtotal;
      runningSubtotal += pageSum;

      resultPages.push({
        pageNumber: pageNum,
        totalPages,
        items: pItems,
        isFirstPage: false,
        isLastPage: isLast,
        broughtForwardAmount: prevSubtotal,
        carriedForwardAmount: isLast ? undefined : runningSubtotal
      });
    });

    return resultPages;
  }, [order, forceMultiPage]);

  if (!order) return null;

  // Thai font CSS configuration for razor-sharp TH Sarabun New output
  const thaiFontCss = `
    @font-face {
      font-family: 'TH Sarabun New';
      font-style: normal;
      font-weight: 400;
      src: local('TH Sarabun New'), local('THSarabunNew'), url('https://fonts.gstatic.com/s/sarabun/v17/DtVjJx26TKEr37c9WBI.ttf') format('truetype');
    }
    @font-face {
      font-family: 'TH Sarabun New';
      font-style: normal;
      font-weight: 700;
      src: local('TH Sarabun New Bold'), local('THSarabunNew-Bold'), url('https://fonts.gstatic.com/s/sarabun/v17/DtVmJx26TKEr37c9YK5sulw.ttf') format('truetype');
    }
    @font-face {
      font-family: 'TH Sarabun New';
      font-style: normal;
      font-weight: 800;
      src: local('TH Sarabun New Bold'), local('THSarabunNew-Bold'), url('https://fonts.gstatic.com/s/sarabun/v17/DtVmJx26TKEr37c9YLJvulw.ttf') format('truetype');
    }
    .requisition-a4-page,
    .requisition-a4-page * {
      font-family: 'TH Sarabun New', 'THSarabunNew', 'Sarabun', 'TH Sarabun PSK', sans-serif !important;
      color: #000000 !important;
      border-color: #000000 !important;
    }
    .no-print {
      display: none !important;
    }
    .signer-box-interactive {
      border: none !important;
      background: transparent !important;
      background-color: transparent !important;
      padding: 0 !important;
      box-shadow: none !important;
    }
    .signer-inline-interactive,
    .print-clean-highlight {
      background: transparent !important;
      background-color: transparent !important;
      border: none !important;
      padding: 0 !important;
    }
  `;

  // Generate high-resolution multi-page PDF in A4 portrait (210mm x 297mm)
  const generatePdf = async (shouldDownload = true): Promise<jsPDF | null> => {
    const container = printRef.current;
    if (!container || !order) return null;

    const pageElements = container.querySelectorAll<HTMLElement>('.requisition-a4-page');
    if (!pageElements || pageElements.length === 0) return null;

    try {
      setIsProcessing(true);
      setStatusMessage({ 
        text: `กำลังจัดหน้าเอกสาร A4 ฟอนต์ TH Sarabun New ทั้งหมด (${pageElements.length} หน้า)...`, 
        type: 'info' 
      });

      // Wait for fonts to be ready
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];
        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }

        setStatusMessage({ 
          text: `กำลังสร้าง PDF หน้า ${i + 1} จาก ${pageElements.length} ด้วยฟอนต์ TH Sarabun New...`, 
          type: 'info' 
        });

        let canvas: HTMLCanvasElement;
        try {
          canvas = await toCanvas(pageEl, {
            pixelRatio: 2.5,
            backgroundColor: '#ffffff',
            fontEmbedCSS: thaiFontCss,
            cacheBust: false,
            filter: (node) => !(node as HTMLElement)?.classList?.contains('no-print')
          });
        } catch (innerErr) {
          console.warn('Canvas render retry for page', i + 1, innerErr);
          canvas = await toCanvas(pageEl, {
            pixelRatio: 2.0,
            backgroundColor: '#ffffff',
            fontEmbedCSS: thaiFontCss,
            filter: (node) => !(node as HTMLElement)?.classList?.contains('no-print')
          });
        }

        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
      }

      if (shouldDownload) {
        const safeDocNo = order.docNo.replace(/[/\\?%*:|"<>]/g, '_');
        const fileName = `ใบเบิกวัสดุ_${safeDocNo}.pdf`;
        pdf.save(fileName);
        setStatusMessage({ 
          text: `ดาวน์โหลดไฟล์ "${fileName}" (${pageElements.length} หน้า) มาตรฐาน A4 คมชัดเรียบร้อยแล้ว`, 
          type: 'success' 
        });
        setTimeout(() => setStatusMessage(null), 5000);
      }

      return pdf;
    } catch (error) {
      console.error('Error generating PDF:', error);
      setStatusMessage({ 
        text: 'เกิดข้อผิดพลาดในการสร้างไฟล์ PDF กรุณาลองใหม่อีกครั้ง', 
        type: 'warning' 
      });
      setTimeout(() => setStatusMessage(null), 5000);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle direct print
  const handlePrint = async () => {
    setIsProcessing(true);
    setStatusMessage({ text: 'กำลังเตรียมคำสั่งพิมพ์เอกสาร A4 แนวตั้ง...', type: 'info' });

    let printTriggered = false;
    try {
      window.print();
      printTriggered = true;
    } catch (err) {
      console.warn('Native window.print() failed:', err);
      printTriggered = false;
    }

    const isInsideIframe = window.self !== window.top;
    if (!printTriggered || isInsideIframe) {
      setStatusMessage({ 
        text: 'กำลังสร้างไฟล์ PDF ฟอนต์ TH Sarabun New สำหรับสั่งพิมพ์...', 
        type: 'info' 
      });
      await generatePdf(true);
      setStatusMessage({ 
        text: 'เปิดหน้าต่างพิมพ์สำเร็จ และดาวน์โหลดไฟล์ PDF เรียบร้อยแล้ว', 
        type: 'success' 
      });
      setTimeout(() => setStatusMessage(null), 6000);
    } else {
      setIsProcessing(false);
      setStatusMessage({ text: 'เปิดหน้าต่างสั่งพิมพ์ของเบราว์เซอร์เรียบร้อยแล้ว', type: 'success' });
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleDownloadPdf = async () => {
    await generatePdf(true);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto requisition-modal-backdrop">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-300 flex flex-col max-h-[96vh] text-slate-900">
        
        {/* Top toolbar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-100/90 rounded-t-2xl no-print">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-800">
                แบบฟอร์มใบเบิกวัสดุทางการ — วิทยาลัยการเมืองการปกครอง (COPAG MSU)
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-[11px] bg-amber-500/15 text-amber-900 font-bold px-2 py-0.5 rounded border border-amber-300">
                  ฟอนต์ TH Sarabun New ทั้งหมด
                </span>
                <span className="text-[11px] bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded">
                  เอกสารจำนวน {pages.length} หน้า (A4 แนวตั้ง)
                </span>
                {order.items.length > 6 && (
                  <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded border border-blue-300">
                    รายการเกินหน้าแรก ระบบแบ่งขึ้นหน้าที่ 2 อัตโนมัติ
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Multi-page test toggle for small orders */}
            {order.items.length <= 6 && (
              <label 
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 transition select-none"
                title="คลิกเพื่อทดสอบจำลองแบ่งเป็น 2 หน้า (หน้าแรก + แผ่นต่อหน้าที่ 2)"
              >
                <input
                  type="checkbox"
                  checked={forceMultiPage}
                  onChange={(e) => setForceMultiPage(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                />
                <Layers className="w-3.5 h-3.5 text-amber-600" />
                <span>จำลอง 2 หน้า (ทดสอบดูแผ่นต่อ)</span>
              </label>
            )}

            {/* Signer Management Button - ONLY for Admin */}
            {isAdmin && (
              <button
                onClick={() => handleOpenSignerModal()}
                type="button"
                title="กำหนดหรือเปลี่ยนชื่อและตำแหน่งของผู้ลงนามทุกฝ่าย (เฉพาะผู้ดูแลระบบ)"
                className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                <span>บริหารจัดการผู้ลงนาม</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              disabled={isProcessing}
              title="พิมพ์เอกสาร หรือส่งออก PDF สำหรับสั่งพิมพ์"
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : (
                <Printer className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>พิมพ์เอกสาร</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isProcessing}
              title="ดาวน์โหลดเป็นไฟล์ PDF (ฟอนต์ TH Sarabun New คมชัดทุกหน้า)"
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>ดาวน์โหลด PDF ({pages.length} หน้า)</span>
            </button>

            {order && (
              <button
                onClick={() => exportSingleRequisitionToExcel(order)}
                type="button"
                title="ส่งออกใบเบิกพัสดุนี้เป็นไฟล์ Excel (.xlsx)"
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>ส่งออก Excel</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg cursor-pointer transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Notification Toast/Banner */}
        {statusMessage && (
          <div className={`px-4 py-2 text-xs flex items-center gap-2 border-b no-print ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : statusMessage.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : statusMessage.type === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            )}
            <span className="font-semibold">{statusMessage.text}</span>
          </div>
        )}

        {/* Printable Official Paper Layout */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 bg-slate-300/60 space-y-6">
          
          {/* CSS Rule: TH Sarabun New font for all elements and standard print styles */}
          <style dangerouslySetInnerHTML={{ __html: `
            @font-face {
              font-family: 'TH Sarabun New';
              font-style: normal;
              font-weight: 400;
              src: local('TH Sarabun New'), local('THSarabunNew'), url('https://fonts.gstatic.com/s/sarabun/v17/DtVjJx26TKEr37c9WBI.ttf') format('truetype');
            }
            @font-face {
              font-family: 'TH Sarabun New';
              font-style: normal;
              font-weight: 700;
              src: local('TH Sarabun New Bold'), local('THSarabunNew-Bold'), url('https://fonts.gstatic.com/s/sarabun/v17/DtVmJx26TKEr37c9YK5sulw.ttf') format('truetype');
            }
            @font-face {
              font-family: 'TH Sarabun New';
              font-style: normal;
              font-weight: 800;
              src: local('TH Sarabun New Bold'), local('THSarabunNew-Bold'), url('https://fonts.gstatic.com/s/sarabun/v17/DtVmJx26TKEr37c9YLJvulw.ttf') format('truetype');
            }

            .requisition-print-root,
            .requisition-print-root *,
            .requisition-a4-page,
            .requisition-a4-page * {
              font-family: 'TH Sarabun New', 'THSarabunNew', 'Sarabun', 'TH Sarabun PSK', sans-serif !important;
            }

            .requisition-a4-page {
              width: 100%;
              max-width: 794px;
              min-height: 1123px;
              background: #ffffff;
              margin: 16px auto;
              padding: 16mm 18mm 16mm 18mm;
              box-sizing: border-box;
              box-shadow: 0 6px 16px rgba(0,0,0,0.18);
              color: #000000;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              border: 1px solid #d1d5db;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            @media print {
              @page {
                size: A4 portrait !important;
                margin: 10mm 12mm 10mm 12mm !important;
              }
              body { 
                margin: 0 !important; 
                background: none !important; 
              }
              .no-print {
                display: none !important;
              }
              .requisition-modal-backdrop {
                position: static !important;
                background: transparent !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
                display: block !important;
              }
              .requisition-a4-page {
                width: 100% !important;
                max-width: 100% !important;
                min-height: 270mm !important;
                margin: 0 !important;
                padding: 6mm 10mm !important;
                box-shadow: none !important;
                border: none !important;
                page-break-after: always !important;
                break-after: page !important;
              }
              .requisition-a4-page:last-child {
                page-break-after: avoid !important;
                break-after: avoid !important;
              }
              .signer-box-interactive {
                border: none !important;
                background: transparent !important;
                background-color: transparent !important;
                padding: 0 !important;
                box-shadow: none !important;
              }
              .signer-inline-interactive,
              .print-clean-highlight {
                background: transparent !important;
                background-color: transparent !important;
                border: none !important;
                padding: 0 !important;
              }
            }
          `}} />

          {/* Root printable container */}
          <div ref={printRef} className="requisition-print-root space-y-8">
            {pages.map((page) => (
              <div 
                key={`page-${page.pageNumber}`}
                className="requisition-a4-page"
                style={{ fontFamily: 'TH Sarabun New, Sarabun, sans-serif' }}
              >
                {/* Top section: Header & Items */}
                <div>
                  
                  {/* Page 1 Official Emblem & Institution Header */}
                  {page.isFirstPage ? (
                    <>
                      <div className="text-center mb-2.5 border-b-2 border-black pb-2">
                        {/* Centered University Emblem Logo */}
                        <div className="flex justify-center items-center mb-1">
                          <img
                            src="/msu-logo.png"
                            alt="ตราสัญลักษณ์ มหาวิทยาลัยมหาสารคาม"
                            className="h-16 sm:h-20 w-auto object-contain mx-auto"
                            crossOrigin="anonymous"
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        <div 
                          className="font-bold text-black"
                          style={{ fontSize: '15px', lineHeight: '1.2' }}
                        >
                          มหาวิทยาลัยมหาสารคาม
                        </div>
                        <h2 
                          className="font-bold text-black mt-0.5"
                          style={{ fontSize: '18px', lineHeight: '1.2' }}
                        >
                          วิทยาลัยการเมืองการปกครอง
                        </h2>
                        <div 
                          className="font-bold text-black mt-0.5 underline underline-offset-4 decoration-2"
                          style={{ fontSize: '26px', lineHeight: '1.2' }}
                        >
                          ใบเบิกวัสดุ
                        </div>
                        <p 
                          className="font-normal text-black mt-0.5"
                          style={{ fontSize: '13px', lineHeight: '1.2' }}
                        >
                          College of Politics and Governance, Mahasarakham University
                        </p>
                      </div>

                      {/* Document Meta Row */}
                      <div className="flex justify-between items-center mb-2 border-b-2 border-black pb-1">
                        <div style={{ fontSize: '15px' }}>
                          <span className="font-bold text-black">เลขที่เอกสาร: </span>
                          <span className="font-bold text-black underline decoration-2 px-1">{order.docNo}</span>
                        </div>
                        <div style={{ fontSize: '15px' }}>
                          <span className="font-bold text-black">วันที่: </span>
                          <span className="font-bold text-black underline decoration-2 px-1">{formatThaiDate(order.date)}</span>
                        </div>
                      </div>

                      {/* Requester Details Box */}
                      <div 
                        className="space-y-1 mb-2.5 bg-white p-2.5 rounded-lg border-2 border-black text-black leading-relaxed"
                        style={{ fontSize: '15px' }}
                      >
                        <p className="indent-8 font-normal">
                          ข้าพเจ้า{' '}
                          <span 
                            onClick={() => isAdmin && handleOpenSignerModal('requester')}
                            title={isAdmin ? "คลิกเพื่อกำหนดหรือเปลี่ยนชื่อผู้ขอเบิก หรือกดปุ่มบริหารจัดการด้านบน" : undefined}
                            className={`signer-inline-interactive print-clean-highlight font-bold ${isAdmin ? 'underline decoration-2 px-1.5 py-0.5 bg-amber-100/90 border border-amber-300 rounded cursor-pointer hover:bg-amber-200 transition' : ''}`}
                          >
                            {signers.requesterName}
                          </span>{' '}
                          ตำแหน่ง{' '}
                          <span 
                            onClick={() => isAdmin && handleOpenSignerModal('requester')}
                            title={isAdmin ? "คลิกเพื่อกำหนดหรือเปลี่ยนตำแหน่งผู้ขอเบิก หรือกดปุ่มบริหารจัดการด้านบน" : undefined}
                            className={`signer-inline-interactive print-clean-highlight font-bold ${isAdmin ? 'underline decoration-2 px-1.5 py-0.5 bg-amber-100/90 border border-amber-300 rounded cursor-pointer hover:bg-amber-200 transition' : ''}`}
                          >
                            {signers.requesterPosition || 'อาจารย์/บุคลากร'}
                          </span>{' '}
                          สังกัด/สาขาวิชา{' '}
                          <span 
                            onClick={() => isAdmin && handleOpenSignerModal('requester')}
                            title={isAdmin ? "คลิกเพื่อแก้ไขสังกัด/สาขาวิชา" : undefined}
                            className={`signer-inline-interactive print-clean-highlight font-bold ${isAdmin ? 'underline decoration-2 px-1.5 py-0.5 bg-amber-100/90 border border-amber-300 rounded cursor-pointer hover:bg-amber-200 transition' : ''}`}
                          >
                            {signers.requesterDepartment}
                          </span>
                        </p>
                        <p className="indent-8 font-normal">
                          มีความประสงค์ขอเบิกวัสดุ หมวดพัสดุ: <span className="font-bold underline decoration-2 px-1">{categoriesText}</span> 
                          เพื่อใช้ในราชการ{order.requisitionType ? ` (${order.requisitionType})` : ''}: <span className="font-bold underline decoration-2 px-1">{order.purpose || 'เพื่อใช้ในงานราชการและการเรียนการสอนของวิทยาลัย'}</span> ดังรายการต่อไปนี้
                        </p>
                      </div>
                    </>
                  ) : (
                    /* Continuation Header for Page 2+ */
                    <div className="mb-2.5 border-b-2 border-black pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div style={{ fontSize: '14px' }} className="font-bold text-black">
                            วิทยาลัยการเมืองการปกครอง มหาวิทยาลัยมหาสารคาม
                          </div>
                          <div style={{ fontSize: '19px' }} className="font-bold text-black mt-0.5">
                            ใบเบิกวัสดุ — แผ่นต่อ (หน้าที่ {page.pageNumber} จาก {page.totalPages} หน้า)
                          </div>
                        </div>
                        <div className="text-right" style={{ fontSize: '14px' }}>
                          <p><span className="font-bold">เลขที่เอกสาร: </span><span className="font-bold underline">{order.docNo}</span></p>
                          <p className="text-slate-700">วันที่ {formatThaiDate(order.date)}</p>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-slate-700" style={{ fontSize: '13px' }}>
                        <span>ผู้ขอเบิก: <strong>{signers.requesterName}</strong> ({signers.requesterDepartment})</span>
                      </div>
                    </div>
                  )}

                  {/* Items Table */}
                  <div className="mb-2">
                    <table className="w-full text-left border-collapse border-2 border-black text-black">
                      <thead>
                        <tr 
                          className="bg-slate-100 text-black font-bold border-b-2 border-black text-center"
                          style={{ fontSize: '14px' }}
                        >
                          <th className="border border-black p-1.5 w-10 text-center">ลำดับ</th>
                          <th className="border border-black p-1.5 w-20 text-center">รหัสพัสดุ</th>
                          <th className="border border-black p-1.5 text-center">รายการพัสดุ</th>
                          <th className="border border-black p-1.5 w-24 text-center">หมวดพัสดุ</th>
                          <th className="border border-black p-1.5 w-14 text-center">จำนวน</th>
                          <th className="border border-black p-1.5 w-16 text-center">หน่วยนับ</th>
                          <th className="border border-black p-1.5 w-20 text-right pr-2">ราคา/หน่วย</th>
                          <th className="border border-black p-1.5 w-22 text-right pr-2">จำนวนเงิน</th>
                        </tr>
                      </thead>
                      <tbody style={{ fontSize: '14px' }}>
                        
                        {/* Brought forward row for Page 2+ */}
                        {!page.isFirstPage && (
                          <tr className="bg-amber-50/50 border-b border-black font-bold">
                            <td colSpan={6} className="border border-black p-1.5 text-right pr-3">
                              (ยอดยกมาจากหน้าที่ {page.pageNumber - 1})
                            </td>
                            <td colSpan={2} className="border border-black p-1.5 text-right pr-2 font-bold">
                              ฿{(page.broughtForwardAmount || 0).toLocaleString()} บาท
                            </td>
                          </tr>
                        )}

                        {/* Item rows */}
                        {page.items.map(({ item, globalIndex }) => {
                          const cat = getItemCategory(item);
                          return (
                            <tr key={globalIndex} className="border-b border-black">
                              <td className="border border-black p-1 text-center font-bold">{globalIndex}</td>
                              <td className="border border-black p-1 text-center font-bold">{item.materialId}</td>
                              <td className="border border-black p-1 font-bold pl-2">{item.materialName}</td>
                              <td className="border border-black p-1 text-center text-xs">{cat}</td>
                              <td className="border border-black p-1 text-center font-bold">{item.quantity}</td>
                              <td className="border border-black p-1 text-center">{item.unit}</td>
                              <td className="border border-black p-1 text-right pr-2 font-semibold">฿{(item.unitPrice || 0).toLocaleString()}</td>
                              <td className="border border-black p-1 text-right pr-2 font-bold">฿{(item.totalPrice || 0).toLocaleString()}</td>
                            </tr>
                          );
                        })}

                        {/* Minimum empty rows for single-page documents with few items */}
                        {page.isFirstPage && page.isLastPage && Array.from({ length: Math.max(0, 3 - page.items.length) }).map((_, i) => (
                          <tr key={`empty-${i}`} className="border-b border-black h-7">
                            <td className="border border-black p-1 text-center text-slate-400 font-bold">{page.items.length + i + 1}</td>
                            <td className="border border-black p-1 text-center">&nbsp;</td>
                            <td className="border border-black p-1">&nbsp;</td>
                            <td className="border border-black p-1 text-center">&nbsp;</td>
                            <td className="border border-black p-1 text-center">&nbsp;</td>
                            <td className="border border-black p-1 text-center">&nbsp;</td>
                            <td className="border border-black p-1 text-right">&nbsp;</td>
                            <td className="border border-black p-1 text-right">&nbsp;</td>
                          </tr>
                        ))}

                        {/* Carried forward row if there is a next page */}
                        {!page.isLastPage && (
                          <tr className="bg-amber-50/70 border-t-2 border-black font-bold">
                            <td colSpan={6} className="border border-black p-2 text-right pr-3">
                              (มีต่อหน้า {page.pageNumber + 1} — รายการยังไม่สิ้นสุด ยอดยกไปหน้า {page.pageNumber + 1})
                            </td>
                            <td colSpan={2} className="border border-black p-2 text-right pr-2 font-bold">
                              ฿{(page.carriedForwardAmount || 0).toLocaleString()} บาท
                            </td>
                          </tr>
                        )}

                        {/* Grand Total row on the last page */}
                        {page.isLastPage && (
                          <tr className="bg-slate-100 border-t-2 border-black font-bold" style={{ fontSize: '15px' }}>
                            <td colSpan={6} className="border border-black p-2 text-right font-bold text-black">
                              รวมทั้งสิ้น ({order.totalItems || 0} หน่วย)
                            </td>
                            <td colSpan={2} className="border border-black p-2 text-right font-bold text-black pr-2">
                              ฿{(order.totalAmount || 0).toLocaleString()} บาท
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Note on non-last pages */}
                  {!page.isLastPage && (
                    <div className="text-right text-xs italic text-slate-700 font-bold mt-1" style={{ fontSize: '13px' }}>
                      * หมายเหตุ: เอกสารใบเบิกวัสดุมีรายการต่อเนื่องในหน้า {page.pageNumber + 1} กรุณาตรวจรับและลงนามรับรองในหน้าสุดท้าย
                    </div>
                  )}

                </div>

                {/* Bottom section: Signatures (Only on the last page) or Page Indicator */}
                <div>
                  {page.isLastPage ? (
                    <div className="pt-2 border-t-2 border-black space-y-2 text-black">
                      
                      {/* Row 1: ผู้ขอเบิก & เจ้าหน้าที่พัสดุ */}
                      <div className="grid grid-cols-2 gap-4 text-center">
                        {/* 1. ผู้ขอเบิก */}
                        <div 
                          onClick={() => isAdmin && handleOpenSignerModal('requester')}
                          className={`relative p-2.5 rounded-xl transition shadow-2xs text-black ${isAdmin ? 'signer-box-interactive group cursor-pointer border border-amber-300/80 bg-amber-50/50 hover:bg-amber-100/70 hover:border-amber-500' : 'border border-slate-200/80 bg-white'}`}
                          title={isAdmin ? "คลิกเพื่อกำหนดหรือเปลี่ยนชื่อ/ตำแหน่งผู้ขอเบิก หรือกดปุ่มบริหารจัดการด้านบน" : undefined}
                        >
                          {isAdmin && (
                            <div className="no-print absolute -top-2.5 right-2 bg-amber-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 group-hover:scale-105 transition">
                              <Edit3 className="w-2.5 h-2.5" />
                              <span>กำหนดชื่อ/ตำแหน่ง</span>
                            </div>
                          )}
                          <div className="h-2"></div>
                          <p className="font-bold text-black" style={{ fontSize: '14px' }}>
                            ลงชื่อ........................................................ผู้ขอเบิก
                          </p>
                          <p className="mt-0.5 font-bold text-black" style={{ fontSize: '15px' }}>
                            <span className={`print-clean-highlight px-1.5 py-0.5 rounded inline-block ${isAdmin ? 'bg-amber-100/90 border border-amber-300' : ''}`}>
                              ({cleanSignerDisplay(signers.requesterName)})
                            </span>
                          </p>
                          <p className="font-normal text-black mt-0.5" style={{ fontSize: '13px' }}>
                            <span className={`print-clean-highlight px-1.5 py-0.5 rounded inline-block ${isAdmin ? 'bg-amber-100/90 border border-amber-300' : ''}`}>
                              {signers.requesterPosition || 'อาจารย์/บุคลากร'}
                            </span>
                          </p>
                          <p className="font-normal text-black mt-0.5" style={{ fontSize: '13px' }}>
                            {signers.requesterDate}
                          </p>
                        </div>

                        {/* 2. เจ้าหน้าที่พัสดุ */}
                        <div 
                          onClick={() => isAdmin && handleOpenSignerModal('officer')}
                          className={`relative p-2.5 rounded-xl transition shadow-2xs text-black ${isAdmin ? 'signer-box-interactive group cursor-pointer border border-amber-300/80 bg-amber-50/50 hover:bg-amber-100/70 hover:border-amber-500' : 'border border-slate-200/80 bg-white'}`}
                          title={isAdmin ? "คลิกเพื่อกำหนดหรือเปลี่ยนชื่อ/ตำแหน่งเจ้าหน้าที่พัสดุ หรือกดปุ่มบริหารจัดการด้านบน" : undefined}
                        >
                          {isAdmin && (
                            <div className="no-print absolute -top-2.5 right-2 bg-amber-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 group-hover:scale-105 transition">
                              <Edit3 className="w-2.5 h-2.5" />
                              <span>กำหนดชื่อ/ตำแหน่ง</span>
                            </div>
                          )}
                          <div className="h-2"></div>
                          <p className="font-bold text-black" style={{ fontSize: '14px' }}>
                            ลงชื่อ........................................................เจ้าหน้าที่พัสดุ
                          </p>
                          <p className="mt-0.5 font-bold text-black" style={{ fontSize: '15px' }}>
                            <span className={`print-clean-highlight px-1.5 py-0.5 rounded inline-block ${isAdmin ? 'bg-amber-100/90 border border-amber-300' : ''}`}>
                              ({cleanSignerDisplay(signers.officerName)})
                            </span>
                          </p>
                          <p className="font-normal text-black mt-0.5" style={{ fontSize: '13px' }}>
                            <span className={`print-clean-highlight px-1.5 py-0.5 rounded inline-block ${isAdmin ? 'bg-amber-100/90 border border-amber-300' : ''}`}>
                              {signers.officerPosition}
                            </span>
                          </p>
                          <p className="font-normal text-black mt-0.5" style={{ fontSize: '13px' }}>
                            {signers.officerDate}
                          </p>
                        </div>
                      </div>

                      {/* Row 2: หัวหน้าเจ้าหน้าที่พัสดุ, ผู้ตัดบัญชีพัสดุ, ผู้จ่ายของ */}
                      <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-dashed border-black">
                        {/* 3. หัวหน้าเจ้าหน้าที่พัสดุ */}
                        <div 
                          onClick={() => isAdmin && handleOpenSignerModal('head')}
                          className={`relative p-2 rounded-xl transition shadow-2xs text-black ${isAdmin ? 'signer-box-interactive group cursor-pointer border border-amber-300/80 bg-amber-50/50 hover:bg-amber-100/70 hover:border-amber-500' : 'border border-slate-200/80 bg-white'}`}
                          title={isAdmin ? "คลิกเพื่อกำหนดหรือเปลี่ยนชื่อ/ตำแหน่งหัวหน้าเจ้าหน้าที่พัสดุ" : undefined}
                        >
                          {isAdmin && (
                            <div className="no-print absolute -top-2.5 right-2 bg-amber-500 text-slate-950 text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-xs flex items-center gap-1 group-hover:scale-105 transition">
                              <Edit3 className="w-2.5 h-2.5" />
                              <span>กำหนด</span>
                            </div>
                          )}
                          <div className="h-2"></div>
                          <p className="font-bold text-black" style={{ fontSize: '13px' }}>
                            ลงชื่อ........................................................
                          </p>
                          <p className="mt-0.5 font-bold text-black" style={{ fontSize: '14px' }}>
                            <span className={`print-clean-highlight px-1 py-0.5 rounded inline-block ${isAdmin ? 'bg-amber-100/90 border border-amber-300' : ''}`}>
                              ({cleanSignerDisplay(signers.headName)})
                            </span>
                          </p>
                          <p className="font-bold text-black mt-0.5" style={{ fontSize: '12px' }}>
                            <span className={`print-clean-highlight px-1 py-0.5 rounded inline-block ${isAdmin ? 'bg-amber-100/90 border border-amber-300' : ''}`}>
                              {signers.headPosition}
                            </span>
                          </p>
                          <p className="font-normal text-black mt-0.5" style={{ fontSize: '12px' }}>
                            {signers.headDate}
                          </p>
                        </div>

                        {/* 4. ผู้ตัดบัญชีพัสดุ */}
                        <div 
                          onClick={() => isAdmin && handleOpenSignerModal('ledger')}
                          className={`relative p-2 rounded-xl transition shadow-2xs text-black ${isAdmin ? 'signer-box-interactive group cursor-pointer border border-amber-300/80 bg-amber-50/50 hover:bg-amber-100/70 hover:border-amber-500' : 'border border-slate-200/80 bg-white'}`}
                          title={isAdmin ? "คลิกเพื่อกำหนดหรือเปลี่ยนชื่อ/ตำแหน่งผู้ตัดบัญชีพัสดุ" : undefined}
                        >
                          {isAdmin && (
                            <div className="no-print absolute -top-2.5 right-2 bg-amber-500 text-slate-950 text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-xs flex items-center gap-1 group-hover:scale-105 transition">
                              <Edit3 className="w-2.5 h-2.5" />
                              <span>กำหนด</span>
                            </div>
                          )}
                          <div className="h-2"></div>
                          <p className="font-bold text-black" style={{ fontSize: '13px' }}>
                            ลงชื่อ........................................................
                          </p>
                          <p className="mt-0.5 font-bold text-black" style={{ fontSize: '14px' }}>
                            <span className={`print-clean-highlight px-1 py-0.5 rounded inline-block ${isAdmin ? 'bg-amber-100/90 border border-amber-300' : ''}`}>
                              ({cleanSignerDisplay(signers.ledgerOfficerName)})
                            </span>
                          </p>
                          <p className="font-bold text-black mt-0.5" style={{ fontSize: '12px' }}>
                            <span className={`print-clean-highlight px-1 py-0.5 rounded inline-block ${isAdmin ? 'bg-amber-100/90 border border-amber-300' : ''}`}>
                              {signers.ledgerOfficerPosition}
                            </span>
                          </p>
                          <p className="font-normal text-black mt-0.5" style={{ fontSize: '12px' }}>
                            {signers.ledgerOfficerDate}
                          </p>
                        </div>

                        {/* 5. ผู้จ่ายของ */}
                        <div 
                          onClick={() => isAdmin && handleOpenSignerModal('disburser')}
                          className={`relative p-2 rounded-xl transition shadow-2xs text-black ${isAdmin ? 'signer-box-interactive group cursor-pointer border border-amber-300/80 bg-amber-50/50 hover:bg-amber-100/70 hover:border-amber-500' : 'border border-slate-200/80 bg-white'}`}
                          title={isAdmin ? "คลิกเพื่อกำหนดหรือเปลี่ยนชื่อ/ตำแหน่งผู้จ่ายของ" : undefined}
                        >
                          {isAdmin && (
                            <div className="no-print absolute -top-2.5 right-2 bg-amber-500 text-slate-950 text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-xs flex items-center gap-1 group-hover:scale-105 transition">
                              <Edit3 className="w-2.5 h-2.5" />
                              <span>กำหนด</span>
                            </div>
                          )}
                          <div className="h-2"></div>
                          <p className="font-bold text-black" style={{ fontSize: '13px' }}>
                            ลงชื่อ........................................................
                          </p>
                          <p className="mt-0.5 font-bold text-black" style={{ fontSize: '14px' }}>
                            <span className={`print-clean-highlight px-1 py-0.5 rounded inline-block ${isAdmin ? 'bg-amber-100/90 border border-amber-300' : ''}`}>
                              ({cleanSignerDisplay(signers.disburserName)})
                            </span>
                          </p>
                          <p className="font-bold text-black mt-0.5" style={{ fontSize: '12px' }}>
                            <span className={`print-clean-highlight px-1 py-0.5 rounded inline-block ${isAdmin ? 'bg-amber-100/90 border border-amber-300' : ''}`}>
                              {signers.disburserPosition}
                            </span>
                          </p>
                          <p className="font-normal text-black mt-0.5" style={{ fontSize: '12px' }}>
                            {signers.disburserDate}
                          </p>
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="py-2 border-t border-dashed border-black flex items-center justify-between text-xs text-slate-700">
                      <span>วิทยาลัยการเมืองการปกครอง มหาวิทยาลัยมหาสารคาม</span>
                      <span>(มีรายการต่อและลงนามในหน้า {page.pageNumber + 1})</span>
                    </div>
                  )}

                  {/* Official Bottom Footer with Page Indicator */}
                  <div 
                    className="mt-2 pt-1 border-t border-black flex items-center justify-between text-black"
                    style={{ fontSize: '12px' }}
                  >
                    <span>
                      ระบบเบิกจ่ายและสารสนเทศงานพัสดุ วิทยาลัยการเมืองการปกครอง มหาวิทยาลัยมหาสารคาม (COPAG MSU)
                    </span>
                    <span className="font-bold">
                      แผ่นที่ {page.pageNumber} จาก {page.totalPages} แผ่น
                    </span>
                  </div>

                </div>

              </div>
            ))}
          </div>

        </div>

      </div>

      {/* Requisition Signer Management Modal - Only accessible by Admin */}
      {isAdmin && order && isSignerModalOpen && (
        <RequisitionSignerModal
          isOpen={isSignerModalOpen}
          onClose={() => setIsSignerModalOpen(false)}
          signers={signers}
          onSave={handleSaveSigners}
          systemUsers={systemUsers}
          defaultOrderValues={{
            requesterName: order.requesterName,
            requesterPosition: order.requesterPosition || 'อาจารย์/บุคลากร',
            requesterDepartment: order.department || 'วิทยาลัยการเมืองการปกครอง',
            requesterDate: order.date ? `วันที่ ${formatThaiDate(order.date)}` : 'วันที่ ......../......../............',
            defaultAdminName: effectiveAdminName,
            disbursedDate: order.disbursedDate ? formatThaiDate(order.disbursedDate) : undefined
          }}
          focusRole={focusRole}
        />
      )}
    </div>
  );
};
