/**
 * GOOGLE APPS SCRIPT PENERIMA DATA PESERTA SIMULASI CAT CPNS 2027
 * Target Spreadsheet: https://docs.google.com/spreadsheets/d/1CWRndf77zS5uiCUQfC-rRCnz5yjcvAxYmIsvHTcEuoY/edit
 * URL Web App Aktif: https://script.google.com/macros/s/AKfycbysWUcwKQKOf7QD3Br4vZZBFtMaDaxc_2EYVZIzC7vtnIErmsM8THi4OlGcRMK4jKxsUA/exec
 * Status: AKTIF & TERHUBUNG KE INDEX.HTML
 */

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();

    // Otomatis pasang / rapikan 5 judul kolom resmi di baris pertama
    if (sheet.getLastRow() <= 1) {
      sheet.getRange(1, 1, 1, 5).setValues([[
        "Waktu Pendaftaran",
        "Nama Lengkap",
        "Email Peserta",
        "No. HP / WhatsApp (Nomor Ujian)",
        "Pilihan Formasi Jabatan"
      ]]);
      var headerRange = sheet.getRange(1, 1, 1, 5);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0284c7");
      headerRange.setFontColor("#ffffff");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }

    // Parse data peserta dari payload JSON web
    var data = {};
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }

    // Tambahkan baris pendaftaran baru
    sheet.appendRow([
      data.registeredAtFormatted || new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
      data.nama || "-",
      data.email || "-",
      data.noHp || data.whatsapp || data.tglLahir || data.noPeserta || "-",
      data.formasi || "-"
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      result: "success",
      message: "Data peserta berhasil dicatat ke Google Sheets!"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      result: "error",
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Endpoint Google Apps Script CAT CPNS 2027 Aktif & Siap Menerima Data Peserta!");
}
