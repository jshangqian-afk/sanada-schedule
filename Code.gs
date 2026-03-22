// KimFoods 製造スケジュール管理 - GAS バックエンド
// スプレッドシートID
var SPREADSHEET_ID = '1AKrhxJA3kxS7aQlnGl7R05e6MHHjHrrYBMT-vnhKXJk';

// === シート初期化 ===
function initializeSheets() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  var sheetConfigs = [
    { name: 'schedules', headers: ['date', 'productId', 'quantity', 'note', 'updatedAt'] },
    { name: 'products', headers: ['id', 'name', 'categoryId', 'contentG', 'coefficient', 'order', 'noCalc'] },
    { name: 'categories', headers: ['id', 'name', 'order'] }
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

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

// === GET リクエスト ===
function doGet(e) {
  var action = e.parameter.action;
  var result;

  try {
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
      default:
        result = { success: false, error: 'Unknown action: ' + action };
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
function getSchedules(startDate, endDate) {
  var sheet = getSheet('schedules');
  var data = sheet.getDataRange().getValues();
  var schedules = [];

  for (var i = 1; i < data.length; i++) {
    var date = data[i][0];
    if (date === '') continue;

    // 日付文字列に変換
    if (date instanceof Date) {
      date = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
    }

    // 日付範囲フィルタ
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
  var data = sheet.getDataRange().getValues();
  var now = new Date().toISOString();
  var found = false;

  // 既存データを検索（date + productId で一意）
  for (var i = 1; i < data.length; i++) {
    var date = data[i][0];
    if (date instanceof Date) {
      date = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
    }
    if (date === params.date && String(data[i][1]) === String(params.productId)) {
      // 更新
      sheet.getRange(i + 1, 3).setValue(params.quantity);
      sheet.getRange(i + 1, 4).setValue(params.note || '');
      sheet.getRange(i + 1, 5).setValue(now);
      found = true;
      break;
    }
  }

  if (!found) {
    // 新規追加
    sheet.appendRow([params.date, params.productId, params.quantity, params.note || '', now]);
  }

  return { success: true };
}

function deleteSchedule(params) {
  var sheet = getSheet('schedules');
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var date = data[i][0];
    if (date instanceof Date) {
      date = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
    }
    if (date === params.date && String(data[i][1]) === String(params.productId)) {
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
