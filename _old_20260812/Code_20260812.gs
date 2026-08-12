// KimFoods 製造スケジュール管理 - GAS バックエンド
// スプレッドシートID
var SPREADSHEET_ID = '1AKrhxJA3kxS7aQlnGl7R05e6MHHjHrrYBMT-vnhKXJk';

// === シート初期化 ===
function initializeSheets() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  var sheetConfigs = [
    { name: 'schedules', headers: ['date', 'productId', 'quantity', 'note', 'updatedAt'] },
    { name: 'products', headers: ['id', 'name', 'categoryId', 'contentG', 'coefficient', 'order', 'noCalc'] },
    { name: 'categories', headers: ['id', 'name', 'order'] },
    { name: 'categoryOrders', headers: ['date', 'categoryId', 'orderNum'] }
  ];

  sheetConfigs.forEach(function(config) {
    var sheet = ss.getSheetByName(config.name);
    if (!sheet) {
      sheet = ss.insertSheet(config.name);
      sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]);
      sheet.getRange(1, 1, 1, config.headers.length).setFontWeight('bold');
    }
  });
}

// === シートクリーンアップ（空行・重複削除） ===
function cleanupSheets() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // schedulesシートの空行削除と重複削除
  var sheet = ss.getSheetByName('schedules');
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    var header = data[0];
    var seen = {};
    var cleanData = [];

    for (var i = 1; i < data.length; i++) {
      var date = data[i][0];
      var productId = data[i][1];

      // 空行スキップ
      if (date === '' && productId === '') continue;

      // 日付を正規化
      if (date instanceof Date) {
        date = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
      }

      // 重複チェック（date + productId で一意、後のデータを優先）
      var key = String(date) + '_' + String(productId);
      if (seen[key] !== undefined) {
        // 既存を上書き（後のデータが新しい）
        cleanData[seen[key]] = [date, productId, data[i][2], data[i][3] || '', data[i][4] || ''];
      } else {
        seen[key] = cleanData.length;
        cleanData.push([date, productId, data[i][2], data[i][3] || '', data[i][4] || '']);
      }
    }

    // シートをクリアして書き直す
    sheet.clearContents();
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
    if (cleanData.length > 0) {
      sheet.getRange(2, 1, cleanData.length, cleanData[0].length).setValues(cleanData);
    }
  }

  // products・categoriesシートの空行削除
  ['products', 'categories'].forEach(function(name) {
    var s = ss.getSheetByName(name);
    if (!s) return;
    var d = s.getDataRange().getValues();
    var h = d[0];
    var rows = [];
    for (var i = 1; i < d.length; i++) {
      if (d[i][0] === '') continue;
      rows.push(d[i]);
    }
    s.clearContents();
    s.getRange(1, 1, 1, h.length).setValues([h]);
    s.getRange(1, 1, 1, h.length).setFontWeight('bold');
    if (rows.length > 0) {
      s.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
  });
}

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

// === GET リクエスト ===
function doGet(e) {
  var result;

  try {
    if (e.parameter.data) {
      var params = JSON.parse(e.parameter.data);
      var action = params.action;
      switch (action) {
        case 'saveSchedule':
          result = saveSchedule(params);
          break;
        case 'deleteSchedule':
          result = deleteSchedule(params);
          break;
        case 'saveProduct':
          result = saveProduct(params);
          break;
        case 'deleteProduct':
          result = deleteProduct(params);
          break;
        case 'saveCategory':
          result = saveCategory(params);
          break;
        case 'deleteCategory':
          result = deleteCategory(params);
          break;
        case 'saveCategoryOrder':
          result = saveCategoryOrder(params);
          break;
        case 'deleteCategoryOrder':
          result = deleteCategoryOrder(params);
          break;
        default:
          result = { success: false, error: 'Unknown action: ' + action };
      }
    } else {
      var action = e.parameter.action;
      switch (action) {
        case 'getSchedules':
          result = getSchedules(e.parameter.startDate, e.parameter.endDate);
          break;
        case 'getProducts':
          result = getProducts();
          break;
        case 'getCategories':
          result = getCategories();
          break;
        case 'getCategoryOrders':
          result = getCategoryOrders(e.parameter.date);
          break;
        default:
          result = { success: false, error: 'Unknown action: ' + action };
      }
    }
  } catch (err) {
    result = { success: false, error: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// === POST リクエスト ===
function doPost(e) {
  var params = JSON.parse(e.postData.contents);
  var action = params.action;
  var result;

  try {
    switch (action) {
      case 'saveSchedule':
        result = saveSchedule(params);
        break;
      case 'deleteSchedule':
        result = deleteSchedule(params);
        break;
      case 'saveProduct':
        result = saveProduct(params);
        break;
      case 'deleteProduct':
        result = deleteProduct(params);
        break;
      case 'saveCategory':
        result = saveCategory(params);
        break;
      case 'deleteCategory':
        result = deleteCategory(params);
        break;
      case 'saveCategoryOrder':
        result = saveCategoryOrder(params);
        break;
      case 'deleteCategoryOrder':
        result = deleteCategoryOrder(params);
        break;
      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { success: false, error: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// === スケジュール ===
function normalizeDate(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Tokyo', 'yyyy-MM-dd');
  }
  return String(val);
}

function getSchedules(startDate, endDate) {
  var sheet = getSheet('schedules');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, data: [] };
  var data = sheet.getRange(1, 1, lastRow, 5).getValues();
  var schedules = [];

  for (var i = 1; i < data.length; i++) {
    var date = normalizeDate(data[i][0]);

    if (startDate && date < startDate) continue;
    if (endDate && date > endDate) continue;

    schedules.push({
      date: date,
      productId: data[i][1],
      quantity: data[i][2],
      note: data[i][3] || '',
      updatedAt: data[i][4] || ''
    });
  }

  return { success: true, data: schedules };
}

function saveSchedule(params) {
  var sheet = getSheet('schedules');
  var lastRow = sheet.getLastRow();
  var now = new Date().toISOString();
  var found = false;
  var targetDate = String(params.date);
  var targetProductId = String(params.productId);

  if (lastRow >= 2) {
    var data = sheet.getRange(1, 1, lastRow, 5).getValues();
    for (var i = 1; i < data.length; i++) {
      var date = normalizeDate(data[i][0]);
      if (date === targetDate && String(data[i][1]) === targetProductId) {
        sheet.getRange(i + 1, 3).setValue(params.quantity);
        sheet.getRange(i + 1, 4).setValue(params.note || '');
        sheet.getRange(i + 1, 5).setValue(now);
        found = true;
        break;
      }
    }
  }

  if (!found) {
    var newRow = lastRow + 1;
    sheet.getRange(newRow, 1).setNumberFormat('@').setValue(targetDate);
    sheet.getRange(newRow, 2).setValue(targetProductId);
    sheet.getRange(newRow, 3).setValue(params.quantity);
    sheet.getRange(newRow, 4).setValue(params.note || '');
    sheet.getRange(newRow, 5).setValue(now);
  }

  return { success: true };
}

function deleteSchedule(params) {
  var sheet = getSheet('schedules');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: false, error: 'Schedule not found' };
  var data = sheet.getRange(1, 1, lastRow, 5).getValues();
  var targetDate = String(params.date);
  var targetProductId = String(params.productId);

  for (var i = 1; i < data.length; i++) {
    var date = normalizeDate(data[i][0]);
    if (date === targetDate && String(data[i][1]) === targetProductId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { success: false, error: 'Schedule not found' };
}

// === 商品マスタ ===
function getProducts() {
  var sheet = getSheet('products');
  var data = sheet.getDataRange().getValues();
  var products = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === '') continue;
    products.push({
      id: data[i][0],
      name: data[i][1],
      categoryId: data[i][2],
      contentG: data[i][3] || 0,
      coefficient: data[i][4] || 0.68,
      order: data[i][5] || 0,
      noCalc: data[i][6] === true || data[i][6] === 'TRUE'
    });
  }

  return { success: true, data: products };
}

function saveProduct(params) {
  var sheet = getSheet('products');
  var data = sheet.getDataRange().getValues();

  if (params.id) {
    // 更新
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(params.id)) {
        sheet.getRange(i + 1, 2).setValue(params.name);
        sheet.getRange(i + 1, 3).setValue(params.categoryId);
        sheet.getRange(i + 1, 4).setValue(params.contentG || 0);
        sheet.getRange(i + 1, 5).setValue(params.coefficient || 0.68);
        sheet.getRange(i + 1, 6).setValue(params.order || 0);
        sheet.getRange(i + 1, 7).setValue(params.noCalc ? 'TRUE' : 'FALSE');
        return { success: true, id: params.id };
      }
    }
    return { success: false, error: 'Product not found' };
  } else {
    // 新規 - IDを生成
    var newId = 'p' + new Date().getTime();
    sheet.appendRow([newId, params.name, params.categoryId, params.contentG || 0, params.coefficient || 0.68, params.order || 0, params.noCalc ? 'TRUE' : 'FALSE']);
    return { success: true, id: newId };
  }
}

function deleteProduct(params) {
  var sheet = getSheet('products');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(params.id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Product not found' };
}

// === カテゴリマスタ ===
function getCategories() {
  var sheet = getSheet('categories');
  var data = sheet.getDataRange().getValues();
  var categories = [];

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === '') continue;
    categories.push({
      id: data[i][0],
      name: data[i][1],
      order: data[i][2] || 0
    });
  }

  return { success: true, data: categories };
}

function saveCategory(params) {
  var sheet = getSheet('categories');
  var data = sheet.getDataRange().getValues();

  if (params.id) {
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(params.id)) {
        sheet.getRange(i + 1, 2).setValue(params.name);
        sheet.getRange(i + 1, 3).setValue(params.order || 0);
        return { success: true, id: params.id };
      }
    }
    return { success: false, error: 'Category not found' };
  } else {
    var newId = 'c' + new Date().getTime();
    sheet.appendRow([newId, params.name, params.order || 0]);
    return { success: true, id: newId };
  }
}

function deleteCategory(params) {
  var sheet = getSheet('categories');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(params.id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Category not found' };
}

// === カテゴリ作業順序 ===
function getCategoryOrders(date) {
  var sheet = getSheet('categoryOrders');
  if (!sheet) return { success: true, data: [] };
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, data: [] };
  var data = sheet.getRange(1, 1, lastRow, 3).getValues();
  var orders = [];

  for (var i = 1; i < data.length; i++) {
    var d = normalizeDate(data[i][0]);
    if (date && d !== String(date)) continue;
    if (data[i][1] === '') continue;
    orders.push({
      date: d,
      categoryId: data[i][1],
      orderNum: data[i][2]
    });
  }

  return { success: true, data: orders };
}

function saveCategoryOrder(params) {
  var sheet = getSheet('categoryOrders');
  if (!sheet) {
    var ss = getSpreadsheet();
    sheet = ss.insertSheet('categoryOrders');
    sheet.getRange(1, 1, 1, 3).setValues([['date', 'categoryId', 'orderNum']]);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
  var lastRow = sheet.getLastRow();
  var targetDate = String(params.date);
  var targetCatId = String(params.categoryId);

  if (lastRow >= 2) {
    var data = sheet.getRange(1, 1, lastRow, 3).getValues();
    for (var i = 1; i < data.length; i++) {
      var d = normalizeDate(data[i][0]);
      if (d === targetDate && String(data[i][1]) === targetCatId) {
        sheet.getRange(i + 1, 3).setValue(params.orderNum);
        return { success: true };
      }
    }
  }

  var newRow = lastRow + 1;
  sheet.getRange(newRow, 1).setNumberFormat('@').setValue(targetDate);
  sheet.getRange(newRow, 2).setValue(targetCatId);
  sheet.getRange(newRow, 3).setValue(params.orderNum);
  return { success: true };
}

function deleteCategoryOrder(params) {
  var sheet = getSheet('categoryOrders');
  if (!sheet) return { success: true };
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true };
  var data = sheet.getRange(1, 1, lastRow, 3).getValues();
  var targetDate = String(params.date);
  var targetCatId = String(params.categoryId);

  for (var i = 1; i < data.length; i++) {
    var d = normalizeDate(data[i][0]);
    if (d === targetDate && String(data[i][1]) === targetCatId) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: true };
}
