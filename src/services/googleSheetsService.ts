import { auth, GoogleAuthProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { Material, Order, StockIn, StockOut } from '../types';

export const SPREADSHEET_TITLE = 'ระบบสารสนเทศเบิกจ่ายพัสดุ วิทยาลัยการเมืองการปกครอง';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];

// In-memory token cache (Do NOT store in localStorage per security guidelines)
let cachedAccessToken: string | null = null;
let cachedSpreadsheetInfo: { id: string; url: string; title: string } | null = null;

export const GoogleSheetsService = {
  // Clear cached token on sign-out
  clearToken() {
    cachedAccessToken = null;
    cachedSpreadsheetInfo = null;
  },

  // Get or request OAuth access token
  async getAccessToken(interactive: boolean = true): Promise<string> {
    if (cachedAccessToken) {
      return cachedAccessToken;
    }

    if (!interactive) {
      throw new Error('NO_TOKEN');
    }

    if (!auth) {
      throw new Error('ระบบยืนยันตัวตนยังไม่พร้อมใช้งาน');
    }

    const provider = new GoogleAuthProvider();
    SCOPES.forEach(scope => provider.addScope(scope));
    provider.setCustomParameters({
      prompt: 'consent'
    });

    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('ไม่ได้รับ Access Token สำหรับการเข้าถึง Google Sheets & Drive');
      }

      cachedAccessToken = credential.accessToken;
      return cachedAccessToken;
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed-by-user')) {
        throw new Error('หน้าต่างยืนยันตัวตน Google ถูกปิดก่อนทำรายการเสร็จ กรุณากดปุ่มอีกครั้งและเลือกบัญชี Google เพื่ออนุญาตสิทธิ์');
      }
      if (err?.code === 'auth/popup-blocked' || err?.message?.includes('popup-blocked')) {
        throw new Error('เบราว์เซอร์บล็อกหน้าต่างป็อปอัป (Popup Blocked) กรุณากดอนุญาตป็อปอัปในแถบที่อยู่เว็บแล้วลองใหม่อีกครั้ง');
      }
      if (err?.code === 'auth/cancelled-popup-request') {
        throw new Error('มีคำขอยืนยันตัวตนเปิดอยู่แล้ว กรุณารอสักครู่แล้วลองใหม่อีกครั้ง');
      }
      throw err;
    }
  },

  // Ensure the 4 required sheets exist in the spreadsheet
  async ensureSheetsExist(token: string, spreadsheetId: string): Promise<void> {
    try {
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!metaRes.ok) return;

      const metaData = await metaRes.json();
      const existingTitles = ((metaData.sheets as any[]) || []).map(s => s.properties?.title);
      const requiredSheets = ['ทะเบียนพัสดุ', 'รายการใบเบิก', 'ประวัติรับเข้า', 'ประวัติจ่ายออก'];
      const missingSheets = requiredSheets.filter(t => !existingTitles.includes(t));

      if (missingSheets.length > 0) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: missingSheets.map(title => ({
              addSheet: {
                properties: {
                  title,
                  gridProperties: { frozenRowCount: 1 }
                }
              }
            }))
          })
        });
      }
    } catch (err) {
      console.warn('Note: sheet check skipped or not needed', err);
    }
  },

  // Find or create the target spreadsheet
  async findOrCreateSpreadsheet(token: string): Promise<{ id: string; url: string; title: string }> {
    if (cachedSpreadsheetInfo) {
      return cachedSpreadsheetInfo;
    }

    // 1. Search Google Drive for existing spreadsheet with this exact name
    const query = encodeURIComponent(`name = '${SPREADSHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)&pageSize=5`;
    
    try {
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          const found = searchData.files[0];
          await this.ensureSheetsExist(token, found.id);
          cachedSpreadsheetInfo = {
            id: found.id,
            url: found.webViewLink || `https://docs.google.com/spreadsheets/d/${found.id}/edit`,
            title: found.name
          };
          return cachedSpreadsheetInfo;
        }
      }
    } catch (err) {
      console.warn('Drive search fallback to creation', err);
    }

    // 2. If not found, create a new spreadsheet with the 4 tabs
    const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    const createBody = {
      properties: {
        title: SPREADSHEET_TITLE
      },
      sheets: [
        { properties: { title: 'ทะเบียนพัสดุ', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'รายการใบเบิก', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'ประวัติรับเข้า', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'ประวัติจ่ายออก', gridProperties: { frozenRowCount: 1 } } }
      ]
    };

    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createBody)
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`ไม่สามารถสร้าง Google Sheet ได้: ${errText}`);
    }

    const created = await createRes.json();
    cachedSpreadsheetInfo = {
      id: created.spreadsheetId,
      url: created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
      title: SPREADSHEET_TITLE
    };
    return cachedSpreadsheetInfo;
  },

  // Export & backup all system data to Google Sheet
  async backupToGoogleSheet(
    materials: Material[],
    orders: Order[],
    stockInLogs: StockIn[],
    stockOutLogs: StockOut[],
    interactiveAuth: boolean = true
  ): Promise<{ success: boolean; spreadsheetUrl: string; spreadsheetId: string; stats: any }> {
    const token = await this.getAccessToken(interactiveAuth);
    const sheetInfo = await this.findOrCreateSpreadsheet(token);
    const spreadsheetId = sheetInfo.id;
    await this.ensureSheetsExist(token, spreadsheetId);

    // Build Rows for "ทะเบียนพัสดุ"
    const materialsHeader = [
      'รหัสพัสดุ',
      'ชื่อพัสดุ',
      'หมวดหมู่',
      'ราคาต่อหน่วย (บาท)',
      'คงเหลือสุทธิ',
      'หน่วยนับ',
      'เกณฑ์ต่ำสุด',
      'เกณฑ์สูงสุด',
      'สถานะการใช้งาน',
      'สถานะสต็อก',
      'สถานที่จัดเก็บ',
      'รับเข้าสะสม',
      'เบิกจ่ายสะสม',
      'URLรูปภาพ',
      'อัปเดตล่าสุด'
    ];
    const materialsRows = materials.map(m => [
      m.id,
      m.name,
      m.category,
      m.unitPrice || 0,
      m.currentStock || 0,
      m.unit || 'หน่วย',
      m.minQty || 0,
      m.maxQty || 0,
      m.usageStatus || 'ประจำ',
      m.refillStatus || 'OK',
      m.location || 'ห้องพัสดุวิทยาลัยการเมืองการปกครอง',
      m.purchaseQty || 0,
      m.totalWithdrawn || 0,
      m.imageUrl || '',
      new Date().toLocaleString('th-TH')
    ]);

    // Build Rows for "รายการใบเบิก"
    const ordersHeader = [
      'รหัสคำขอ',
      'เลขที่เอกสาร',
      'วันที่',
      'ชื่อผู้ขอเบิก',
      'อีเมลผู้เบิก',
      'ตำแหน่ง',
      'สังกัด/สาขาวิชา',
      'วัตถุประสงค์',
      'จำนวนรายการ',
      'มูลค่ารวม (บาท)',
      'สถานะใบเบิก',
      'สรุปรายการพัสดุ',
      'วันที่จ่ายพัสดุ',
      'สร้างเมื่อ'
    ];
    const ordersRows = orders.map(o => {
      const itemsSummary = o.items.map(i => `${i.materialName} (${i.quantity} ${i.unit})`).join(', ');
      return [
        o.id,
        o.docNo,
        o.date,
        o.requesterName,
        o.requesterEmail || '',
        o.requesterPosition || '',
        o.department || '',
        o.purpose || '',
        o.totalItems || o.items.reduce((s, i) => s + i.quantity, 0),
        o.totalAmount || 0,
        o.status,
        itemsSummary,
        o.disbursedDate || '',
        o.createdAt || ''
      ];
    });

    // Build Rows for "ประวัติรับเข้า"
    const stockInHeader = [
      'รหัสรายการ',
      'วันที่รับ',
      'เลขที่เอกสาร',
      'รหัสพัสดุ',
      'ชื่อพัสดุ',
      'หมวดหมู่',
      'จำนวนที่รับ',
      'หน่วยนับ',
      'ราคาต่อหน่วย',
      'มูลค่ารวม',
      'แหล่งที่มา/ผู้ขาย',
      'ผู้รับพัสดุ',
      'หมายเหตุ',
      'บันทึกเมื่อ'
    ];
    const stockInRows = stockInLogs.map(item => [
      item.id,
      item.date,
      item.docNo,
      item.materialId,
      item.materialName,
      item.category || '',
      item.quantity,
      item.unit,
      item.unitPrice,
      item.totalPrice,
      item.supplier,
      item.receiverName,
      item.note || '',
      item.createdAt || ''
    ]);

    // Build Rows for "ประวัติจ่ายออก"
    const stockOutHeader = [
      'รหัสรายการ',
      'วันที่จ่าย',
      'เลขที่ใบเบิก',
      'รหัสพัสดุ',
      'ชื่อพัสดุ',
      'หมวดหมู่',
      'จำนวนที่จ่าย',
      'หน่วยนับ',
      'ราคาต่อหน่วย',
      'มูลค่ารวม',
      'ผู้ขอเบิก',
      'สังกัด/แผนก',
      'ผู้จ่ายพัสดุ',
      'หมายเหตุ',
      'บันทึกเมื่อ'
    ];
    const stockOutRows = stockOutLogs.map(item => [
      item.id,
      item.date,
      item.requisitionDocNo,
      item.materialId,
      item.materialName,
      item.category || '',
      item.quantity,
      item.unit,
      item.unitPrice,
      item.totalPrice,
      item.requesterName,
      item.department,
      item.disburserName,
      item.note || '',
      item.createdAt || ''
    ]);

    // Clear and Write batch values
    // Clear old data first
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ranges: ['ทะเบียนพัสดุ!A1:Z5000', 'รายการใบเบิก!A1:Z5000', 'ประวัติรับเข้า!A1:Z5000', 'ประวัติจ่ายออก!A1:Z5000']
      })
    });

    // Write new data
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
    const batchUpdateBody = {
      valueInputOption: 'USER_ENTERED',
      data: [
        {
          range: 'ทะเบียนพัสดุ!A1',
          values: [materialsHeader, ...materialsRows]
        },
        {
          range: 'รายการใบเบิก!A1',
          values: [ordersHeader, ...ordersRows]
        },
        {
          range: 'ประวัติรับเข้า!A1',
          values: [stockInHeader, ...stockInRows]
        },
        {
          range: 'ประวัติจ่ายออก!A1',
          values: [stockOutHeader, ...stockOutRows]
        }
      ]
    };

    const updateRes = await fetch(updateUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(batchUpdateBody)
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      throw new Error(`ไม่สามารถอัปเดตข้อมูลลง Google Sheet ได้: ${errText}`);
    }

    return {
      success: true,
      spreadsheetUrl: sheetInfo.url,
      spreadsheetId,
      stats: {
        materialsCount: materials.length,
        ordersCount: orders.length,
        stockInCount: stockInLogs.length,
        stockOutCount: stockOutLogs.length
      }
    };
  },

  // Import data from Google Sheet
  async importFromGoogleSheet(
    customSpreadsheetId?: string,
    interactiveAuth: boolean = true
  ): Promise<{
    materials: Material[];
    orders: Order[];
    stockInLogs: StockIn[];
    stockOutLogs: StockOut[];
    spreadsheetUrl: string;
  }> {
    const token = await this.getAccessToken(interactiveAuth);
    let targetId = customSpreadsheetId?.trim();
    let targetUrl = '';

    if (!targetId) {
      const sheetInfo = await this.findOrCreateSpreadsheet(token);
      targetId = sheetInfo.id;
      targetUrl = sheetInfo.url;
    } else {
      // Extract ID if user provided full URL
      const match = targetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        targetId = match[1];
      }
      targetUrl = `https://docs.google.com/spreadsheets/d/${targetId}/edit`;
    }

    // Fetch spreadsheet metadata to dynamically find actual tab names
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${targetId}?fields=sheets.properties.title`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!metaRes.ok) {
      const errText = await metaRes.text();
      throw new Error(`ไม่สามารถเข้าถึง Google Sheet (${targetId}) ได้: ${errText}`);
    }
    const metaData = await metaRes.json();
    const sheetTitles: string[] = ((metaData.sheets as any[]) || []).map(s => s.properties?.title || '');

    const materialsTitle = sheetTitles.find(t => t.includes('พัสดุ')) || sheetTitles[0] || 'ทะเบียนพัสดุ';
    const ordersTitle = sheetTitles.find(t => t.includes('ใบเบิก')) || 'รายการใบเบิก';
    const stockInTitle = sheetTitles.find(t => t.includes('รับเข้า') || t.includes('รับ')) || 'ประวัติรับเข้า';
    const stockOutTitle = sheetTitles.find(t => t.includes('จ่ายออก') || t.includes('จ่าย')) || 'ประวัติจ่ายออก';

    const requestedRanges: { key: string; range: string }[] = [];
    if (sheetTitles.includes(materialsTitle)) requestedRanges.push({ key: 'materials', range: `${materialsTitle}!A1:O2000` });
    if (sheetTitles.includes(ordersTitle)) requestedRanges.push({ key: 'orders', range: `${ordersTitle}!A1:N2000` });
    if (sheetTitles.includes(stockInTitle)) requestedRanges.push({ key: 'stockIn', range: `${stockInTitle}!A1:N2000` });
    if (sheetTitles.includes(stockOutTitle)) requestedRanges.push({ key: 'stockOut', range: `${stockOutTitle}!A1:O2000` });

    const queryParams = requestedRanges.map(r => `ranges=${encodeURIComponent(r.range)}`).join('&');
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values:batchGet?${queryParams}`;
    
    const readRes = await fetch(readUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!readRes.ok) {
      const errText = await readRes.text();
      throw new Error(`ไม่สามารถอ่านข้อมูลจาก Google Sheet ได้: ${errText}`);
    }

    const readData = await readRes.json();
    const valueRanges = readData.valueRanges || [];

    const getRangeValues = (key: string) => {
      const idx = requestedRanges.findIndex(r => r.key === key);
      return idx >= 0 && valueRanges[idx] ? valueRanges[idx].values || [] : [];
    };

    // Parse Materials
    const materialsRange = getRangeValues('materials');
    const parsedMaterials: Material[] = [];

    if (materialsRange.length > 1) {
      // Skip header row
      for (let i = 1; i < materialsRange.length; i++) {
        const row = materialsRange[i];
        if (!row || !row[0] || !row[1]) continue;

        const id = String(row[0]).trim();
        const name = String(row[1]).trim();
        const category = String(row[2] || 'วัสดุสำนักงาน').trim();
        const unitPrice = Number(row[3]) || 0;
        const currentStock = Number(row[4]) || 0;
        const unit = String(row[5] || 'หน่วย').trim();
        const minQty = Number(row[6]) || 5;
        const maxQty = Number(row[7]) || 50;
        const usageStatus = (row[8] === 'ครั้งคราว' ? 'ครั้งคราว' : 'ประจำ') as 'ประจำ' | 'ครั้งคราว';
        const refillStatus = (row[9] === 'วัสดุหมด' ? 'วัสดุหมด' : row[9] === 'ใกล้หมด' ? 'ใกล้หมด' : 'OK') as 'OK' | 'ใกล้หมด' | 'วัสดุหมด';
        const location = String(row[10] || 'ห้องพัสดุวิทยาลัยการเมืองการปกครอง').trim();
        const purchaseQty = Number(row[11]) || currentStock;
        const totalWithdrawn = Number(row[12]) || 0;
        const imageUrl = String(row[13] || '').trim();

        parsedMaterials.push({
          id,
          name,
          category,
          unitPrice,
          purchaseQty,
          unit,
          minQty,
          maxQty,
          currentStock,
          refillStatus,
          usageStatus,
          totalPurchaseCost: unitPrice * purchaseQty,
          totalWithdrawn,
          monthlyAverage: 5,
          location,
          imageUrl
        });
      }
    }

    // Parse Orders
    const ordersRange = getRangeValues('orders');
    const parsedOrders: Order[] = [];
    if (ordersRange.length > 1) {
      for (let i = 1; i < ordersRange.length; i++) {
        const row = ordersRange[i];
        if (!row || !row[0] || !row[1]) continue;
        parsedOrders.push({
          id: String(row[0]).trim(),
          docNo: String(row[1]).trim(),
          date: String(row[2] || new Date().toISOString().split('T')[0]).trim(),
          requesterName: String(row[3] || '').trim(),
          requesterEmail: String(row[4] || '').trim(),
          requesterPosition: String(row[5] || '').trim(),
          department: String(row[6] || '').trim(),
          purpose: String(row[7] || '').trim(),
          totalItems: Number(row[8]) || 0,
          totalAmount: Number(row[9]) || 0,
          status: (row[10] || 'approved') as any,
          items: [],
          disbursedDate: row[12] ? String(row[12]) : undefined,
          createdAt: String(row[13] || new Date().toISOString())
        });
      }
    }

    // Parse Stock In
    const stockInRange = getRangeValues('stockIn');
    const parsedStockIn: StockIn[] = [];
    if (stockInRange.length > 1) {
      for (let i = 1; i < stockInRange.length; i++) {
        const row = stockInRange[i];
        if (!row || !row[0] || !row[3]) continue;
        parsedStockIn.push({
          id: String(row[0]).trim(),
          date: String(row[1] || new Date().toISOString().split('T')[0]).trim(),
          docNo: String(row[2] || '').trim(),
          materialId: String(row[3]).trim(),
          materialName: String(row[4] || '').trim(),
          category: String(row[5] || ''),
          quantity: Number(row[6]) || 0,
          unit: String(row[7] || 'หน่วย').trim(),
          unitPrice: Number(row[8]) || 0,
          totalPrice: Number(row[9]) || 0,
          supplier: String(row[10] || 'ร้านค้า/ผู้จัดจำหน่าย').trim(),
          receiverName: String(row[11] || 'เจ้าหน้าที่พัสดุ').trim(),
          note: String(row[12] || ''),
          createdAt: String(row[13] || new Date().toISOString())
        });
      }
    }

    // Parse Stock Out
    const stockOutRange = getRangeValues('stockOut');
    const parsedStockOut: StockOut[] = [];
    if (stockOutRange.length > 1) {
      for (let i = 1; i < stockOutRange.length; i++) {
        const row = stockOutRange[i];
        if (!row || !row[0] || !row[3]) continue;
        parsedStockOut.push({
          id: String(row[0]).trim(),
          date: String(row[1] || new Date().toISOString().split('T')[0]).trim(),
          requisitionDocNo: String(row[2] || '').trim(),
          materialId: String(row[3]).trim(),
          materialName: String(row[4] || '').trim(),
          category: String(row[5] || ''),
          quantity: Number(row[6]) || 0,
          unit: String(row[7] || 'หน่วย').trim(),
          unitPrice: Number(row[8]) || 0,
          totalPrice: Number(row[9]) || 0,
          requesterName: String(row[10] || '').trim(),
          department: String(row[11] || '').trim(),
          disburserName: String(row[12] || 'เจ้าหน้าที่พัสดุ').trim(),
          note: String(row[13] || ''),
          createdAt: String(row[14] || new Date().toISOString())
        });
      }
    }

    if (parsedMaterials.length === 0) {
      throw new Error(`ไม่พบรายการพัสดุในแท็บ "${materialsTitle}" ของสเปรดชีต กรุณาตรวจสอบว่ามีข้อมูลพัสดุตั้งแต่แถวที่ 2 เป็นต้นไป`);
    }

    return {
      materials: parsedMaterials,
      orders: parsedOrders,
      stockInLogs: parsedStockIn,
      stockOutLogs: parsedStockOut,
      spreadsheetUrl: targetUrl
    };
  }
};
