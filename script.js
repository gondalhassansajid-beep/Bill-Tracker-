
/* =========================================
   GOOGLE APPS SCRIPT DEPLOYMENT URL
   یہاں اپنا Web App URL لگائیں
========================================= */

const API_URL = "https://script.google.com/macros/s/AKfycbxl5ShoYdh2TIPC3a4jz0LMT8VBFTLozBoCj1ypOkFix3P-Y_YjcJihgct66aKRPo9B/exec";

let bills = [];

const $ = id => document.getElementById(id);

const money = value =>
  Number(value || 0).toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

function showMessage(text, error = false) {
  $("message").textContent = text;
  $("message").style.color = error ? "#b91c1c" : "#176b35";
}

function getStatus(bill) {
  if (Number(bill.paid) >= Number(bill.amount)) return "مکمل ادا";
  if (Number(bill.paid) > 0) return "جزوی ادائیگی";
  return "بقایا";
}

function statusClass(bill) {
  if (Number(bill.paid) >= Number(bill.amount)) return "paid-status";
  if (Number(bill.paid) > 0) return "partial-status";
  return "due-status";
}

async function api(action, data = {}) {
  if (!API_URL.startsWith("https://script.google.com/")) {
    throw new Error("JavaScript میں Google Apps Script URL درج کریں۔");
  }

  const url = new URL(API_URL);

  if (action === "list") {
    url.searchParams.set("action", "list");
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error("ڈیٹا حاصل نہیں ہو سکا");
    const result = await response.json();
    if (!result.success) throw new Error(result.message || "سرور کی خرابی");
    return result.data;
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({ action, ...data })
  });

  if (!response.ok) throw new Error("سرور سے رابطہ ناکام ہوا");

  const result = await response.json();
  if (!result.success) throw new Error(result.message || "ڈیٹا محفوظ نہیں ہوا");

  return result;
}

async function loadBills() {
  $("connectionStatus").textContent = "ڈیٹا لوڈ ہو رہا ہے...";

  try {
    bills = await api("list");
    $("connectionStatus").textContent = "Google Sheets سے منسلک";
    $("connectionStatus").classList.remove("error");
    render();
  } catch (error) {
    $("connectionStatus").textContent = "کنکشن ناکام";
    $("connectionStatus").classList.add("error");
    showMessage(error.message, true);
    $("billTable").innerHTML =
      '<tr><td colspan="8">ڈیٹا لوڈ نہیں ہو سکا۔ Apps Script URL اور deployment چیک کریں۔</td></tr>';
  }
}

function render() {
  const query = $("searchInput").value.trim().toLowerCase();

  const filtered = bills.filter(b =>
    String(b.billNo).toLowerCase().includes(query) ||
    String(b.customer).toLowerCase().includes(query)
  );

  const total = bills.reduce((s, b) => s + Number(b.amount || 0), 0);
  const paid = bills.reduce((s, b) => s + Number(b.paid || 0), 0);

  $("totalBills").textContent = bills.length;
  $("totalAmount").textContent = money(total);
  $("paidAmount").textContent = money(paid);
  $("dueAmount").textContent = money(total - paid);

  if (!filtered.length) {
    $("billTable").innerHTML =
      '<tr><td colspan="8">کوئی بل موجود نہیں ہے</td></tr>';
    return;
  }

  $("billTable").innerHTML = filtered.map(b => `
    <tr>
      <td>${escapeHTML(b.billNo)}</td>
      <td>${escapeHTML(b.customer)}</td>
      <td>${escapeHTML(b.billDate)}</td>
      <td>${money(b.amount)}</td>
      <td>${money(b.paid)}</td>
      <td>${money(Number(b.amount) - Number(b.paid))}</td>
      <td><span class="status ${statusClass(b)}">${getStatus(b)}</span></td>
      <td>
        <button class="small-btn edit-btn" data-action="edit" data-id="${escapeHTML(b.id)}">ترمیم</button>
        <button class="small-btn pdf-btn" data-action="pdf" data-id="${escapeHTML(b.id)}">PDF</button>
        <button class="small-btn delete-btn" data-action="delete" data-id="${escapeHTML(b.id)}">ڈیلیٹ</button>
      </td>
    </tr>
  `).join("");
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

$("billForm").addEventListener("submit", async event => {
  event.preventDefault();

  const amount = Number($("amount").value);
  const paid = Number($("paid").value);

  if (!Number.isFinite(amount) || !Number.isFinite(paid) ||
      amount <= 0 || paid < 0 || paid > amount) {
    showMessage("رقم درست درج کریں۔ وصول شدہ رقم کل رقم سے زیادہ نہیں ہو سکتی۔", true);
    return;
  }

  const data = {
    id: $("billId").value,
    billNo: $("billNo").value.trim(),
    customer: $("customer").value.trim(),
    billDate: $("billDate").value,
    amount,
    paid,
    description: $("description").value.trim()
  };

  if (!data.billNo || !data.customer || !data.billDate) {
    showMessage("تمام ضروری معلومات درج کریں۔", true);
    return;
  }

  const saveBtn = $("saveBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "محفوظ ہو رہا ہے...";

  try {
    await api(data.id ? "update" : "create", data);
    showMessage(data.id ? "بل کامیابی سے اپ ڈیٹ ہو گیا۔" : "نیا بل محفوظ ہو گیا۔");
    resetForm();
    await loadBills();
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "بل محفوظ کریں";
  }
});

function resetForm() {
  $("billForm").reset();
  $("billId").value = "";
  $("paid").value = 0;
  $("formTitle").textContent = "نیا بل شامل کریں";
  $("saveBtn").textContent = "بل محفوظ کریں";
  $("cancelEdit").hidden = true;
}

$("cancelEdit").addEventListener("click", resetForm);

$("searchInput").addEventListener("input", render);

$("billTable").addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const bill = bills.find(b => String(b.id) === button.dataset.id);
  if (!bill) return;

  const action = button.dataset.action;

  if (action === "edit") {
    $("billId").value = bill.id;
    $("billNo").value = bill.billNo;
    $("customer").value = bill.customer;
    $("billDate").value = bill.billDate;
    $("amount").value = bill.amount;
    $("paid").value = bill.paid;
    $("description").value = bill.description || "";
    $("formTitle").textContent = "بل میں ترمیم کریں";
    $("saveBtn").textContent = "تبدیلیاں محفوظ کریں";
    $("cancelEdit").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (action === "delete") {
    if (!confirm("کیا آپ واقعی یہ بل ڈیلیٹ کرنا چاہتے ہیں؟")) return;

    try {
      await api("delete", { id: bill.id });
      showMessage("بل ڈیلیٹ ہو گیا۔");
      await loadBills();
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  if (action === "pdf") {
    printBill(bill);
  }
});

/* بل کی PDF: براؤزر کے Print ڈائیلاگ سے Save as PDF کریں */
function printBill(bill) {
  const due = Number(bill.amount) - Number(bill.paid);
  const win = window.open("", "_blank");

  if (!win) {
    showMessage("PDF کے لیے براہ کرم اس ویب سائٹ کے Pop-ups کی اجازت دیں۔", true);
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html lang="ur" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>بل ${escapeHTML(bill.billNo)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family:'Noto Nastaliq Urdu',serif; padding:35px; color:#172b43; }
        .invoice { max-width:750px; margin:auto; border:1px solid #ddd; padding:30px; }
        h1 { text-align:center; color:#123b63; }
        .line { border-bottom:1px solid #ddd; padding:12px 0; }
        .amount { font-family:Arial,sans-serif; direction:ltr; display:inline-block; }
        .total { font-size:20px; font-weight:bold; }
        @media print { button { display:none; } }
      </style>
    </head>
    <body>
      <div class="invoice">
        <h1>بل / رسید</h1>
        <div class="line">بل نمبر: ${escapeHTML(bill.billNo)}</div>
        <div class="line">کسٹمر: ${escapeHTML(bill.customer)}</div>
        <div class="line">تاریخ: ${escapeHTML(bill.billDate)}</div>
        <div class="line">تفصیل: ${escapeHTML(bill.description || "کوئی تفصیل نہیں")}</div>
        <div class="line">کل رقم: <span class="amount">${money(bill.amount)}</span></div>
        <div class="line">وصول شدہ رقم: <span class="amount">${money(bill.paid)}</span></div>
        <div class="line total">بقایا رقم: <span class="amount">${money(due)}</span></div>
        <div class="line">حالت: ${getStatus(bill)}</div>
        <p style="text-align:center;margin-top:35px">آپ کا شکریہ</p>
        <button onclick="window.print()">PDF / پرنٹ</button>
      </div>
    </body>
    </html>
  `);

  win.document.close();
  win.onload = () => win.print();
}

$("billDate").value = new Date().toISOString().slice(0, 10);
loadBills();

$("retrieveBtn").addEventListener("click", async () => {
  const billNo = $("retrieveBillNo").value.trim();
  const result = $("retrievedBill");

  if (!billNo) {
    result.textContent = "براہ کرم بل نمبر درج کریں۔";
    return;
  }

  result.textContent = "بل تلاش کیا جا رہا ہے...";

  try {
    // تازہ ترین ڈیٹا Google Sheets سے حاصل کریں
    bills = await api("list");

    const bill = bills.find(
      b => String(b.billNo).trim().toLowerCase() ===
           billNo.toLowerCase()
    );

    if (!bill) {
      result.textContent = "اس بل نمبر کا کوئی ریکارڈ نہیں ملا۔";
      return;
    }

    const due = Number(bill.amount) - Number(bill.paid);

    result.innerHTML = `
      <div class="retrieved-card">
        <h3>آپ کا بل مل گیا!</h3>

        <p>بل نمبر: ${escapeHTML(bill.billNo)}</p>
        <p>کسٹمر: ${escapeHTML(bill.customer)}</p>
        <p>بل کی تاریخ: ${escapeHTML(bill.billDate)}</p>
        <p>تفصیل: ${escapeHTML(bill.description || "کوئی تفصیل نہیں")}</p>
        <p>کل رقم: ${money(bill.amount)}</p>
        <p>وصول شدہ رقم: ${money(bill.paid)}</p>
        <p>بقایا رقم: ${money(due)}</p>
        <p>حالت: ${getStatus(bill)}</p>

        <button
          class="btn primary"
          type="button"
          id="retrievePdfBtn">
          PDF حاصل کریں
        </button>
      </div>
    `;

    $("retrievePdfBtn").addEventListener("click", () => {
      printBill(bill);
    });

    render();

  } catch (error) {
    result.textContent = error.message;
  }
});
