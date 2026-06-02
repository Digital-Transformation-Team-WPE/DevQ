// IndexedDB service for client-side data persistence
const DB_NAME = 'RobotLibDB';
const DB_VERSION = 1;
const TABLE_STORE = 'TableData';

let db = null;

export async function initializeDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(TABLE_STORE)) {
        const objectStore = database.createObjectStore(TABLE_STORE, { keyPath: 'id' });
        objectStore.createIndex('SN', 'SN', { unique: true });
      }
    };
  });
}

export async function saveTableData(tableData) {
  if (!db) await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([TABLE_STORE], 'readwrite');
    const objectStore = transaction.objectStore(TABLE_STORE);

    // Clear existing data
    objectStore.clear();

    // Insert new data
    tableData.forEach((row, index) => {
      const record = {
        id: index + 1,
        SN: index + 1,
        ColA: row[0] || '',
        ColB: row[1] || '',
        ColC: row[2] || '',
        ColD: row[3] || '',
        ColE: row[4] || '',
        ColF: row[5] || '',
        ColG: row[6] || '',
        ColH: row[7] || '',
        ColI: row[8] || '',
        ColJ: row[9] || '',
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString()
      };
      objectStore.add(record);
    });

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      resolve({ success: true, rowsAffected: tableData.length });
    };
  });
}

export async function loadTableData() {
  if (!db) await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([TABLE_STORE], 'readonly');
    const objectStore = transaction.objectStore(TABLE_STORE);
    const request = objectStore.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const records = request.result.sort((a, b) => a.SN - b.SN);
      const tableData = records.map(record => [
        record.ColA,
        record.ColB,
        record.ColC,
        record.ColD,
        record.ColE,
        record.ColF,
        record.ColG,
        record.ColH,
        record.ColI,
        record.ColJ
      ]);
      resolve({ success: true, data: tableData, rowCount: tableData.length });
    };
  });
}

export async function clearTableData() {
  if (!db) await initializeDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([TABLE_STORE], 'readwrite');
    const objectStore = transaction.objectStore(TABLE_STORE);
    const request = objectStore.clear();

    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => {
      resolve({ success: true, message: 'Table cleared' });
    };
  });
}

export async function getDBStatus() {
  if (!db) await initializeDB();
  
  return new Promise((resolve) => {
    const transaction = db.transaction([TABLE_STORE], 'readonly');
    const objectStore = transaction.objectStore(TABLE_STORE);
    const countRequest = objectStore.count();

    countRequest.onsuccess = () => {
      resolve({ 
        status: 'connected', 
        database: 'RobotLib (IndexedDB)',
        recordCount: countRequest.result 
      });
    };
  });
}
