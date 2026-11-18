/**
 * GOOGLE APPS SCRIPT PENERIMA DATA PESERTA & PAS FOTO SIMULASI CAT CPNS 2027
 * Target Spreadsheet: https://docs.google.com/spreadsheets/d/1CWRndf77zS5uiCUQfC-rRCnz5yjcvAxYmIsvHTcEuoY/edit
 * URL Web App Aktif: https://script.google.com/macros/s/AKfycbysWUcwKQKOf7QD3Br4vZZBFtMaDaxc_2EYVZIzC7vtnIErmsM8THi4OlGcRMK4jKxsUA/exec
 * Catatan Deploy: Pilih Deploy -> Manage deployments -> Edit (ikon pensil) -> New version -> Deploy
 *                 agar URL /exec tetap sama dan baris lama di tab "Data pengguna" tetap utuh.
 */

var FOTO_DRIVE_FOLDER_NAME = "Foto Peserta CAT CPNS 2027";

function getOrCreateFotoFolder_() {
  var folders = DriveApp.getFoldersByName(FOTO_DRIVE_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(FOTO_DRIVE_FOLDER_NAME);
}

function savePrivatePhotoToDrive_(data) {
  if (!data || !data.fotoBase64) return "";
  try {
    var cleanBase64 = String(data.fotoBase64).replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
    if (!cleanBase64) return "";

    var mimeType = data.fotoMime || "image/jpeg";
    var ext = mimeType.indexOf("png") !== -1 ? "png" : "jpg";
    var rawName = (data.noPeserta || data.noHp || "peserta") + "_" + (data.nama || "cat");
    var safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60) + "." + ext;

    var bytes = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(bytes, mimeType, safeName);
    var folder = getOrCreateFotoFolder_();
    var file = folder.createFile(blob);

    // Pastikan akses file PRIVATE (hanya akun Google pemilik Drive/Spreadsheet yang dapat melihat)
    try {
      file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    } catch (_) {}

    return file.getUrl();
  } catch (err) {
    return "";
  }
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Data pengguna") || ss.getSheets()[0];

    // Hanya buat header jika sheet benar-benar masih kosong (tidak menyentuh data lama!)
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, 6).setValues([[
        "Waktu Pendaftaran",
        "Nama Peserta",
        "Email",
        "Nomor WhatsApp",
        "Formasi",
        "Foto"
      ]]);
      var headerRange = sheet.getRange(1, 1, 1, 6);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0284c7");
      headerRange.setFontColor("#ffffff");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    } else if (!sheet.getRange(1, 6).getValue()) {
      sheet.getRange(1, 6).setValue("Foto");
    }

    var data = {};
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }

    var fotoUrl = savePrivatePhotoToDrive_(data);
    var contactColValue = data.noPeserta || data.noHp || data.whatsapp || "-";

    // Jika peserta memperbarui biodata / pas foto dari menu Ubah Biodata Diri
    if (data.action === "updateFoto") {
      var lastRow = sheet.getLastRow();
      var targetEmail = String(data.email || "").trim().toLowerCase();
      var targetContact = String(contactColValue).trim().toLowerCase();
      var values = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 6).getValues() : [];

      for (var i = values.length - 1; i >= 0; i--) {
        var rowEmail = String(values[i][2] || "").trim().toLowerCase();
        var rowContact = String(values[i][3] || "").trim().toLowerCase();
        if ((targetEmail && rowEmail === targetEmail) || (targetContact && rowContact === targetContact)) {
          var sheetRow = i + 2;
          if (data.nama) sheet.getRange(sheetRow, 2).setValue(data.nama);
          if (contactColValue !== "-") sheet.getRange(sheetRow, 4).setValue(contactColValue);
          if (data.formasi) sheet.getRange(sheetRow, 5).setValue(data.formasi);
          if (fotoUrl) sheet.getRange(sheetRow, 6).setValue(fotoUrl);
          return ContentService.createTextOutput(JSON.stringify({
            result: "success",
            updatedRow: sheetRow,
            fotoUrl: fotoUrl
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    // Pendaftaran baru: selalu meneruskan ke baris paling bawah (setelah baris terakhir)
    sheet.appendRow([
      data.registeredAtFormatted || new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
      data.nama || "-",
      data.email || "-",
      contactColValue,
      data.formasi || "Umum",
      fotoUrl || "-"
    ]);

    return ContentService.createTextOutput(JSON.stringify({
      result: "success",
      message: "Data peserta dan pas foto berhasil dicatat ke Google Sheets!",
      fotoUrl: fotoUrl
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      result: "error",
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Endpoint Google Apps Script CAT CPNS 2027 (6 Kolom + Drive Private Foto) Aktif!");
}
