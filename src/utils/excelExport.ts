import * as XLSX from 'xlsx';
import { Material, Order, StockIn, BatchStockInItem } from '../types';

/**
 * Format a date string (YYYY-MM-DD) into Thai readable date (e.g. 29 ก.ย. 2568)
 */
function formatThaiDateShort(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const thMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${d.getDate()} ${thMonths[d.getMonth()]} ${d.getFullYear() + 543}`;
  } catch {
    return dateStr;
  }
}

/**
 * 1. Export Material Registry (ทะเบียนพัสดุ) to Excel (.xlsx)
 */
export function exportMaterialsToExcel(materials: Material[], filename = 'ทะเบียนพัสดุ_วิทยาลัยการเมืองการปกครอง_มมส'): void {
  const wb = XLSX.utils.book_new();

  const dataRows = materials.map((m, idx) => ({
    'ลำดับ': m.no || idx + 1,
    'รหัสพัสดุ': m.id,
    'ชื่อพัสดุ': m.name,
    'หมวดหมู่': m.category,
    'หน่วยนับ': m.unit,
    'ราคาต่อหน่วย (บาท)': m.unitPrice,
    'ยอดคงคลังปัจจุบัน': m.currentStock,
    'ยอดจัดซื้อสะสม': m.purchaseQty || 0,
    'มูลค่าจัดซื้อสะสม (บาท)': m.totalPurchaseCost || (m.unitPrice * (m.purchaseQty || m.currentStock)),
    'ยอดเบิกจ่ายสะสม': m.totalWithdrawn || 0,
    'จุดสั่งซื้อขั้นต่ำ (Safety Stock)': m.minQty,
    'ปริมาณสูงสุดที่ควรมี': m.maxQty,
    'สถานะสต็อก': m.refillStatus,
    'สถานะการใช้งาน': m.usageStatus || 'ประจำ',
    'สถานที่จัดเก็บ': m.location || 'ห้องพัสดุวิทยาลัยการเมืองการปกครอง',
    'อัปเดตล่าสุด': m.lastUpdated ? formatThaiDateShort(m.lastUpdated) : '-'
  }));

  const ws = XLSX.utils.json_to_sheet(dataRows);

  // Column widths
  ws['!cols'] = [
    { wch: 8 },  // ลำดับ
    { wch: 14 }, // รหัสพัสดุ
    { wch: 40 }, // ชื่อพัสดุ
    { wch: 22 }, // หมวดหมู่
    { wch: 10 }, // หน่วยนับ
    { wch: 18 }, // ราคาต่อหน่วย
    { wch: 18 }, // ยอดคงคลังปัจจุบัน
    { wch: 16 }, // ยอดจัดซื้อสะสม
    { wch: 22 }, // มูลค่าจัดซื้อสะสม
    { wch: 16 }, // ยอดเบิกจ่ายสะสม
    { wch: 22 }, // จุดสั่งซื้อขั้นต่ำ
    { wch: 20 }, // ปริมาณสูงสุด
    { wch: 14 }, // สถานะสต็อก
    { wch: 14 }, // สถานะการใช้งาน
    { wch: 35 }, // สถานที่จัดเก็บ
    { wch: 16 }  // อัปเดตล่าสุด
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'ทะเบียนพัสดุ');

  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${filename}_${todayStr}.xlsx`);
}

/**
 * 2. Export Orders / Requisitions (ใบเบิกจ่ายพัสดุ) to Excel (.xlsx)
 * Contains 2 worksheets:
 * Sheet 1: สรุปใบเบิกจ่ายพัสดุ
 * Sheet 2: รายละเอียดรายการพัสดุที่เบิก
 */
export function exportOrdersToExcel(orders: Order[], filename = 'รายงานใบเบิกจ่ายพัสดุ_วิทยาลัยการเมืองการปกครอง'): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Orders summary
  const summaryRows = orders.map((o, idx) => ({
    'ลำดับ': idx + 1,
    'เลขที่ใบเบิก': o.docNo,
    'วันที่ขอเบิก': formatThaiDateShort(o.date),
    'ชื่อผู้ขอเบิก': o.requesterName,
    'ตำแหน่งผู้ขอเบิก': o.requesterPosition || '-',
    'หน่วยงาน / กลุ่มงาน': o.department,
    'วัตถุประสงค์การใช้': o.purpose,
    'สถานะใบเบิก': o.status,
    'จำนวนรายการ (ชนิด)': o.items.length,
    'ปริมาณรวม (หน่วย)': o.totalItems || o.items.reduce((s, i) => s + i.quantity, 0),
    'มูลค่ารวมทั้งสิ้น (บาท)': o.totalAmount || o.items.reduce((s, i) => s + i.totalPrice, 0),
    'ผู้อนุมัติ': o.approverName || '-',
    'ตำแหน่งผู้อนุมัติ': o.approverPosition || '-',
    'วันที่เบิกจ่าย': o.disbursedDate ? formatThaiDateShort(o.disbursedDate) : '-',
    'ผู้จ่ายพัสดุ': o.disburserName || '-'
  }));

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 8 },  // ลำดับ
    { wch: 18 }, // เลขที่ใบเบิก
    { wch: 16 }, // วันที่ขอเบิก
    { wch: 26 }, // ชื่อผู้ขอเบิก
    { wch: 24 }, // ตำแหน่งผู้ขอเบิก
    { wch: 28 }, // หน่วยงาน
    { wch: 35 }, // วัตถุประสงค์
    { wch: 14 }, // สถานะ
    { wch: 18 }, // จำนวนรายการ
    { wch: 18 }, // ปริมาณรวม
    { wch: 22 }, // มูลค่ารวม
    { wch: 26 }, // ผู้อนุมัติ
    { wch: 28 }, // ตำแหน่งผู้อนุมัติ
    { wch: 16 }, // วันที่เบิกจ่าย
    { wch: 26 }  // ผู้จ่ายพัสดุ
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปใบเบิกจ่าย');

  // Sheet 2: Detailed Line Items
  const detailRows: any[] = [];
  let itemCounter = 1;
  orders.forEach(o => {
    o.items.forEach(item => {
      detailRows.push({
        'ลำดับ': itemCounter++,
        'เลขที่ใบเบิก': o.docNo,
        'วันที่ขอเบิก': formatThaiDateShort(o.date),
        'สถานะใบเบิก': o.status,
        'ผู้ขอเบิก': o.requesterName,
        'หน่วยงาน': o.department,
        'รหัสพัสดุ': item.materialId,
        'ชื่อพัสดุ': item.materialName,
        'หมวดหมู่': item.category,
        'จำนวนที่เบิก': item.quantity,
        'หน่วยนับ': item.unit,
        'ราคาต่อหน่วย (บาท)': item.unitPrice,
        'ราคารวม (บาท)': item.totalPrice,
        'วัตถุประสงค์': o.purpose
      });
    });
  });

  const wsDetail = XLSX.utils.json_to_sheet(detailRows);
  wsDetail['!cols'] = [
    { wch: 8 },  // ลำดับ
    { wch: 18 }, // เลขที่ใบเบิก
    { wch: 16 }, // วันที่
    { wch: 14 }, // สถานะ
    { wch: 24 }, // ผู้ขอเบิก
    { wch: 24 }, // หน่วยงาน
    { wch: 14 }, // รหัสพัสดุ
    { wch: 38 }, // ชื่อพัสดุ
    { wch: 20 }, // หมวดหมู่
    { wch: 14 }, // จำนวนที่เบิก
    { wch: 10 }, // หน่วยนับ
    { wch: 18 }, // ราคาต่อหน่วย
    { wch: 18 }, // ราคารวม
    { wch: 30 }  // วัตถุประสงค์
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'รายการพัสดุที่เบิก');

  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${filename}_${todayStr}.xlsx`);
}

/**
 * 3. Export Single Requisition Form (ใบเบิกจ่ายพัสดุเดี่ยว) to Excel
 */
export function exportSingleRequisitionToExcel(order: Order): void {
  const wb = XLSX.utils.book_new();

  const titleRows: any[][] = [
    ['วิทยาลัยการเมืองการปกครอง มหาวิทยาลัยมหาสารคาม'],
    ['ใบเบิกจ่ายพัสดุ'],
    [''],
    ['เลขที่เอกสาร:', order.docNo, 'วันที่ขอเบิก:', formatThaiDateShort(order.date)],
    ['ชื่อผู้ขอเบิก:', order.requesterName, 'ตำแหน่ง:', order.requesterPosition || '-'],
    ['หน่วยงาน/สังกัด:', order.department, 'สถานะ:', order.status],
    ['วัตถุประสงค์:', order.purpose],
    [''],
    ['รายการพัสดุที่ขอเบิก'],
    ['ลำดับ', 'รหัสพัสดุ', 'รายการพัสดุ', 'หมวดหมู่', 'จำนวนที่ขอเบิก', 'หน่วยนับ', 'ราคา/หน่วย (บาท)', 'จำนวนเงิน (บาท)']
  ];

  order.items.forEach((item, idx) => {
    titleRows.push([
      idx + 1,
      item.materialId,
      item.materialName,
      item.category,
      item.quantity,
      item.unit,
      item.unitPrice,
      item.totalPrice
    ]);
  });

  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = order.items.reduce((s, i) => s + i.totalPrice, 0);

  titleRows.push(['', '', 'รวมทั้งสิ้น', '', totalQty, 'หน่วย', '', totalAmount]);
  titleRows.push(['']);
  titleRows.push(['ข้อมูลผู้ลงนาม']);
  titleRows.push(['ผู้ขอเบิก:', order.requesterName, 'ตำแหน่ง:', order.requesterPosition || '-']);
  titleRows.push(['ผู้อนุมัติ:', order.approverName || '-', 'ตำแหน่ง:', order.approverPosition || '-']);
  titleRows.push(['ผู้จ่ายพัสดุ:', order.disburserName || '-', 'วันที่จ่าย:', order.disbursedDate ? formatThaiDateShort(order.disbursedDate) : '-']);

  const ws = XLSX.utils.aoa_to_sheet(titleRows);
  ws['!cols'] = [
    { wch: 8 },  // ลำดับ
    { wch: 16 }, // รหัสพัสดุ
    { wch: 38 }, // รายการพัสดุ
    { wch: 20 }, // หมวดหมู่
    { wch: 16 }, // จำนวน
    { wch: 12 }, // หน่วยนับ
    { wch: 18 }, // ราคาต่อหน่วย
    { wch: 20 }  // ราคารวม
  ];

  XLSX.utils.book_append_sheet(wb, ws, `ใบเบิก_${order.docNo.replace(/[/\\?%*:|"<>]/g, '-')}`);
  XLSX.writeFile(wb, `ใบเบิกพัสดุ_${order.docNo.replace(/[/\\?%*:|"<>]/g, '-')}.xlsx`);
}

/**
 * 4. Export Batch Stock-In (รับพัสดุเข้าคลัง ชุด / ประวัติการรับเข้า) to Excel (.xlsx)
 */
export function exportBatchStockInToExcel(
  stockInLogs: StockIn[], 
  materialsMap?: Map<string, Material>,
  filename = 'ประวัติรับพัสดุเข้าคลัง_วิทยาลัยการเมืองการปกครอง'
): void {
  const wb = XLSX.utils.book_new();

  const rows = stockInLogs.map((log, idx) => {
    const mat = materialsMap?.get(log.materialId);
    return {
      'ลำดับ': idx + 1,
      'วันที่รับเข้า': formatThaiDateShort(log.date),
      'เลขที่ใบส่งของ / PO': log.docNo,
      'เลขที่ใบผูกพัน': log.obligationNo || '-',
      'แหล่งเงินงบประมาณ': log.budgetType || 'เงินราย',
      'รหัสพัสดุ': log.materialId,
      'ชื่อพัสดุ': log.materialName,
      'หมวดหมู่': log.category,
      'จำนวนที่รับเข้า': log.quantity,
      'หน่วยนับ': log.unit,
      'ราคาต่อหน่วย (บาท)': log.unitPrice,
      'ราคารวม (บาท)': log.totalPrice,
      'บริษัท / ร้านค้าผู้จัดส่ง': log.supplier,
      'ผู้ตรวจรับพัสดุ': log.receiverName,
      'สต็อกคงเหลือปัจจุบันในทะเบียน': mat ? `${mat.currentStock} ${log.unit}` : '-',
      'หมายเหตุ': log.note || '-'
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 8 },  // ลำดับ
    { wch: 16 }, // วันที่รับเข้า
    { wch: 22 }, // เลขที่ PO
    { wch: 18 }, // เลขที่ใบผูกพัน
    { wch: 16 }, // แหล่งเงิน
    { wch: 14 }, // รหัสพัสดุ
    { wch: 40 }, // ชื่อพัสดุ
    { wch: 22 }, // หมวดหมู่
    { wch: 16 }, // จำนวนที่รับ
    { wch: 10 }, // หน่วยนับ
    { wch: 18 }, // ราคาต่อหน่วย
    { wch: 20 }, // ราคารวม
    { wch: 32 }, // ร้านค้า/ผู้จัดส่ง
    { wch: 26 }, // ผู้ตรวจรับ
    { wch: 28 }, // สต็อกคงเหลือปัจจุบัน
    { wch: 35 }  // หมายเหตุ
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'ประวัติรับพัสดุเข้าคลัง');

  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${filename}_${todayStr}.xlsx`);
}

/**
 * 5. Export Batch Entry Draft (รายการรับเข้าพัสดุชุดที่กำลังกรอก) to Excel
 */
export function exportBatchEntryDraftToExcel(
  docNo: string,
  date: string,
  supplier: string,
  receiverName: string,
  obligationNo: string,
  budgetType: string,
  note: string,
  items: BatchStockInItem[]
): void {
  const wb = XLSX.utils.book_new();

  const titleRows: any[][] = [
    ['วิทยาลัยการเมืองการปกครอง มหาวิทยาลัยมหาสารคาม'],
    ['รายการรับพัสดุเข้าคลัง (ชุด) / Batch Stock-In Entry'],
    [''],
    ['เลขที่ใบส่งของ/PO:', docNo, 'วันที่ตรวจรับ:', formatThaiDateShort(date)],
    ['เลขที่ใบผูกพัน:', obligationNo || '-', 'แหล่งเงิน:', budgetType || 'เงินราย'],
    ['บริษัท/ผู้จัดส่ง:', supplier, 'ผู้ตรวจรับ:', receiverName],
    ['หมายเหตุ:', note || '-'],
    [''],
    ['รายการพัสดุที่รับเข้า'],
    ['ลำดับ', 'รหัสพัสดุ', 'รายการพัสดุ', 'หมวดหมู่', 'จำนวนรับเข้า', 'หน่วยนับ', 'ราคา/หน่วย (บาท)', 'ราคารวม (บาท)', 'หมายเหตุ']
  ];

  items.forEach((item, idx) => {
    titleRows.push([
      idx + 1,
      item.materialId,
      item.materialName,
      item.category,
      item.quantity,
      item.unit,
      item.unitPrice,
      item.totalPrice,
      item.note || '-'
    ]);
  });

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = items.reduce((s, i) => s + i.totalPrice, 0);

  titleRows.push(['', '', 'รวมทั้งสิ้น', '', totalQty, 'หน่วย', '', totalAmount, '']);

  const ws = XLSX.utils.aoa_to_sheet(titleRows);
  ws['!cols'] = [
    { wch: 8 },  // ลำดับ
    { wch: 14 }, // รหัสพัสดุ
    { wch: 38 }, // ชื่อพัสดุ
    { wch: 20 }, // หมวดหมู่
    { wch: 16 }, // จำนวน
    { wch: 10 }, // หน่วยนับ
    { wch: 18 }, // ราคาต่อหน่วย
    { wch: 20 }, // ราคารวม
    { wch: 30 }  // หมายเหตุ
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'รายการรับเข้าชุด');
  XLSX.writeFile(wb, `รับพัสดุเข้าชุด_${docNo.replace(/[/\\?%*:|"<>]/g, '-')}.xlsx`);
}

/**
 * 6. Export Official Stock Card (สมุดคุมบัญชีพัสดุ) to Excel (.xlsx)
 */
export function exportStockCardToExcel(
  material: Material,
  rows: Array<{
    date: string;
    docNo: string;
    description: string;
    inQty?: number;
    inPrice?: number;
    inTotal?: number;
    outQty?: number;
    outPrice?: number;
    outTotal?: number;
    balanceQty: number;
    balanceValuation: number;
    officer: string;
    note?: string;
  }>,
  fiscalYear?: string
): void {
  const wb = XLSX.utils.book_new();

  const titleRows: any[][] = [
    ['วิทยาลัยการเมืองการปกครอง มหาวิทยาลัยมหาสารคาม'],
    ['สมุดคุมบัญชีพัสดุ (Stock Card)'],
    [`พัสดุ: [${material.id}] ${material.name}`, `หมวดหมู่: ${material.category}`, `หน่วยนับ: ${material.unit}`],
    [`ราคาต่อหน่วย: ${material.unitPrice} บาท`, `สถานที่จัดเก็บ: ${material.location || 'ห้องพัสดุ'}`, `ปีงบประมาณ: ${fiscalYear && fiscalYear !== 'all' ? fiscalYear : 'ทั้งหมด'}`],
    [''],
    [
      'วัน เดือน ปี',
      'รับจาก/จ่ายให้',
      'เลขที่เอกสาร',
      'จำนวนรับ',
      'ราคา/หน่วยรับ (บาท)',
      'ราคารวมรับ (บาท)',
      'จำนวนจ่าย',
      'ราคา/หน่วยจ่าย (บาท)',
      'ราคารวมจ่าย (บาท)',
      'คงเหลือ (จำนวน)',
      'คงเหลือ (มูลค่าบาท)',
      'ผู้ลงนาม / จนท.',
      'หมายเหตุ'
    ]
  ];

  rows.forEach(r => {
    titleRows.push([
      formatThaiDateShort(r.date),
      r.description,
      r.docNo,
      r.inQty !== undefined ? r.inQty : '',
      r.inPrice !== undefined ? r.inPrice : '',
      r.inTotal !== undefined ? r.inTotal : '',
      r.outQty !== undefined ? r.outQty : '',
      r.outPrice !== undefined ? r.outPrice : '',
      r.outTotal !== undefined ? r.outTotal : '',
      r.balanceQty,
      r.balanceValuation,
      r.officer || '-',
      r.note || ''
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(titleRows);
  ws['!cols'] = [
    { wch: 16 }, // วันที่
    { wch: 32 }, // รับจาก/จ่ายให้
    { wch: 22 }, // เลขที่เอกสาร
    { wch: 12 }, // จำนวนรับ
    { wch: 18 }, // ราคา/หน่วยรับ
    { wch: 18 }, // ราคารวมรับ
    { wch: 12 }, // จำนวนจ่าย
    { wch: 18 }, // ราคา/หน่วยจ่าย
    { wch: 18 }, // ราคารวมจ่าย
    { wch: 14 }, // คงเหลือ
    { wch: 18 }, // มูลค่าคงเหลือ
    { wch: 24 }, // ผู้ลงนาม
    { wch: 28 }  // หมายเหตุ
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'สมุดคุมบัญชีพัสดุ');
  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `StockCard_${material.id}_${todayStr}.xlsx`);
}
