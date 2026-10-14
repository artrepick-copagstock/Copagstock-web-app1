import { FC, useRef, useState, useEffect } from 'react';
import { Material, AppUser } from '../types';
import { X, Printer, Download, BookOpenText, Loader2, CheckCircle2, AlertCircle, Edit3, UserCheck } from 'lucide-react';
import jsPDF from 'jspdf';
import { toCanvas } from 'html-to-image';
import { StockCardSignerModal, StockCardSigners } from './StockCardSignerModal';
import { StorageService } from '../services/storageService';

export interface StockLedgerRow {
  id: string;
  date: string;
  docNo: string;
  type: 'BALANCE_FORWARD' | 'IN' | 'OUT';
  description: string;
  inQty: number | null;
  outQty: number | null;
  balanceQty: number;
  unitPrice: number;
  totalPrice?: number;
  balanceValuation: number;
  officer: string;
  note: string;
}

interface OfficialStockCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: Material | null;
  ledgerRows: StockLedgerRow[];
  fiscalYear: string;
  startDate?: string;
  endDate?: string;
  broughtForwardQty: number;
  periodInQty: number;
  periodOutQty: number;
  runningBalance: number;
  adminName?: string;
  isAdmin?: boolean;
}

export const OfficialStockCardModal: FC<OfficialStockCardModalProps> = ({
  isOpen,
  onClose,
  material,
  ledgerRows,
  fiscalYear,
  startDate,
  endDate,
  broughtForwardQty,
  periodInQty,
  periodOutQty,
  runningBalance,
  adminName,
  isAdmin = false
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'warning' } | null>(null);

  // Signer management states
  const [isSignerModalOpen, setIsSignerModalOpen] = useState(false);
  const [focusRole, setFocusRole] = useState<'recorder' | 'checker' | null>(null);
  const [systemUsers, setSystemUsers] = useState<AppUser[]>([]);

  const effectiveAdminName = adminName || 'กาญจนภาษณ์ มาตบุรม';

  const [signers, setSigners] = useState<StockCardSigners>(() => {
    try {
      const saved = localStorage.getItem('stock_card_signers_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.recorderName || parsed.checkerName)) {
          return {
            recorderName: parsed.recorderName || effectiveAdminName,
            recorderPosition: parsed.recorderPosition || 'เจ้าหน้าที่พัสดุ',
            recorderDate: parsed.recorderDate || 'วันที่ ........./........./............',
            checkerName: parsed.checkerName || '..............................................................',
            checkerPosition: parsed.checkerPosition || 'หัวหน้างานพัสดุและคลัง',
            checkerDate: parsed.checkerDate || 'วันที่ ........./........./............'
          };
        }
      }
    } catch {}
    return {
      recorderName: effectiveAdminName,
      recorderPosition: 'เจ้าหน้าที่พัสดุ',
      recorderDate: 'วันที่ ........./........./............',
      checkerName: '..............................................................',
      checkerPosition: 'หัวหน้างานพัสดุและคลัง',
      checkerDate: 'วันที่ ........./........./............'
    };
  });

  // Load system accounts for quick selection
  useEffect(() => {
    StorageService.getUsers().then(users => {
      if (users && users.length > 0) {
        setSystemUsers(users);
      }
    }).catch(err => console.warn('Could not load users for signer picker:', err));
  }, []);

  const handleSaveSigners = (newSigners: StockCardSigners, saveAsDefault: boolean) => {
    setSigners(newSigners);
    if (saveAsDefault) {
      try {
        localStorage.setItem('stock_card_signers_settings', JSON.stringify(newSigners));
      } catch {}
    }
  };

  const handleOpenSignerModal = (role?: 'recorder' | 'checker') => {
    if (!isAdmin) return;
    setFocusRole(role || null);
    setIsSignerModalOpen(true);
  };

  const cleanSignerDisplay = (nameStr: string) => {
    if (!nameStr) return '..............................................................';
    const trimmed = nameStr.trim();
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      return trimmed.slice(1, -1).trim();
    }
    return trimmed;
  };

  if (!isOpen || !material) return null;
  const effectiveLocation = material.location && material.location !== 'ตู้พัสดุ A1' && material.location !== 'ตู้พัสดุA1'
    ? material.location
    : 'ห้องพัสดุวิทยาลัยการเมืองการปกครอง';

  const formatThaiDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const monthsThai = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
      ];
      const day = d.getDate();
      const month = monthsThai[d.getMonth()];
      const year = (d.getFullYear() + 543).toString().slice(-2);
      return `${day} ${month} ${year}`;
    } catch {
      return dateStr;
    }
  };

  const cleanOfficerName = (name?: string | null): string => {
    if (!name) return '-';
    return name.replace(/\s*\(?วก\.?\s*มมส\.?\)?/gi, '').trim() || '-';
  };

  // Calculate Fiscal Year of print date and full date
  const now = new Date();
  const printDay = now.getDate();
  const printMonthsFull = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const printMonthIndex = now.getMonth();
  const printYearAD = now.getFullYear();
  const printThaiYear = printYearAD + 543;
  // Fiscal year in Thailand: Oct 1 - Sep 30
  const printFiscalYear = printMonthIndex >= 9 ? printThaiYear + 1 : printThaiYear;
  const printDateFullText = `${printDay} ${printMonthsFull[printMonthIndex]} พ.ศ. ${printThaiYear}`;

  // Period description for display
  const selectedFiscalYearText = fiscalYear && fiscalYear !== 'all' && fiscalYear !== 'custom'
    ? `ปีงบประมาณ พ.ศ. ${fiscalYear}`
    : `ปีงบประมาณที่พิมพ์: พ.ศ. ${printFiscalYear}`;

  const selectedPeriodDisplay = startDate && endDate
    ? `ช่วงเวลาที่เลือกแสดงผล: วันที่ ${formatThaiDate(startDate)} ถึง ${formatThaiDate(endDate)}`
    : fiscalYear && fiscalYear !== 'all' && fiscalYear !== 'custom'
      ? `ช่วงเวลาที่เลือกแสดงผล: 1 ต.ค. ${Number(fiscalYear) - 1} ถึง 30 ก.ย. ${fiscalYear}`
      : 'ช่วงเวลาที่เลือกแสดงผล: บันทึกประวัติการรับ-จ่ายทั้งหมด';

  const currentStockNumber = material.currentStock !== undefined ? material.currentStock : runningBalance;
  const currentStockValuation = currentStockNumber * (material.unitPrice || 0);

  const periodText = fiscalYear !== 'all' && fiscalYear !== 'custom'
    ? `ประจำปีงบประมาณ พ.ศ. ${fiscalYear}`
    : startDate && endDate
      ? `ช่วงวันที่ ${formatThaiDate(startDate)} ถึง ${formatThaiDate(endDate)}`
      : 'บันทึกประวัติการรับ-จ่ายทั้งหมด';

  // Pagination logic for standard A4 landscape stock card
  const paginateRows = (allRows: typeof ledgerRows) => {
    if (allRows.length <= 7) {
      return [allRows];
    }

    const pages: (typeof ledgerRows)[] = [];
    let remaining = [...allRows];

    // Page 1 takes up to 7 rows, ensuring at least 2 rows remain for subsequent page
    let p1Count = 7;
    if (remaining.length - p1Count < 2) {
      p1Count = Math.max(3, remaining.length - 2);
    }
    pages.push(remaining.slice(0, p1Count));
    remaining = remaining.slice(p1Count);

    // Subsequent pages
    while (remaining.length > 0) {
      // If remaining rows fit comfortably on last page (with signatures, up to 8 rows)
      if (remaining.length <= 8) {
        pages.push(remaining);
        break;
      }
      // Intermediate page (without signatures, up to 10 rows)
      let pCount = 10;
      if (remaining.length - pCount < 2) {
        pCount = remaining.length - 2;
      }
      pages.push(remaining.slice(0, pCount));
      remaining = remaining.slice(pCount);
    }

    return pages;
  };

  const pageChunks = paginateRows(ledgerRows);
  const totalPages = pageChunks.length;

  // Generate high-resolution multi-page PDF matching A4 Landscape (297mm x 210mm)
  const generatePdf = async (shouldDownload = true): Promise<jsPDF | null> => {
    const container = printRef.current;
    if (!container || !material) return null;

    const pageElements = container.querySelectorAll<HTMLElement>('.stockcard-a4-page');
    if (!pageElements || pageElements.length === 0) return null;

    try {
      setIsProcessing(true);
      setStatusMessage({ text: `กำลังจัดหน้าและประมวลผลสมุดคุมบัญชีพัสดุ (${pageElements.length} หน้า)...`, type: 'info' });

      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));

      const thaiFontCss = `
        @font-face {
          font-family: 'Sarabun';
          font-style: normal;
          font-weight: 400;
          src: local('Sarabun'), url('https://fonts.gstatic.com/s/sarabun/v17/DtVjJx26TKEr37c9WBI.ttf') format('truetype');
        }
        @font-face {
          font-family: 'Sarabun';
          font-style: normal;
          font-weight: 700;
          src: local('Sarabun Bold'), url('https://fonts.gstatic.com/s/sarabun/v17/DtVmJx26TKEr37c9YK5sulw.ttf') format('truetype');
        }
        .stockcard-print-root, .stockcard-print-root * {
          font-family: 'Sarabun', sans-serif !important;
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
        .print-clean-highlight {
          background: transparent !important;
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
        }
        .stockcard-meta-subtitle, .stockcard-meta-subtitle *,
        .stockcard-continuation-header, .stockcard-continuation-header * {
          white-space: nowrap !important;
        }
      `;

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // 297mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 210mm

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];
        if (i > 0) {
          pdf.addPage('a4', 'landscape');
        }

        setStatusMessage({ 
          text: `กำลังเรนเดอร์เอกสาร A4 หน้า ${i + 1} จาก ${pageElements.length}...`, 
          type: 'info' 
        });

        let canvas: HTMLCanvasElement;
        try {
          canvas = await toCanvas(pageEl, {
            pixelRatio: 2.2,
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
        const cleanName = material.name.replace(/[/\\?%*:|"<>]/g, '_');
        const fileName = `สมุดคุมบัญชีพัสดุ_${material.id}_${cleanName}.pdf`;
        pdf.save(fileName);
        setStatusMessage({ 
          text: `ดาวน์โหลดไฟล์ "${fileName}" (${pageElements.length} หน้า) สำเร็จเรียบร้อยแล้ว`, 
          type: 'success' 
        });
        setTimeout(() => setStatusMessage(null), 5000);
      }

      return pdf;
    } catch (error) {
      console.error('Error generating Stock Card PDF:', error);
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

  const handlePrint = async () => {
    try {
      window.print();
    } catch {
      // If browser blocks window.print, fallback to direct PDF export
      await generatePdf(true);
    }
  };

  return (
    <div className="stockcard-modal-backdrop fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Top Floating Control Bar */}
      <div className="no-print w-full max-w-6xl bg-white dark:bg-slate-800 rounded-t-2xl shadow-xl border border-slate-200 dark:border-slate-700 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpenText className="w-6 h-6 text-amber-500 shrink-0" />
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
              สมุดคุมบัญชีพัสดุ (Stock Card) มาตรฐาน A4
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              [{material.id}] {material.name} • คงเหลือปัจจุบัน: <span className="font-bold text-amber-600 dark:text-amber-400">{currentStockNumber} {material.unit}</span> • {selectedFiscalYearText}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Signer Management Button - Admin Only */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => handleOpenSignerModal()}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer shadow-xs"
              title="กำหนดหรือเปลี่ยนชื่อและตำแหน่งผู้ลงนาม (เฉพาะผู้ดูแลระบบ)"
            >
              <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>บริหารจัดการผู้ลงนาม</span>
            </button>
          )}

          {/* Direct PDF Download Button */}
          <button
            type="button"
            onClick={() => generatePdf(true)}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs sm:text-sm shadow-md transition cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>กำลังสร้าง PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลดเป็นไฟล์ PDF</span>
              </>
            )}
          </button>

          {/* Browser Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs sm:text-sm transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์</span>
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div className="w-full max-w-6xl px-4 py-2">
          <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              : statusMessage.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border border-amber-300'
              : 'bg-blue-50 text-blue-800 border border-blue-300'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        </div>
      )}

      {/* Printable Sheet Wrapper (A4 Landscape Proportions) */}
      <div className="w-full max-w-6xl bg-slate-200 dark:bg-slate-900 p-2 sm:p-6 overflow-x-auto rounded-b-2xl border-x border-b border-slate-300 dark:border-slate-700 flex flex-col items-center">
        <div ref={printRef} className="w-full flex flex-col items-center gap-6">
          {pageChunks.map((chunk, pageIdx) => {
            const isFirstPage = pageIdx === 0;
            const isLastPage = pageIdx === totalPages - 1;
            const pageNumber = pageIdx + 1;

            // Balance carried over from previous page
            const prevChunk = pageIdx > 0 ? pageChunks[pageIdx - 1] : null;
            const prevEndRow = prevChunk ? prevChunk[prevChunk.length - 1] : null;
            const prevEndBalance = prevEndRow ? prevEndRow.balanceQty : broughtForwardQty;

            // Balance at end of current page
            const currentEndRow = chunk[chunk.length - 1];
            const currentEndBalance = currentEndRow ? currentEndRow.balanceQty : prevEndBalance;

            return (
              <div key={pageIdx} className="flex flex-col items-center w-full">
                {/* Visual Sheet Indicator Header (screen only) */}
                {totalPages > 1 && (
                  <div className="no-print w-[1050px] max-w-full flex items-center justify-between pb-2 px-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                      สมุดคุมบัญชีพัสดุ A4 — แผ่นที่ {pageNumber} จากทั้งหมด {totalPages} แผ่น
                    </span>
                    <span className="text-slate-400 font-normal">
                      {isFirstPage ? '(หน้าแรก)' : `(หน้าที่ ${pageNumber} - ต่อ)`}
                    </span>
                  </div>
                )}

                {/* Individual A4 Landscape Sheet */}
                <div
                  className="stockcard-a4-page stockcard-print-root bg-white text-black shadow-2xl relative"
                  style={{
                    width: '1050px',
                    minHeight: '742px',
                    padding: '14mm 16mm',
                    boxSizing: 'border-box',
                    fontFamily: "'Sarabun', sans-serif",
                    fontSize: '14px',
                    lineHeight: '1.25',
                    color: '#000000',
                    backgroundColor: '#ffffff'
                  }}
                >
                  {/* Sheet Number Top Right Corner */}
                  <div className="text-right text-xs mb-1" style={{ fontSize: '11px', color: '#555555' }}>
                    แผ่นที่ {pageNumber} จาก {totalPages} แผ่น
                  </div>

                  {/* Header: First page has full official header, subsequent pages have continuation header */}
                  {isFirstPage ? (
                    <>
                      <div className="text-center pb-2">
                        <h1 
                          className="text-xl font-bold tracking-tight" 
                          style={{ fontSize: '22px', fontWeight: 'bold', fontFamily: 'Sarabun' }}
                        >
                          บัญชีคุมพัสดุ (Stock Card)
                        </h1>
                        <p 
                          className="font-semibold text-sm" 
                          style={{ fontSize: '15px', fontFamily: 'Sarabun' }}
                        >
                          วิทยาลัยการเมืองการปกครอง มหาวิทยาลัยมหาสารคาม
                        </p>
                        <div 
                          className="stockcard-meta-subtitle flex items-center justify-center gap-2 mt-1 whitespace-nowrap overflow-hidden"
                          style={{ 
                            fontSize: '12px', 
                            fontFamily: 'Sarabun',
                            whiteSpace: 'nowrap',
                            lineHeight: '1.3'
                          }}
                        >
                          <span className="font-bold shrink-0" style={{ whiteSpace: 'nowrap' }}>{selectedFiscalYearText}</span>
                          <span className="shrink-0">•</span>
                          <span className="shrink-0" style={{ whiteSpace: 'nowrap' }}>{selectedPeriodDisplay}</span>
                          <span className="shrink-0">•</span>
                          <span className="text-slate-600 shrink-0" style={{ whiteSpace: 'nowrap' }}>(พิมพ์ ณ วันที่ {printDateFullText})</span>
                        </div>
                      </div>

                      {/* Material Metadata Table */}
                      <table 
                        className="w-full mb-3 text-xs border-collapse"
                        style={{ border: '1.5px solid #000000', fontSize: '13.5px', fontFamily: 'Sarabun' }}
                      >
                        <tbody>
                          <tr>
                            <td style={{ border: '1px solid #000000', padding: '4px 8px', width: '50%', fontFamily: 'Sarabun' }}>
                              <span className="font-bold">รหัสพัสดุ: </span>
                              <span className="font-bold font-mono">{material.id}</span>
                              <span className="font-bold ml-4">ชื่อหรือชนิดพัสดุ: </span>
                              <span className="font-bold">{material.name}</span>
                            </td>
                            <td style={{ border: '1px solid #000000', padding: '4px 8px', width: '50%', fontFamily: 'Sarabun' }}>
                              <span className="font-bold">หมวดหมู่: </span>
                              <span>{material.category}</span>
                              <span className="font-bold ml-4">หน่วยนับ: </span>
                              <span>{material.unit}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style={{ border: '1px solid #000000', padding: '4px 8px', fontFamily: 'Sarabun' }}>
                              <span className="font-bold">สถานที่จัดเก็บ: </span>
                              <span>{effectiveLocation}</span>
                              <span className="font-bold ml-4">ราคาต่อหน่วย: </span>
                              <span>฿{(material.unitPrice || 0).toLocaleString()} บาท</span>
                            </td>
                            <td style={{ border: '1px solid #000000', padding: '4px 8px', fontFamily: 'Sarabun' }}>
                              <span className="font-bold">ปริมาณกำหนด: </span>
                              <span>ต่ำสุด {material.minQty} {material.unit} — สูงสุด {material.maxQty} {material.unit}</span>
                              <span className="font-bold ml-4">สถานะการใช้งาน: </span>
                              <span>{material.usageStatus || 'ประจำ'}</span>
                            </td>
                          </tr>
                          <tr style={{ backgroundColor: '#fffbeb' }}>
                            <td style={{ border: '1px solid #000000', padding: '4px 8px', fontFamily: 'Sarabun' }}>
                              <span className="font-bold text-amber-950">จำนวนคงเหลือพัสดุปัจจุบัน: </span>
                              <span className="font-bold font-mono text-[15px] text-amber-900 ml-1">
                                {currentStockNumber} {material.unit}
                              </span>
                            </td>
                            <td style={{ border: '1px solid #000000', padding: '4px 8px', fontFamily: 'Sarabun' }}>
                              <span className="font-bold text-amber-950">มูลค่าคงเหลือปัจจุบัน: </span>
                              <span className="font-bold font-mono text-[15px] text-amber-900 ml-1">
                                ฿{currentStockValuation.toLocaleString()} บาท
                              </span>
                              <span className="ml-3 text-xs text-slate-600">
                                (เกณฑ์ขั้นต่ำ: {material.minQty} {material.unit})
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </>
                  ) : (
                    /* Continuation Header */
                    <div className="stockcard-continuation-header pb-2 border-b border-black mb-2 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <h2 style={{ fontSize: '17px', fontWeight: 'bold', fontFamily: 'Sarabun', lineHeight: '1.2' }}>
                          บัญชีคุมพัสดุ (Stock Card) — แผ่นต่อ
                        </h2>
                        <p 
                          className="whitespace-nowrap"
                          style={{ fontSize: '12px', fontFamily: 'Sarabun', whiteSpace: 'nowrap', lineHeight: '1.3' }}
                        >
                          วิทยาลัยการเมืองการปกครอง มหาวิทยาลัยมหาสารคาม • รหัสพัสดุ: [{material.id}] {material.name} • <span className="font-bold text-amber-900 shrink-0" style={{ whiteSpace: 'nowrap' }}>คงเหลือปัจจุบัน: {currentStockNumber} {material.unit}</span>
                        </p>
                      </div>
                      <div 
                        className="text-right text-xs shrink-0 whitespace-nowrap" 
                        style={{ fontFamily: 'Sarabun', whiteSpace: 'nowrap' }}
                      >
                        <p className="font-bold" style={{ whiteSpace: 'nowrap', lineHeight: '1.2' }}>{selectedFiscalYearText}</p>
                        <p className="text-slate-600 text-[11px]" style={{ whiteSpace: 'nowrap', lineHeight: '1.2' }}>{selectedPeriodDisplay}</p>
                      </div>
                    </div>
                  )}

                  {/* Ledger Table */}
                  <table 
                    className="w-full text-center border-collapse"
                    style={{ 
                      border: '1.5px solid #000000', 
                      fontSize: '12.5px',
                      lineHeight: '1.2',
                      fontFamily: 'Sarabun'
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: '#f3f4f6', fontFamily: 'Sarabun' }}>
                        <th rowSpan={2} style={{ border: '1px solid #000000', padding: '5px 4px', width: '75px', fontFamily: 'Sarabun' }}>วัน เดือน ปี</th>
                        <th rowSpan={2} style={{ border: '1px solid #000000', padding: '5px 4px', width: '105px', fontFamily: 'Sarabun' }}>เลขที่เอกสาร</th>
                        <th rowSpan={2} style={{ border: '1px solid #000000', padding: '5px 6px', textAlign: 'left', fontFamily: 'Sarabun' }}>รายการ / แหล่งที่มา-ผู้เบิก</th>
                        <th rowSpan={2} style={{ border: '1px solid #000000', padding: '5px 4px', width: '65px', fontFamily: 'Sarabun' }}>ราคา/หน่วย</th>
                        <th colSpan={2} style={{ border: '1px solid #000000', padding: '3px 4px', width: '120px', fontFamily: 'Sarabun' }}>รับ</th>
                        <th colSpan={2} style={{ border: '1px solid #000000', padding: '3px 4px', width: '120px', fontFamily: 'Sarabun' }}>จ่าย</th>
                        <th colSpan={2} style={{ border: '1px solid #000000', padding: '3px 4px', width: '130px', fontFamily: 'Sarabun' }}>คงเหลือ</th>
                        <th rowSpan={2} style={{ border: '1px solid #000000', padding: '5px 4px', width: '90px', fontFamily: 'Sarabun' }}>ผู้บันทึก</th>
                        <th rowSpan={2} style={{ border: '1px solid #000000', padding: '5px 4px', width: '85px', fontFamily: 'Sarabun' }}>หมายเหตุ</th>
                      </tr>
                      <tr style={{ backgroundColor: '#f9fafb', fontFamily: 'Sarabun' }}>
                        <th style={{ border: '1px solid #000000', padding: '3px 2px', width: '50px', fontFamily: 'Sarabun' }}>จำนวน</th>
                        <th style={{ border: '1px solid #000000', padding: '3px 2px', width: '70px', fontFamily: 'Sarabun' }}>มูลค่า (฿)</th>
                        <th style={{ border: '1px solid #000000', padding: '3px 2px', width: '50px', fontFamily: 'Sarabun' }}>จำนวน</th>
                        <th style={{ border: '1px solid #000000', padding: '3px 2px', width: '70px', fontFamily: 'Sarabun' }}>มูลค่า (฿)</th>
                        <th style={{ border: '1px solid #000000', padding: '3px 2px', width: '55px', fontFamily: 'Sarabun' }}>จำนวน</th>
                        <th style={{ border: '1px solid #000000', padding: '3px 2px', width: '75px', fontFamily: 'Sarabun' }}>มูลค่า (฿)</th>
                      </tr>
                    </thead>
                    <tbody style={{ fontFamily: 'Sarabun' }}>
                      {/* For page 2+, first row is Brought Forward from previous page */}
                      {!isFirstPage && (
                        <tr style={{ backgroundColor: '#fffbeb', fontFamily: 'Sarabun', fontWeight: 'bold' }}>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'center' }}>-</td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'center' }}>ยอดยกมา</td>
                          <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'left' }}>
                            ยอดยกมาจากแผ่นที่ {pageIdx}
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'right' }}>
                            {((material.unitPrice || 0)).toLocaleString()}
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px' }}>-</td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'right' }}>-</td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px' }}>-</td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'right' }}>-</td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px', backgroundColor: '#fef3c7' }}>
                            {prevEndBalance}
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'right', backgroundColor: '#fef3c7' }}>
                            {(prevEndBalance * (material.unitPrice || 0)).toLocaleString()}
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px', fontSize: '11px' }}>-</td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px', fontSize: '11px', textAlign: 'left' }}>
                            ยอดยกมาจากแผ่นที่ {pageIdx}
                          </td>
                        </tr>
                      )}

                      {/* Chunk Rows */}
                      {chunk.length === 0 ? (
                        <tr>
                          <td colSpan={12} style={{ border: '1px solid #000000', padding: '24px 8px', textAlign: 'center', color: '#666', fontFamily: 'Sarabun' }}>
                            ไม่มีข้อมูลรายการรับ-จ่ายในช่วงเวลาที่เลือก
                          </td>
                        </tr>
                      ) : (
                        chunk.map((row, rIdx) => {
                          const isBF = row.type === 'BALANCE_FORWARD';
                          const hasIn = row.inQty !== null && row.inQty !== undefined && Number(row.inQty) > 0;
                          const hasOut = row.outQty !== null && row.outQty !== undefined && Number(row.outQty) > 0;
                          const rowInVal = hasIn ? Number(row.inQty) * (row.unitPrice || material.unitPrice || 0) : null;
                          const rowOutVal = hasOut ? Number(row.outQty) * (row.unitPrice || material.unitPrice || 0) : null;

                          return (
                            <tr 
                              key={row.id || rIdx}
                              style={{ 
                                backgroundColor: isBF ? '#fffbeb' : rIdx % 2 === 0 ? '#ffffff' : '#fafafa',
                                fontFamily: 'Sarabun'
                              }}
                            >
                              <td style={{ border: '1px solid #000000', padding: '3px 4px', whiteSpace: 'nowrap', fontFamily: 'Sarabun' }}>
                                {formatThaiDate(row.date)}
                              </td>
                              <td style={{ border: '1px solid #000000', padding: '3px 4px', fontFamily: 'Sarabun', fontSize: '11px', fontWeight: isBF ? 'bold' : 'normal' }}>
                                {row.docNo}
                              </td>
                              <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'left', fontWeight: isBF ? 'bold' : 'normal', fontFamily: 'Sarabun' }}>
                                {row.description}
                              </td>
                              <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'right', fontFamily: 'Sarabun' }}>
                                {((row.unitPrice || material.unitPrice || 0)).toLocaleString()}
                              </td>
                              {/* รับ */}
                              <td style={{ border: '1px solid #000000', padding: '3px 4px', fontWeight: 'bold', fontFamily: 'Sarabun' }}>
                                {hasIn ? `+${row.inQty}` : '-'}
                              </td>
                              <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'right', fontFamily: 'Sarabun' }}>
                                {rowInVal !== null ? rowInVal.toLocaleString() : '-'}
                              </td>
                              {/* จ่าย */}
                              <td style={{ border: '1px solid #000000', padding: '3px 4px', fontWeight: 'bold', fontFamily: 'Sarabun' }}>
                                {hasOut ? `-${row.outQty}` : '-'}
                              </td>
                              <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'right', fontFamily: 'Sarabun' }}>
                                {rowOutVal !== null ? rowOutVal.toLocaleString() : '-'}
                              </td>
                              {/* คงเหลือ */}
                              <td style={{ border: '1px solid #000000', padding: '3px 4px', fontWeight: 'bold', backgroundColor: '#fef3c7', fontFamily: 'Sarabun' }}>
                                {row.balanceQty}
                              </td>
                              <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'right', fontWeight: 'bold', backgroundColor: '#fef3c7', fontFamily: 'Sarabun' }}>
                                {(row.balanceValuation || (row.balanceQty * (material.unitPrice || 0))).toLocaleString()}
                              </td>
                              <td style={{ border: '1px solid #000000', padding: '3px 4px', fontSize: '11px', fontFamily: 'Sarabun' }}>
                                {cleanOfficerName(row.officer)}
                              </td>
                              <td style={{ border: '1px solid #000000', padding: '3px 4px', fontSize: '11px', textAlign: 'left', fontFamily: 'Sarabun' }}>
                                {row.note || '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}

                      {/* Transfer forward row if there is a next page */}
                      {!isLastPage && (
                        <tr style={{ backgroundColor: '#fef3c7', fontWeight: 'bold', fontFamily: 'Sarabun' }}>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'center' }}>-</td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'center' }}>ยอดยกไป</td>
                          <td style={{ border: '1px solid #000000', padding: '3px 6px', textAlign: 'left' }}>
                            ยอดยกไปต่อแผ่นที่ {pageNumber + 1}
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'right' }}>
                            {((material.unitPrice || 0)).toLocaleString()}
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px' }}>-</td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'right' }}>-</td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px' }}>-</td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'right' }}>-</td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px', backgroundColor: '#fde68a' }}>
                            {currentEndBalance}
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'right', backgroundColor: '#fde68a' }}>
                            {(currentEndBalance * (material.unitPrice || 0)).toLocaleString()}
                          </td>
                          <td colSpan={2} style={{ border: '1px solid #000000', padding: '3px 4px', textAlign: 'center', fontSize: '11px' }}>
                            (ต่อแผ่นที่ {pageNumber + 1})
                          </td>
                        </tr>
                      )}

                      {/* Total Summary Row on LAST PAGE only */}
                      {isLastPage && (
                        <tr style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', fontFamily: 'Sarabun' }}>
                          <td colSpan={4} style={{ border: '1px solid #000000', padding: '5px 8px', textAlign: 'center', fontFamily: 'Sarabun' }}>
                            รวมทั้งสิ้น (ยอดยกมา {broughtForwardQty} {material.unit})
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '5px 4px', fontFamily: 'Sarabun' }}>
                            {periodInQty > 0 ? `+${periodInQty}` : '-'}
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '5px 4px', textAlign: 'right', fontFamily: 'Sarabun' }}>
                            {periodInQty > 0 ? (periodInQty * (material.unitPrice || 0)).toLocaleString() : '-'}
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '5px 4px', fontFamily: 'Sarabun' }}>
                            {periodOutQty > 0 ? `-${periodOutQty}` : '-'}
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '5px 4px', textAlign: 'right', fontFamily: 'Sarabun' }}>
                            {periodOutQty > 0 ? (periodOutQty * (material.unitPrice || 0)).toLocaleString() : '-'}
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '5px 4px', backgroundColor: '#fde68a', fontFamily: 'Sarabun' }}>
                            {runningBalance}
                          </td>
                          <td style={{ border: '1px solid #000000', padding: '5px 4px', textAlign: 'right', backgroundColor: '#fde68a', fontFamily: 'Sarabun' }}>
                            {(runningBalance * (material.unitPrice || 0)).toLocaleString()}
                          </td>
                          <td colSpan={2} style={{ border: '1px solid #000000', padding: '5px 4px', fontFamily: 'Sarabun' }}>
                            หน่วย: {material.unit}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Signature Footer on LAST PAGE only */}
                  {isLastPage ? (
                    <div className="avoid-break mt-6 pt-2 grid grid-cols-2 gap-8 text-center text-xs" style={{ fontSize: '13px', fontFamily: 'Sarabun' }}>
                      {/* ผู้บันทึก */}
                      <div 
                        onClick={() => isAdmin && handleOpenSignerModal('recorder')}
                        className={`signer-box-interactive relative p-3 rounded-xl transition shadow-2xs text-black ${isAdmin ? 'group cursor-pointer border border-amber-300/80 bg-amber-50/50 hover:bg-amber-100/70 hover:border-amber-500' : 'border border-slate-200 bg-white'}`}
                        style={{ fontFamily: 'Sarabun' }}
                        title={isAdmin ? "คลิกเพื่อแก้ไขชื่อ/ตำแหน่งผู้บันทึก หรือกดปุ่มบริหารจัดการด้านบน" : undefined}
                      >
                        {isAdmin && (
                          <div className="no-print absolute -top-2.5 right-2 bg-amber-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 group-hover:scale-105 transition">
                            <Edit3 className="w-3 h-3" />
                            <span>กำหนดชื่อ/ตำแหน่ง</span>
                          </div>
                        )}
                        <p className="mb-8" style={{ fontFamily: 'Sarabun' }}>ลงชื่อ.............................................................. ผู้บันทึก</p>
                        <p className="font-semibold text-black" style={{ fontFamily: 'Sarabun' }}>
                          <span className={`print-clean-highlight px-1.5 py-0.5 rounded inline-block ${isAdmin ? 'bg-amber-100/90 border border-amber-300' : ''}`}>
                            ({cleanSignerDisplay(signers.recorderName)})
                          </span>
                        </p>
                        <p className="text-slate-700 mt-1" style={{ fontFamily: 'Sarabun' }}>
                          <span className={`print-clean-highlight px-1.5 py-0.5 rounded inline-block ${isAdmin ? 'bg-amber-100/90 border border-amber-300' : ''}`}>
                            {signers.recorderPosition}
                          </span>
                        </p>
                        <p className="text-slate-500 text-[11px] mt-1" style={{ fontFamily: 'Sarabun' }}>
                          {signers.recorderDate}
                        </p>
                      </div>

                      {/* ผู้ตรวจสอบ */}
                      <div 
                        onClick={() => isAdmin && handleOpenSignerModal('checker')}
                        className={`signer-box-interactive relative p-3 rounded-xl transition shadow-2xs text-black ${isAdmin ? 'group cursor-pointer border border-amber-300/80 bg-amber-50/50 hover:bg-amber-100/70 hover:border-amber-500' : 'border border-slate-200 bg-white'}`}
                        style={{ fontFamily: 'Sarabun' }}
                        title={isAdmin ? "คลิกเพื่อแก้ไขชื่อ/ตำแหน่งผู้ตรวจสอบ หรือกดปุ่มบริหารจัดการด้านบน" : undefined}
                      >
                        {isAdmin && (
                          <div className="no-print absolute -top-2.5 right-2 bg-amber-500 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 group-hover:scale-105 transition">
                            <Edit3 className="w-3 h-3" />
                            <span>กำหนดชื่อ/ตำแหน่ง</span>
                          </div>
                        )}
                        <p className="mb-8" style={{ fontFamily: 'Sarabun' }}>ลงชื่อ.............................................................. ผู้ตรวจสอบ</p>
                        <p className="font-semibold text-black" style={{ fontFamily: 'Sarabun' }}>
                          <span className={`print-clean-highlight px-1.5 py-0.5 rounded inline-block ${isAdmin ? 'bg-amber-100/90 border border-amber-300' : ''}`}>
                            ({cleanSignerDisplay(signers.checkerName)})
                          </span>
                        </p>
                        <p className="text-slate-700 mt-1" style={{ fontFamily: 'Sarabun' }}>
                          <span className={`print-clean-highlight px-1.5 py-0.5 rounded inline-block ${isAdmin ? 'bg-amber-100/90 border border-amber-300' : ''}`}>
                            {signers.checkerPosition}
                          </span>
                        </p>
                        <p className="text-slate-500 text-[11px] mt-1" style={{ fontFamily: 'Sarabun' }}>
                          {signers.checkerDate}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Note at bottom of non-last page */
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500" style={{ fontFamily: 'Sarabun', fontSize: '11.5px' }}>
                      <span>สมุดคุมบัญชีพัสดุ วิทยาลัยการเมืองการปกครอง มหาวิทยาลัยมหาสารคาม</span>
                      <span className="font-semibold text-amber-700">--- โปรดอ่านต่อแผ่นที่ {pageNumber + 1} ---</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Print Media Style */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          .stockcard-modal-backdrop {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .signer-box-interactive {
            border: none !important;
            background: transparent !important;
            background-color: transparent !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          .print-clean-highlight {
            background: transparent !important;
            background-color: transparent !important;
            border: none !important;
            padding: 0 !important;
          }
          .stockcard-meta-subtitle, .stockcard-meta-subtitle *,
          .stockcard-continuation-header, .stockcard-continuation-header * {
            white-space: nowrap !important;
          }
        }
      `}} />

      {/* Signer Management Modal - Only accessible by Admin */}
      {isAdmin && isSignerModalOpen && (
        <StockCardSignerModal
          isOpen={isSignerModalOpen}
          onClose={() => setIsSignerModalOpen(false)}
          signers={signers}
          onSave={handleSaveSigners}
          systemUsers={systemUsers}
          defaultAdminName={effectiveAdminName}
          focusRole={focusRole}
        />
      )}
    </div>
  );
};
