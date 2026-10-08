const { currencySymbols, products } = window.QUOTE_PRICING;

const form = document.querySelector("#addendum-form");
const costLineList = document.querySelector("#cost-line-list");
const discountList = document.querySelector("#discount-list");
const costLineTemplate = document.querySelector("#cost-line-template");
const discountLineTemplate = document.querySelector("#discount-line-template");
const totalUsedInput = document.querySelector("#total-used");
const resetTotalOverrideButton = document.querySelector("#reset-total-override");
let totalIsOverridden = false;
let syncingUserCounts = false;
let documentCustomized = false;
let nextCostLineId = 1;
const documentPage = document.querySelector("#addendum-document");
const resetDocumentButton = document.querySelector("#reset-document");
const previewState = document.querySelector("#preview-state");
const feedbackModal = document.querySelector("#feedback-modal");
const feedbackButton = document.querySelector("#feedback-button");
const feedbackCloseButton = document.querySelector("#feedback-close");
const toggleOverageClauseButton = document.querySelector("#toggle-overage-clause");
let includeOverageClause = false;
const automaticDocumentTemplate = documentPage.innerHTML;
let paginationFrame = 0;
let documentComposing = false;

function createDocumentSheet() {
  const sheet = document.createElement("section");
  sheet.className = "document-sheet";
  return sheet;
}

function flattenPaginatedDocument() {
  const primaryCostSection = documentPage.querySelector("#document-cost-section");
  const primaryCostList = primaryCostSection?.querySelector("#document-cost-list");
  documentPage.querySelectorAll(".cost-section.pagination-fragment").forEach((fragment) => {
    if (primaryCostList) {
      fragment.querySelectorAll(".cost-list:not(.total-cost-line) > *").forEach((item) => primaryCostList.append(item));
      const total = fragment.querySelector(".total-cost-line");
      if (total) primaryCostSection.append(total);
    }
    fragment.remove();
  });

  const sheets = [...documentPage.querySelectorAll(":scope > .document-sheet")];
  if (!sheets.length) return;
  const content = document.createDocumentFragment();
  sheets.forEach((sheet) => {
    [...sheet.childNodes].forEach((child) => {
      if (!child.classList?.contains("continued-note")) content.append(child);
    });
  });
  documentPage.replaceChildren(content);
}

function sheetOverflows(sheet) {
  return sheet.scrollHeight > sheet.clientHeight + 1;
}

function sheetHasContent(sheet) {
  return [...sheet.children].some((child) => !child.classList.contains("continued-note"));
}

function paginateCostSection(section, startingSheet, addSheet) {
  const list = section.querySelector("#document-cost-list");
  const total = section.querySelector(".total-cost-line");
  if (!list || !total) return startingSheet;
  const items = [...list.children];
  list.replaceChildren();
  total.remove();

  let sheet = startingSheet;
  sheet.append(section);
  if (sheetOverflows(sheet) && sheetHasContent(sheet) && sheet.children.length > 1) {
    sheet = addSheet();
    sheet.append(section);
  }

  let activeSection = section;
  let activeList = list;
  const startCostFragment = () => {
    sheet = addSheet();
    activeSection = document.createElement("section");
    activeSection.className = "cost-section pagination-fragment";
    activeList = document.createElement("dl");
    activeList.className = "cost-list";
    activeSection.append(activeList);
    sheet.append(activeSection);
  };

  items.forEach((item) => {
    activeList.append(item);
    if (!sheetOverflows(sheet)) return;
    item.remove();
    if (activeSection === section && activeList.children.length === 0 && sheet.children.length > 1) {
      sheet = addSheet();
      sheet.append(section);
      activeList.append(item);
      return;
    }
    startCostFragment();
    activeList.append(item);
  });

  activeSection.append(total);
  if (sheetOverflows(sheet)) {
    total.remove();
    startCostFragment();
    activeSection.append(total);
  }
  return sheet;
}

function paginateDocument() {
  // Keep the caret attached to its text nodes while moving content between sheets.
  const selection = window.getSelection();
  const caret = selection?.rangeCount && documentPage.contains(selection.anchorNode) && documentPage.contains(selection.focusNode)
    ? {anchor: selection.anchorNode, anchorOffset: selection.anchorOffset, focus: selection.focusNode, focusOffset: selection.focusOffset}
    : null;
  const panel = document.querySelector(".preview-panel");
  const scrollTop = panel.scrollTop;
  flattenPaginatedDocument();
  const content = [...documentPage.childNodes];
  documentPage.replaceChildren();
  const sheets = [];
  const addSheet = () => {
    const sheet = createDocumentSheet();
    sheets.push(sheet);
    documentPage.append(sheet);
    return sheet;
  };
  let sheet = addSheet();

  content.forEach((node) => {
    if (node.id === "document-cost-section") {
      sheet = paginateCostSection(node, sheet, addSheet);
      return;
    }
    sheet.append(node);
    if (sheetOverflows(sheet) && sheet.children.length > 1) {
      node.remove();
      sheet = addSheet();
      sheet.append(node);
    }
  });

  sheets.slice(0, -1).forEach((page) => {
    const note = document.createElement("div");
    note.className = "continued-note";
    note.contentEditable = "false";
    note.textContent = "[Continued on the next page]";
    page.append(note);
  });
  if (caret && documentPage.contains(caret.anchor) && documentPage.contains(caret.focus)) {
    const length = node => node.nodeType === Node.TEXT_NODE ? node.length : node.childNodes.length;
    selection.setBaseAndExtent(caret.anchor, Math.min(caret.anchorOffset, length(caret.anchor)), caret.focus, Math.min(caret.focusOffset, length(caret.focus)));
    panel.scrollTop = scrollTop;
  }
}

function schedulePagination() {
  if (documentComposing) return;
  window.cancelAnimationFrame(paginationFrame);
  paginationFrame = window.requestAnimationFrame(() => {
    paginationFrame = 0;
    paginateDocument();
  });
}

function completePendingPagination() {
  window.cancelAnimationFrame(paginationFrame);
  paginationFrame = 0;
  paginateDocument();
}

const fields = {
  addendumNumber: document.querySelector("#addendum-number"),
  agreementDate: document.querySelector("#agreement-date"),
  agreementDatePickerButton: document.querySelector("#agreement-date-picker-button"),
  agreementType: document.querySelector("#agreement-type"),
  customerName: document.querySelector("#customer-name"),
  jotformEntity: document.querySelector("#jotform-entity"),
  currency: document.querySelector("#currency"),
  monthsRemaining: document.querySelector("#months-remaining"),
  renewalEndDate: document.querySelector("#renewal-end-date"),
  previousUsers: document.querySelector("#previous-users"),
  renewedUsers: document.querySelector("#renewed-users"),
  customerSignerName: document.querySelector("#customer-signer-name"),
  customerSignerTitle: document.querySelector("#customer-signer-title"),
  jotformSignerName: document.querySelector("#jotform-signer-name"),
  jotformSignerTitle: document.querySelector("#jotform-signer-title"),
};

function productByName(name) {
  return products.find((item) => item.product === name);
}

function numericValue(input) {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) ? value : 0;
}

function wholeNumberValue(input) {
  return Math.max(0, Math.floor(numericValue(input)));
}

function moneyFormatter() {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: fields.currency.value,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoney(value) {
  return moneyFormatter().format(value);
}

function formatPercent(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value) {
  const enteredDate = value.trim();
  if (!enteredDate) return "[Agreement date]";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(enteredDate)) return enteredDate;
  const [year, month, day] = enteredDate.split("-").map(Number);
  if (!year || !month || !day) return enteredDate;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(year, month - 1, day));
}

function setOutput(name, value) {
  document.querySelectorAll(`[data-output="${name}"]`).forEach((element) => { element.textContent = value; });
}

function buildProductOptions(select) {
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select a feature or enter a custom label";
  select.append(placeholder);
  ["Base Packages", "Add-Ons", "One-Time Fees"].forEach((category) => {
    const group = document.createElement("optgroup");
    group.label = category;
    products.filter((item) => item.category === category && item.product !== "Add another product").forEach((item) => {
      const option = document.createElement("option");
      option.value = item.product;
      option.textContent = item.product;
      group.append(option);
    });
    select.append(group);
  });
}

function linkedCatalogPrice(row) {
  const item = productByName(row.querySelector(".line-product").value);
  if (!item) return 0;
  const catalogPrice = item.prices[fields.currency.value];
  if (catalogPrice === undefined) return 0;
  const basis = row.querySelector(".line-basis").value;
  if (item.defaultBasis === "monthly" && (basis === "annual" || basis === "back-charge")) return catalogPrice * 12;
  return basis === "monthly" && item.annual !== false ? catalogPrice / 12 : catalogPrice;
}

function updateLinkedUnitPrice(row) {
  if (row.dataset.catalogLinked !== "true") return;
  row.querySelector(".line-unit-price").value = linkedCatalogPrice(row).toFixed(2);
}

function syncCreditDescription(row) {
  const isCredit = row.querySelector(".line-effect").value === "credit";
  const field = row.querySelector(".line-credit-description-field");
  const input = row.querySelector(".line-credit-description");
  field.hidden = !isCredit;
  input.required = isCredit;
}

function isFiveUserBundle(productName) {
  return productName === "Additional 5 User Bundle";
}

function isDataOnlyUserBundle(productName) {
  return productName === "Data-Only Users (Bundle of 10)";
}

function isSinglePermittedUser(productName) {
  return productName === "Additional User" || productName === "JEFS User";
}

function defaultsCurrentQuantityToFive(productName) {
  return isSinglePermittedUser(productName) || isFiveUserBundle(productName);
}

function usesCurrentQuantity(productName) {
  return isSinglePermittedUser(productName) || isFiveUserBundle(productName) || isDataOnlyUserBundle(productName);
}

function syncQuantityFields(row) {
  const productName = row.querySelector(".line-product").value;
  const tracksCurrentQuantity = usesCurrentQuantity(productName);
  const added = row.querySelector(".line-renewal-mode").checked;
  row.querySelector(".line-current-quantity-field").hidden = !(added && isDataOnlyUserBundle(productName));
  const suffix = added ? "being added" : "being renewed";
  row.querySelector(".line-added-quantity-label").textContent = isFiveUserBundle(productName) ? `5-user bundles ${suffix}` : isDataOnlyUserBundle(productName) ? `10-user bundles ${suffix}` : tracksCurrentQuantity ? `Additional users ${suffix}` : added ? "Quantity being added" : "Renewal quantity";
}

const discountNames = {
  education: "Education / Non-profit Discount",
  multiyear: "Multi-Year Discount",
  reseller: "Reseller Discount",
  renewal: "Renewal Discount (Only for 5-User Bundle)",
};

const discountDefaultRates = { education: "30", multiyear: "10", reseller: "30" };

function suggestedMultiYearRate() {
  const months = wholeNumberValue(fields.monthsRemaining);
  if (months >= 37 && months <= 60) return "15";
  if (months >= 13 && months <= 36) return "10";
  return "";
}

function syncSuggestedMultiYearRates() {
  discountList.querySelectorAll(".discount-line").forEach((discountRow) => {
    if (discountRow.querySelector(".discount-type").value !== "multiyear") return;
    if (discountRow.dataset.rateManual === "true") return;
    discountRow.querySelector(".discount-rate-option").value = suggestedMultiYearRate();
    syncDiscountInputs(discountRow);
  });
}

const educationDiscountProducts = new Set([
  "Salesforce AppExchange Package",
  "Additional User",
  "Additional 5 User Bundle",
  "Salesforce AppExchange Per User Additional Fee",
]);

function isEducationDiscountEligible(product) {
  if (!product) return true;
  return product.category === "Base Packages" || educationDiscountProducts.has(product.product);
}

function discountTypeFromName(name = "") {
  const normalized = name.trim().toLowerCase();
  const match = Object.entries(discountNames).find(([, label]) => label.toLowerCase() === normalized);
  return match?.[0] || "custom";
}

function syncDiscountInputs(discountRow) {
  const type = discountRow.querySelector(".discount-type").value;
  const rateOption = discountRow.querySelector(".discount-rate-option").value;
  const customNameField = discountRow.querySelector(".discount-custom-name-field");
  const customRateField = discountRow.querySelector(".discount-custom-rate-field");
  const customName = discountRow.querySelector(".discount-custom-name");
  const customRate = discountRow.querySelector(".discount-custom-rate");
  customNameField.hidden = type !== "custom";
  customRateField.hidden = type !== "custom" && rateOption !== "custom";
  discountRow.querySelector(".discount-rate-option").disabled = type === "custom";
  customName.required = type === "custom";
  customRate.required = rateOption === "custom";
}

function discountRowsFor(row) {
  const product = productByName(row.querySelector(".line-product").value);
  return [...discountList.querySelectorAll(".discount-line")].filter((discountRow) => {
    const type = discountRow.querySelector(".discount-type").value;
    if (type === "education") return isEducationDiscountEligible(product);
    return true;
  });
}

function suggestedRenewalRate() {
  const hasEducationDiscount = [...discountList.querySelectorAll(".discount-line")].some((discountRow) => (
    discountRow.querySelector(".discount-type").value === "education"
  ));
  return hasEducationDiscount ? "15" : "30";
}

function addDiscountLine(values = {}) {
  const discountRow = discountLineTemplate.content.firstElementChild.cloneNode(true);
  const typeSelect = discountRow.querySelector(".discount-type");
  const rateSelect = discountRow.querySelector(".discount-rate-option");
  const customName = discountRow.querySelector(".discount-custom-name");
  const customRate = discountRow.querySelector(".discount-custom-rate");
  const defaultType = "education";
  const type = values.type || (values.name ? discountTypeFromName(values.name) : defaultType);
  const rate = values.rate ?? (type === "custom" ? "" : Number(discountDefaultRates[type] || 30));
  typeSelect.value = type;
  customName.value = type === "custom" ? (values.name || "") : "";
  if (type === "custom") {
    rateSelect.value = "custom";
    customRate.value = rate;
  } else if ([30, 15, 10].includes(Number(rate))) rateSelect.value = String(Number(rate));
  else {
    rateSelect.value = "custom";
    customRate.value = rate;
  }
  discountRow.dataset.rateManual = String(values.rateManual ?? (values.rate !== undefined));
  discountList.append(discountRow);
  typeSelect.addEventListener("change", () => {
    const nextType = typeSelect.value;
    rateSelect.value = nextType === "custom"
      ? "custom"
      : nextType === "multiyear"
        ? suggestedMultiYearRate()
        : discountDefaultRates[nextType];
    discountRow.dataset.rateManual = "false";
    if (nextType === "custom") customRate.value = "";
    syncDiscountInputs(discountRow);
    calculate();
  });
  rateSelect.addEventListener("input", () => {
    discountRow.dataset.rateManual = "true";
  });
  rateSelect.addEventListener("change", () => {
    syncDiscountInputs(discountRow);
    calculate();
  });
  customName.addEventListener("input", () => {
    calculate();
  });
  customRate.addEventListener("input", () => {
    calculate();
  });
  discountRow.querySelector(".remove-line-discount").addEventListener("click", () => {
    discountRow.remove();
    calculate();
  });
  syncDiscountInputs(discountRow);
  calculate();
  return discountRow;
}

function syncBackChargeTerm(row) {
  const isBackCharge = row.querySelector(".line-basis").value === "back-charge";
  const termInput = row.querySelector(".line-back-charge-months");
  row.querySelector(".line-back-charge-term-field").hidden = !isBackCharge;
  termInput.disabled = !isBackCharge;
  termInput.required = isBackCharge;
  if (isBackCharge && termInput.dataset.initialized !== "true") {
    termInput.value = wholeNumberValue(fields.monthsRemaining);
    termInput.dataset.initialized = "true";
  }
}

function addCostLine(values = {}, position = "bottom") {
  const row = costLineTemplate.content.firstElementChild.cloneNode(true);
  row.dataset.lineId = String(nextCostLineId++);
  row.addEventListener("invalid", () => { row.querySelector(".product-details").open = true; }, true);
  const productSelect = row.querySelector(".line-product");
  buildProductOptions(productSelect);
  productSelect.value = values.product || "";
  row.querySelector(".line-renewal-mode").checked = values.renewalMode === "added";
  row.querySelector(".line-label").value = values.label || productByName(values.product)?.pdfLabel || values.product || "";
  row.querySelector(".line-current-quantity").value = values.currentQuantity ?? 0;
  row.querySelector(".line-new-quantity").value = values.newQuantity ?? 1;
  row.querySelector(".line-basis").value = values.basis || productByName(values.product)?.defaultBasis || "annual";
  if (values.backChargeMonths !== undefined) {
    const termInput = row.querySelector(".line-back-charge-months");
    termInput.value = values.backChargeMonths;
    termInput.dataset.initialized = "true";
  }
  row.querySelector(".line-effect").value = values.effect || "charge";
  row.querySelector(".line-credit-description").value = values.creditDescription || "";
  row.querySelector(".line-waived").checked = Boolean(values.waived);
  row.dataset.effectManual = String(Boolean(values.effect));
  row.dataset.catalogLinked = String(Boolean(values.product));

  const selected = productByName(productSelect.value);
  row.querySelector(".line-unit-price").value = Number(values.unitPrice ?? selected?.prices[fields.currency.value] ?? 0).toFixed(2);
  if (defaultsCurrentQuantityToFive(selected?.product) && wholeNumberValue(row.querySelector(".line-current-quantity")) === 0) {
    row.querySelector(".line-current-quantity").value = 5;
  }

  productSelect.addEventListener("change", () => {
    productSelect.removeAttribute("aria-invalid");
    const item = productByName(productSelect.value);
    row.dataset.catalogLinked = String(Boolean(item));
    if (item) {
      row.querySelector(".line-label").value = item.pdfLabel || item.product;
      row.querySelector(".line-basis").value = item.defaultBasis || (item.annual === false ? "one-time" : "annual");
      updateLinkedUnitPrice(row);
      if (defaultsCurrentQuantityToFive(item.product) && wholeNumberValue(row.querySelector(".line-current-quantity")) === 0) {
        row.querySelector(".line-current-quantity").value = 5;
      }
    }
    syncQuantityFields(row);
    syncBackChargeTerm(row);
    reorderCostRowsToPdfOrder();
    calculate();
  });
  row.querySelector(".line-basis").addEventListener("change", () => {
    syncBackChargeTerm(row);
    updateLinkedUnitPrice(row);
    calculate();
  });
  row.querySelector(".line-unit-price").addEventListener("input", () => {
    row.dataset.catalogLinked = "false";
    calculate();
  });
  row.querySelectorAll(".line-current-quantity, .line-new-quantity").forEach((input) => {
    input.addEventListener("input", calculate);
  });
  row.querySelector(".line-effect").addEventListener("change", () => {
    row.dataset.effectManual = "true";
    syncCreditDescription(row);
    calculate();
  });
  row.querySelectorAll("input, select").forEach((control) => {
    if (control.matches(".line-basis, .line-unit-price, .line-current-quantity, .line-new-quantity, .line-effect")) return;
    control.addEventListener("input", calculate);
  });
  row.querySelector(".remove-cost-line").addEventListener("click", () => {
    row.remove();
    calculate();
  });
  syncCreditDescription(row);
  syncQuantityFields(row);
  syncBackChargeTerm(row);
  if (position === "top") costLineList.prepend(row);
  else costLineList.append(row);
  if (position === "top") reorderCostRowsToPdfOrder();
  (values.discounts || []).forEach((discount) => addDiscountLine(discount));
  calculate();
  return row;
}

function getCostLines() {
  const months = wholeNumberValue(fields.monthsRemaining);
  return [...costLineList.querySelectorAll(".cost-line")].map((row) => {
    const selectedProduct = productByName(row.querySelector(".line-product").value);
    const label = row.querySelector(".line-label").value.trim() || selectedProduct?.product || "[Select feature]";
    const tracksCurrentQuantity = usesCurrentQuantity(selectedProduct?.product);
    const currentQuantity = tracksCurrentQuantity ? wholeNumberValue(row.querySelector(".line-current-quantity")) : 0;
    const changeQuantity = wholeNumberValue(row.querySelector(".line-new-quantity"));
    const addedPermittedUsers = isFiveUserBundle(selectedProduct?.product)
      ? changeQuantity * 5
      : isDataOnlyUserBundle(selectedProduct?.product)
        ? changeQuantity * 10
        : changeQuantity;
    const newQuantity = tracksCurrentQuantity ? currentQuantity + addedPermittedUsers : changeQuantity;
    const unitPrice = Math.max(0, numericValue(row.querySelector(".line-unit-price")));
    const waived = row.querySelector(".line-waived").checked;
    let invalidDiscountControl = null;
    const discounts = discountRowsFor(row).map((discountRow) => {
      const type = discountRow.querySelector(".discount-type").value;
      const rateOption = discountRow.querySelector(".discount-rate-option").value;
      const customName = discountRow.querySelector(".discount-custom-name");
      const customRate = discountRow.querySelector(".discount-custom-rate");
      if (type === "education" && !isEducationDiscountEligible(selectedProduct)) {
        if (!invalidDiscountControl) invalidDiscountControl = discountRow.querySelector(".discount-type");
        return null;
      }
      const name = type === "custom" ? customName.value.trim() : discountNames[type];
      if (!rateOption) return null;
      const rateMissing = rateOption === "custom" && !customRate.value.trim();
      if (!invalidDiscountControl && type === "custom" && !name) invalidDiscountControl = customName;
      if (!invalidDiscountControl && rateMissing) invalidDiscountControl = customRate;
      const rawRate = rateOption === "custom" ? numericValue(customRate) : Number(rateOption);
      return { row: discountRow, type, name: name || "Customized Discount", rate: Math.min(100, Math.max(0, rawRate)), amount: 0 };
    }).filter(Boolean);
    if (isFiveUserBundle(selectedProduct?.product)) {
      discounts.push({ row: null, type: "renewal", name: discountNames.renewal, rate: Number(suggestedRenewalRate()), amount: 0, automatic: true });
    }
    const basis = row.querySelector(".line-basis").value;
    const backChargeTermInput = row.querySelector(".line-back-charge-months");
    const termMonths = basis === "back-charge" ? wholeNumberValue(backChargeTermInput) : months;
    const invalidTermControl = basis === "back-charge" && !waived && (
      !backChargeTermInput.value.trim() || !backChargeTermInput.validity.valid
    ) ? backChargeTermInput : null;
    const effect = row.querySelector(".line-effect").value;
    const creditDescriptionInput = row.querySelector(".line-credit-description");
    const creditDescription = creditDescriptionInput.value.trim();
    const invalidCreditControl = effect === "credit" && !waived && !creditDescription ? creditDescriptionInput : null;
    const missingFeature = label === "[Select feature]";
    let grossTotal = waived ? 0 : changeQuantity * unitPrice;
    if (basis === "annual" || basis === "back-charge") grossTotal *= termMonths / 12;
    if (basis === "monthly") grossTotal *= months;
    let total = grossTotal;
    discounts.forEach((discount) => {
      discount.amount = total * (discount.rate / 100);
      total -= discount.amount;
    });
    if (effect !== "charge") total *= -1;
    return { renewalMode: row.querySelector(".line-renewal-mode").checked ? "added" : "renew", row, selectedProduct, label, currentQuantity, newQuantity, changeQuantity, unitPrice, discounts, basis, termMonths, effect, grossTotal, total, waived, missingFeature, invalidTermControl, invalidDiscountControl, creditDescription, invalidCreditControl };
  });
}

function formulaFor(item, months) {
  if (item.waived) return "Waived";
  const discountText = item.discounts.length
    ? ` less ${item.discounts.map((discount) => `${discount.name} ${discount.rate}%`).join(", then ")}`
    : "";
  const signText = item.effect === "credit" ? "service credit: " : item.effect === "reduction" ? "reduction: " : "";
  if (item.basis === "annual") return `${signText}${item.changeQuantity} × ${formatMoney(item.unitPrice)}/year × ${months}/12${discountText}`;
  if (item.basis === "back-charge") return `${signText}back charge: ${item.changeQuantity} × ${formatMoney(item.unitPrice)}/year × ${item.termMonths}/12${discountText}`;
  if (item.basis === "monthly") return `${signText}${item.changeQuantity} × ${formatMoney(item.unitPrice)}/month × ${months} months${discountText}`;
  if (item.basis === "one-time") return `${signText}${item.changeQuantity} × ${formatMoney(item.unitPrice)} one-time${discountText}`;
  return `${signText}${item.changeQuantity} × ${formatMoney(item.unitPrice)} final amount${discountText}`;
}

function plainFeatureName(item) {
  const name = item.label.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  return name;
}

function pluralFeatureName(name) {
  if (name === "Additional Custom Domain") return "Custom Domains";
  if (/\b(Compliance|Provisioning|Services)$/i.test(name)) return name;
  if (/[^aeiou]y$/i.test(name)) return `${name.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(name)) return `${name}es`;
  return `${name}s`;
}

function countWord(value) {
  const words = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN"];
  return words[value] || String(value);
}

function clauseFor(item, agreementType) {
  if (item.effect === "credit") return `Customer will receive a service credit for ${item.creditDescription || plainFeatureName(item)}.`;
  if (item.effect === "reduction") return `A cost reduction for ${plainFeatureName(item)} will apply to this renewal.`;
  const action = "added to";
  const productName = item.selectedProduct?.product || "";
  if (productName === "Adding a New HIPAA Server") {
    return "Addition of (1) Jotform Enterprise HIPAA-Enabled Instance (includes 5 Permitted Users).";
  }
  if (productName === "JEFS Base Package") {
    return "Addition of (1) Jotform Enterprise for Salesforce Instance (includes 5 Permitted Users).";
  }
  if (productName === "Jotform Enterprise Base Package (includes 5 users)") {
    return "Addition of (1) Jotform Enterprise Instance (includes 5 Permitted Users).";
  }
  if (productName === "Jotform Government Base Package (includes 5 users)") {
    return "Addition of (1) Jotform Government Instance (includes 5 Permitted Users).";
  }
  if (productName === "Server Migration Fee (Non-HIPAA to H)") {
    return "Jotform will migrate up to five (5) forms from the Customer’s non-HIPAA instance to the HIPAA instance.";
  }
  if (productName === "Professional Services") {
    return "Request for Professional Services.";
  }
  if (productName === "Custom Domain Change Fee") {
    return "One Time Custom Domain Change";
  }
  if (productName === "Additional Custom Domain") {
    if (item.changeQuantity === 1) return "One (1) Additional Custom Domain will be added.";
    const quantityWord = countWord(item.changeQuantity).toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
    return `${quantityWord} (${item.changeQuantity}) Additional Custom Domains will be added.`;
  }
  if (productName === "Salesforce AppExchange Package") {
    return "Customer’s Jotform Enterprise instance is hereby being upgraded to Jotform Enterprise for Salesforce (“JEFS”). JEFS is comprised of Jotform Enterprise with the added functionality of the Customer’s Jotform instance working inside of and with the Salesforce AppExchange environment, allowing for the automatic inputting of form submission data into Customer’s Salesforce instance.";
  }
  if (productName === "Additional User") {
    return `The number of Permitted Users stated on the ${agreementType} is hereby changed from ${item.currentQuantity} Permitted Users to ${item.newQuantity} Permitted Users.`;
  }
  if (productName === "Data-Only Users (Bundle of 10)") {
    return `The number of Data Only Users stated on the ${agreementType} is hereby changed from ${item.currentQuantity} Data Only Users to ${item.newQuantity} Data Only Users.`;
  }
  if (isFiveUserBundle(productName)) {
    const renewalDiscount = item.discounts.find((discount) => discount.type === "renewal");
    if (renewalDiscount) {
      const bundleLabel = item.changeQuantity === 1 ? "renewal Bundle" : "renewal Bundles";
      return `Number of Permitted Users is adjusted from ${item.currentQuantity} to ${item.newQuantity} to include ${countWord(item.changeQuantity)} ${bundleLabel} of 5 Users, at the additional discount of ${formatPercent(renewalDiscount.rate)}% available only to these additional user bundles, and only at time of renewal.`;
    }
  }
  if (item.selectedProduct?.category === "One-Time Fees") {
    return `A ${plainFeatureName(item)} will apply to the changes described in this Addendum.`;
  }
  const featureName = plainFeatureName(item);
  const describedFeature = item.changeQuantity > 1
    ? `${item.changeQuantity} ${pluralFeatureName(featureName)}`
    : featureName;
  return `${describedFeature} will be ${action} Customer's Jotform Enterprise subscription.`;
}

function appendDocumentCost(label, value, className = "", container = null) {
  const list = container || document.querySelector("#document-cost-list");
  if (!list) return;
  const wrapper = document.createElement("div");
  if (className) wrapper.className = className;
  const term = document.createElement("dt");
  const detail = document.createElement("dd");
  term.textContent = `${label}:`;
  if (value instanceof Node) detail.append(value);
  else detail.textContent = value;
  wrapper.append(term, detail);
  list.append(wrapper);
}

function bundlePriceDisplay(originalPrice, discountedPrice, suffix, isCredit) {
  const display = document.createElement("span");
  display.className = "bundle-inline-discount-price";
  const original = document.createElement("s");
  const discounted = document.createElement("strong");
  const sign = isCredit ? "-" : "";
  original.textContent = `${sign}${formatMoney(originalPrice)}${suffix}`;
  discounted.textContent = `${sign}${formatMoney(discountedPrice)}${suffix}`;
  display.append(original, discounted);
  return display;
}

function productPriority(product, label = "") {
  if (!product && !label) return -1;
  if (product?.category === "Base Packages") return -2;
  const productName = product?.product || label;
  if (/\busers?\b/i.test(productName)) return 1;
  return 2;
}

function pdfLinePriority(item) {
  return productPriority(item.selectedProduct, item.label);
}

function reorderCostRowsToPdfOrder() {
  [...costLineList.querySelectorAll(".cost-line")]
    .map((row, index) => {
      const product = productByName(row.querySelector(".line-product").value);
      const label = row.querySelector(".line-label").value.trim();
      return { row, index, priority: productPriority(product, label) };
    })
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .forEach(({ row }) => costLineList.append(row));
}

function orderedPdfLines(lines) {
  return lines
    .map((item, index) => ({ item, index }))
    .sort((a, b) => pdfLinePriority(a.item) - pdfLinePriority(b.item) || a.index - b.index)
    .map(({ item }) => item);
}

function includedBaseUsers(lines) {
  return lines.reduce((count, item) => item.selectedProduct?.category === "Base Packages" && item.effect === "charge"
    ? count + (item.selectedProduct.product.includes("Light") ? 3 : 5) * item.changeQuantity
    : count, 0);
}

function renewalUserCount(lines) {
  return includedBaseUsers(lines) + lines.reduce((count, item) => {
    if (item.effect !== "charge") return count;
    const name = item.selectedProduct?.product;
    return count + (isSinglePermittedUser(name) ? item.changeQuantity : isFiveUserBundle(name) ? item.changeQuantity * 5 : 0);
  }, 0);
}

function renderDocumentCosts(lines, months) {
  const list = document.querySelector("#document-cost-list");
  if (!list) return;
  list.replaceChildren();
  let hasRecurring = false;
  const trailingDiscounts = new Map();
  const orderedLines = orderedPdfLines(lines);
  const regularLines = orderedLines.filter((item) => item.basis !== "back-charge");
  const backChargeLines = orderedLines.filter((item) => item.basis === "back-charge");
  regularLines.forEach((item) => {
    const group = document.createElement("div");
    group.className = "cost-item-group";
    list.append(group);
    const baseLabel = item.effect === "credit" ? `Service credit — ${item.creditDescription || plainFeatureName(item)}` : item.effect === "reduction" ? `Reduction — ${plainFeatureName(item)}` : plainFeatureName(item);
    const isPermittedUserLine = usesCurrentQuantity(item.selectedProduct?.product);
    const isFiveUserBundleLine = isFiveUserBundle(item.selectedProduct?.product);
    const isBase = item.selectedProduct?.category === "Base Packages";
    const productLabel = isBase ? item.label.replace("users", "Permitted Users") : item.basis === "one-time" ? `${baseLabel} (One-Time)` : baseLabel;
    const quantityLabel = isFiveUserBundleLine
      ? "Number of 5-User Bundle"
      : isSinglePermittedUser(item.selectedProduct?.product)
        ? "Number of Additional Permitted Users, if any"
        : productLabel;
    appendDocumentCost(quantityLabel, String(item.changeQuantity), "", group);
    const suffix = item.basis === "annual" ? "/year" : item.basis === "monthly" ? "/month" : "";
    const displayedUnitPrice = isFiveUserBundleLine
      ? item.discounts.filter((discount) => discount.type === "renewal").reduce((price, discount) => price * (1 - discount.rate / 100), item.unitPrice)
      : item.unitPrice;
    const educationDiscount = item.discounts.find((discount) => discount.type === "education");
    const value = item.waived
      ? "Waived"
      : isFiveUserBundleLine
        ? bundlePriceDisplay(
          educationDiscount ? item.unitPrice * 0.7 : item.unitPrice,
          educationDiscount ? displayedUnitPrice * (1 - educationDiscount.rate / 100) : displayedUnitPrice,
          suffix,
          item.effect !== "charge",
        )
        : item.effect !== "charge" ? `-${formatMoney(displayedUnitPrice)}${suffix}` : `${formatMoney(displayedUnitPrice)}${suffix}`;
    const costLabel = item.effect !== "charge"
      ? `Cost of ${baseLabel}`
      : isPermittedUserLine
        ? `Cost of ${baseLabel}`
        : isBase ? "Cost of Base Package" : `Cost of ${baseLabel}`;
    appendDocumentCost(costLabel, value, item.effect !== "charge" ? "credit-row" : "", group);
    if (!item.waived) {
      [...item.discounts].sort((a, b) => Number(b.type === "education") - Number(a.type === "education")).forEach((discount) => {
        if (discount.type === "education") {
          if (!isFiveUserBundleLine) {
            appendDocumentCost(discount.name, `${formatPercent(discount.rate)}%`, "discount-row", group);
          }
        } else if (!(isFiveUserBundleLine && discount.type === "renewal")) {
          trailingDiscounts.set(discount.row, discount);
        }
      });
    }
    if (item.basis === "annual" || item.basis === "monthly") hasRecurring = true;
  });
  if (hasRecurring) appendDocumentCost("Term", `${months} months`);
  if (backChargeLines.length && regularLines.length) {
    appendDocumentCost(`Back Charge Costs (all amounts in ${fields.currency.value})`, "", "back-charge-heading");
  }
  backChargeLines.forEach((item) => {
    const group = document.createElement("div");
    group.className = "cost-item-group back-charge-item";
    list.append(group);
    const productName = item.selectedProduct?.product || "";
    const unitMultiplier = isFiveUserBundle(productName) ? 5 : isDataOnlyUserBundle(productName) ? 10 : 1;
    const totalUnitMonths = item.changeQuantity * unitMultiplier * item.termMonths;
    const isUserCharge = usesCurrentQuantity(productName);
    appendDocumentCost(isUserCharge ? "Number of Total User Months" : "Number of Total Unit Months", String(totalUnitMonths), "", group);
    const unitPrice = item.effect !== "charge" ? `-${formatMoney(item.unitPrice)}/year` : `${formatMoney(item.unitPrice)}/year`;
    appendDocumentCost(isUserCharge ? "Cost Per User" : "Cost Per Unit", item.waived ? "Waived" : unitPrice, item.effect !== "charge" ? "credit-row" : "", group);
    const totalValue = item.waived ? "Waived" : item.total < 0 ? `-${formatMoney(Math.abs(item.total))}` : formatMoney(item.total);
    appendDocumentCost("Cost", totalValue, item.effect !== "charge" ? "credit-row" : "", group);
    if (!item.waived) {
      item.discounts.forEach((discount) => {
        if (discount.type === "education") {
          if (!isFiveUserBundle(productName)) {
            appendDocumentCost(discount.name, `${formatPercent(discount.rate)}%`, "discount-row", group);
          }
        } else if (!(isFiveUserBundle(productName) && discount.type === "renewal")) {
          trailingDiscounts.set(discount.row, discount);
        }
      });
    }
  });
  trailingDiscounts.forEach((discount) => {
    appendDocumentCost(discount.type === "multiyear" ? "Multiyear Upfront Payment Discount" : discount.name, `${formatPercent(discount.rate)}%`, "discount-row");
  });
  if (![...trailingDiscounts.values()].some(discount => discount.type === "multiyear")) appendDocumentCost("Multiyear Upfront Payment Discount", "N/A");
}

function permittedUserDelta(lines) {
  return lines.reduce((count, item) => {
    const name = item.selectedProduct?.product;
    if (!isSinglePermittedUser(name) && !isFiveUserBundle(name)) return count;
    if (item.renewalMode !== "added" || item.effect === "credit") return count;
    return count + item.changeQuantity * (isFiveUserBundle(name) ? 5 : 1) * (item.effect === "reduction" ? -1 : 1);
  }, 0);
}

function syncUserCardsFromCounts() {
  if (!fields.previousUsers.value || !fields.renewedUsers.value || !fields.previousUsers.validity.valid || !fields.renewedUsers.validity.valid) return;
  syncingUserCounts = true;
  try {
    const lines = getCostLines();
    const existing = lines.find(item => isSinglePermittedUser(item.selectedProduct?.product) && item.effect !== "credit");
    const otherDelta = permittedUserDelta(lines.filter(item => item !== existing));
    const difference = wholeNumberValue(fields.renewedUsers) - wholeNumberValue(fields.previousUsers) - otherDelta;
    if (!difference) {
      if (existing?.renewalMode === "added") existing.row.remove();
    } else {
      const row = existing?.row || addCostLine({product: lines.some(item => item.selectedProduct?.product === "JEFS Base Package") ? "JEFS User" : "Additional User", newQuantity: Math.abs(difference), effect: difference < 0 ? "reduction" : "charge", renewalMode: "added"});
      row.querySelector(".line-new-quantity").value = Math.abs(difference);
      row.querySelector(".line-current-quantity").value = wholeNumberValue(fields.previousUsers);
      row.querySelector(".line-effect").value = difference < 0 ? "reduction" : "charge";
      row.dataset.effectManual = "true";
      row.querySelector(".line-renewal-mode").checked = true;
      syncCreditDescription(row);
    }
  } finally {
    syncingUserCounts = false;
  }
}

function renderDocument(lines, months, totalUsed) {
  if (!syncingUserCounts) {
    const baseline = wholeNumberValue(fields.previousUsers);
    fields.renewedUsers.value = Math.max(0, baseline + permittedUserDelta(lines));
  }
  if (documentCustomized) return;
  flattenPaginatedDocument();
  for (const name of ["addendumNumber", "agreementType", "customerName", "jotformEntity", "customerSignerName", "customerSignerTitle", "jotformSignerName", "jotformSignerTitle"]) {
    setOutput(name, fields[name].value.trim() || (name === "customerName" ? "Customer" : name === "addendumNumber" ? "_" : ""));
  }
  setOutput("agreementDate", formatDate(fields.agreementDate.value));
  setOutput("currencyLabel", `${fields.currency.value}${currencySymbols[fields.currency.value]}`);
  setOutput("totalUsed", formatMoney(totalUsed));
  const clauses = [
    `Customer hereby agrees to extend the “Term” of the Agreement to ${fields.renewalEndDate.value ? formatDate(fields.renewalEndDate.value) : "[Renewal end date]"}.`
  ];
  const addedLines = orderedPdfLines(lines).filter(item => item.renewalMode === "added" && !item.missingFeature);
  const isPermittedUser = item => isSinglePermittedUser(item.selectedProduct?.product) || isFiveUserBundle(item.selectedProduct?.product);
  const currentUsers = wholeNumberValue(fields.previousUsers);
  const renewedUsers = wholeNumberValue(fields.renewedUsers);
  if (currentUsers !== renewedUsers) {
    clauses.push(`The number of Permitted Users stated on the ${fields.agreementType.value} is hereby changed from ${currentUsers} Permitted Users to ${renewedUsers} Permitted Users.`);
  }
  addedLines.filter(item => !isPermittedUser(item) || item.effect === "credit").forEach(item => {
    clauses.push(clauseFor(item, fields.agreementType.value));
  });
  clauses.push("The following renewal costs shall apply to the above-described changes:");
  document.querySelector("#document-clauses").replaceChildren(...clauses.map(text => {
    const li = document.createElement("li"); li.textContent = text; return li;
  }));
  document.querySelector("#overage-paragraph").hidden = !includeOverageClause;
  renderDocumentCosts(lines, months);
  schedulePagination();
}

function addDefaultBase() {
  return addCostLine({product: products.find(p => p.category === "Base Packages").product, newQuantity: 1});
}

function calculate() {
  syncSuggestedMultiYearRates();
  const months = wholeNumberValue(fields.monthsRemaining);
  let firstBaseFound = false;
  costLineList.querySelectorAll(".cost-line").forEach(row => {
    const isBase = productByName(row.querySelector(".line-product").value)?.category === "Base Packages";
    const isPrimaryBase = isBase && !firstBaseFound;
    if (isBase) firstBaseFound = true;
    const checkbox = row.querySelector(".line-renewal-mode");
    row.querySelector(".line-added-control").hidden = isPrimaryBase;
    checkbox.disabled = isPrimaryBase;
    if (isPrimaryBase) checkbox.checked = false;
    const priceInput = row.querySelector(".line-unit-price");
    const product = productByName(row.querySelector(".line-product").value);
    priceInput.setCustomValidity(row.dataset.catalogLinked === "true" && product && product.prices[fields.currency.value] === undefined
      ? "Enter a unit price for this currency; the JEFS catalog price is available in USD only." : "");
    syncQuantityFields(row);
  });
  const lines = getCostLines();
  lines.forEach((item) => {
    item.row.querySelector(".line-formula").textContent = formulaFor(item, months);
    item.row.querySelector(".line-total").textContent = item.waived ? "Waived" : formatMoney(item.total);
    item.row.classList.toggle("is-credit", item.effect !== "charge");
    item.row.classList.toggle("is-waived", item.waived);
    const error = item.row.querySelector(".line-validation");
    if (item.missingFeature) error.textContent = "Select a catalog feature or enter a custom line label.";
    else if (item.changeQuantity === 0) error.textContent = "Renewal quantity must be at least 1.";
    else if (item.invalidTermControl) error.textContent = "Enter a back charge term in whole months (0 or more).";
    else if (item.invalidCreditControl) error.textContent = "Enter a description for this credit.";
    else if (item.invalidDiscountControl?.matches(".discount-type")) error.textContent = "Education / Non-profit Discount is not available for this product.";
    else if (item.invalidDiscountControl?.matches(".discount-rate-option")) error.textContent = "Select a discount rate.";
    else if (item.invalidDiscountControl) error.textContent = "Customized discounts require a name and rate.";
    else error.textContent = "";
    error.hidden = !error.textContent;
  });

  const calculatedTotal = lines.reduce((sum, item) => sum + item.total, 0);
  if (!totalIsOverridden) totalUsedInput.value = calculatedTotal.toFixed(2);
  const totalUsed = numericValue(totalUsedInput);
  document.querySelector("#calculated-total").textContent = formatMoney(calculatedTotal);
  resetTotalOverrideButton.hidden = !totalIsOverridden;
  document.querySelector("#override-status").textContent = totalIsOverridden
    ? "Manual override active. Select “Use calculated amount” to restore automatic updates."
    : "Updates automatically until a salesperson changes it.";

  renderDocument(lines, months, totalUsed);
  return lines;
}

function syncCurrency() {
  const currency = fields.currency.value;
  costLineList.querySelectorAll(".cost-line").forEach((row) => {
    updateLinkedUnitPrice(row);
  });
  document.querySelectorAll(".money-input > span:first-child").forEach((element) => { element.textContent = currencySymbols[currency]; });
  totalIsOverridden = false;
  calculate();
}

function setDocumentEditing(editing) {
  documentPage.contentEditable = "true";
  documentPage.spellcheck = true;
  previewState.textContent = documentCustomized ? "Customized PDF — edits preserved" : "Live editable preview";
}

function markDocumentCustomized() {
  if (documentCustomized) return;
  documentCustomized = true;
  resetDocumentButton.hidden = false;
  previewState.textContent = "Customized PDF — edits preserved";
}

documentPage.addEventListener("compositionstart", () => {
  documentComposing = true;
  window.cancelAnimationFrame(paginationFrame);
  paginationFrame = 0;
});
documentPage.addEventListener("compositionend", () => {
  documentComposing = false;
  schedulePagination();
});
documentPage.addEventListener("input", event => {
  markDocumentCustomized();
  if (!event.isComposing && !documentComposing) schedulePagination();
});

function syncSignatureField(target) {
  const name = ["customerName", "jotformEntity", "customerSignerName", "customerSignerTitle", "jotformSignerName", "jotformSignerTitle"].find(name => fields[name] === target);
  if (!name) return;
  setOutput(name, target.value.trim() || (name === "customerName" ? "Customer" : ""));
  if (documentCustomized) schedulePagination();
}

function resumesAutomaticPricing(target) {
  return target === fields.monthsRemaining
    || target === fields.currency
    || Boolean(target.closest(".cost-line, .discount-line"));
}

function openFeedbackForm() {
  const frame = feedbackModal.querySelector("iframe");
  if (!frame.getAttribute("src")) frame.src = frame.dataset.src;
  feedbackModal.hidden = false;
  document.body.classList.add("feedback-open");
  feedbackCloseButton.focus();
}

function closeFeedbackForm() {
  feedbackModal.hidden = true;
  document.body.classList.remove("feedback-open");
  feedbackButton.focus();
}

feedbackButton.addEventListener("click", openFeedbackForm);
feedbackCloseButton.addEventListener("click", closeFeedbackForm);
feedbackModal.addEventListener("mousedown", (event) => {
  if (event.target === feedbackModal) closeFeedbackForm();
});
toggleOverageClauseButton.addEventListener("click", () => {
  includeOverageClause = !includeOverageClause;
  documentPage.querySelector("#overage-paragraph").hidden = !includeOverageClause;
  if (documentCustomized) schedulePagination();
  toggleOverageClauseButton.setAttribute("aria-pressed", String(includeOverageClause));
  toggleOverageClauseButton.textContent = includeOverageClause
    ? "Remove Auto-Expansion Clause"
    : "Include Auto-Expansion Clause";
  calculate();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !feedbackModal.hidden) closeFeedbackForm();
});

resetDocumentButton.addEventListener("click", () => {
  if (!window.confirm("Reset all manual PDF text edits and return to the automatic preview?")) return;
  documentCustomized = false;
  resetDocumentButton.hidden = true;
  documentPage.innerHTML = automaticDocumentTemplate;
  calculate();
  setDocumentEditing(true);
});

form.addEventListener("input", (event) => {
  if (event.target === totalUsedInput) return;
  if (event.target === fields.previousUsers || event.target === fields.renewedUsers) {
    if (!fields.previousUsers.value || !fields.renewedUsers.value || !fields.previousUsers.validity.valid || !fields.renewedUsers.validity.valid) return;
    syncUserCardsFromCounts();
  }
  syncSignatureField(event.target);
  if (resumesAutomaticPricing(event.target)) totalIsOverridden = false;
  calculate();
});
form.addEventListener("change", (event) => {
  if (event.target === fields.currency) { syncCurrency(); return; }
  if (event.target === fields.previousUsers || event.target === fields.renewedUsers) {
    if (!fields.previousUsers.value || !fields.renewedUsers.value || !fields.previousUsers.validity.valid || !fields.renewedUsers.validity.valid) return;
    syncUserCardsFromCounts();
  }
  syncSignatureField(event.target);
  if (resumesAutomaticPricing(event.target)) totalIsOverridden = false;
  calculate();
});
totalUsedInput.addEventListener("input", () => { totalIsOverridden = true; calculate(); });
resetTotalOverrideButton.addEventListener("click", () => { totalIsOverridden = false; calculate(); });
function createDatePicker(input, pickerButton, prefix) {
  const agreementDateField = document.querySelector(`#${input.id}-field`);
  const agreementDateCalendar = document.querySelector(`#${input.id}-calendar`);
  const calendarMonth = document.querySelector(`#${prefix}-month`);
  const calendarYear = document.querySelector(`#${prefix}-year`);
  const calendarDays = document.querySelector(`#${prefix}-days`);
  const calendarDateFormatter = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });
  let calendarView = new Date();
  calendarView.setDate(1);
  
  for (let month = 0; month < 12; month += 1) {
    const option = document.createElement("option");
    option.value = String(month);
    option.textContent = new Intl.DateTimeFormat("en-US", { month: "long" }).format(new Date(2000, month, 1));
    calendarMonth.append(option);
  }
  
  function enteredAgreementDate() {
    const value = input.value.trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (iso) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setFullYear(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      return date.getFullYear() === Number(iso[1]) && date.getMonth() === Number(iso[2]) - 1 && date.getDate() === Number(iso[3]) ? date : null;
    }
    if (!/[a-z]/i.test(value) || !/\b\d{4}\b/.test(value)) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  
  function renderAgreementCalendar() {
    const year = calendarView.getFullYear();
    const month = calendarView.getMonth();
    const selected = enteredAgreementDate();
    const today = new Date();
    calendarMonth.value = String(month);
    calendarYear.value = String(year);
    document.querySelector(`#${prefix}-month-label`).textContent = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(calendarView);
    calendarDays.replaceChildren();
    for (let index = 0; index < calendarView.getDay(); index += 1) {
      const spacer = document.createElement("span");
      spacer.setAttribute("aria-hidden", "true");
      calendarDays.append(spacer);
    }
    const monthEnd = new Date(calendarView);
    monthEnd.setMonth(month + 1, 0);
    for (let day = 1; day <= monthEnd.getDate(); day += 1) {
      const date = new Date(calendarView);
      date.setDate(day);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(day);
      button.setAttribute("aria-label", calendarDateFormatter.format(date));
      button.setAttribute("aria-pressed", String(Boolean(selected && selected.toDateString() === date.toDateString())));
      if (today.toDateString() === date.toDateString()) button.setAttribute("aria-current", "date");
      button.addEventListener("click", () => selectAgreementCalendarDate(date));
      calendarDays.append(button);
    }
    if (!agreementDateCalendar.hidden) agreementDateCalendar.scrollIntoView({ block: "nearest" });
  }
  
  function openAgreementDateCalendar() {
    if (!agreementDateCalendar.hidden) return;
    calendarView = enteredAgreementDate() || new Date();
    calendarView.setDate(1);
    renderAgreementCalendar();
    agreementDateCalendar.hidden = false;
    input.setAttribute("aria-expanded", "true");
    pickerButton.setAttribute("aria-expanded", "true");
    agreementDateCalendar.scrollIntoView({ block: "nearest" });
  }
  
  function closeAgreementDateCalendar(restoreFocus = false) {
    agreementDateCalendar.hidden = true;
    input.setAttribute("aria-expanded", "false");
    pickerButton.setAttribute("aria-expanded", "false");
    if (restoreFocus) input.focus({ preventScroll: true });
  }
  
  function selectAgreementCalendarDate(date) {
    input.value = calendarDateFormatter.format(date);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    closeAgreementDateCalendar(true);
  }
  
  input.addEventListener("click", openAgreementDateCalendar);
  pickerButton.addEventListener("click", () => {
    if (agreementDateCalendar.hidden) openAgreementDateCalendar();
    else closeAgreementDateCalendar(true);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    openAgreementDateCalendar();
    (calendarDays.querySelector('[aria-pressed="true"]') || calendarDays.querySelector('[aria-current="date"]') || calendarDays.querySelector("button")).focus();
  });
  calendarMonth.addEventListener("change", () => {
    calendarView.setMonth(Number(calendarMonth.value));
    renderAgreementCalendar();
  });
  calendarYear.addEventListener("change", () => {
    const year = Number(calendarYear.value);
    if (Number.isInteger(year) && year >= 1 && year <= 9999) calendarView.setFullYear(year);
    renderAgreementCalendar();
  });
  document.querySelector(`#${prefix}-previous-month`).addEventListener("click", () => {
    calendarView.setMonth(calendarView.getMonth() - 1);
    renderAgreementCalendar();
  });
  document.querySelector(`#${prefix}-next-month`).addEventListener("click", () => {
    calendarView.setMonth(calendarView.getMonth() + 1);
    renderAgreementCalendar();
  });
  document.querySelector(`#${prefix}-today`).addEventListener("click", () => selectAgreementCalendarDate(new Date()));
  document.querySelector(`#${prefix}-close`).addEventListener("click", () => closeAgreementDateCalendar(true));
  document.addEventListener("pointerdown", (event) => {
    if (!agreementDateCalendar.hidden && !agreementDateField.contains(event.target)) closeAgreementDateCalendar();
  });
  document.addEventListener("focusin", (event) => {
    if (!agreementDateCalendar.hidden && !agreementDateField.contains(event.target)) closeAgreementDateCalendar();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !agreementDateCalendar.hidden) {
      event.preventDefault();
      closeAgreementDateCalendar(true);
    }
  });
  return { close: closeAgreementDateCalendar };
}
const datePickers = [
  createDatePicker(fields.agreementDate, fields.agreementDatePickerButton, "calendar"),
  createDatePicker(fields.renewalEndDate, document.querySelector("#renewal-end-date-picker-button"), "renewal-calendar"),
];
document.querySelectorAll(".add-cost-line-button").forEach((button) => {
  button.addEventListener("click", () => {
    const unfinished = [...costLineList.querySelectorAll(".cost-line")].find(row => !row.querySelector(".line-product").value);
    if (unfinished) {
      unfinished.querySelector(".product-details").open = true;
      const error = unfinished.querySelector(".line-validation");
      error.textContent = "Select a product before adding another feature.";
      error.hidden = false;
      const product = unfinished.querySelector(".line-product");
      product.setAttribute("aria-invalid", "true");
      product.focus();
      return;
    }
    costLineList.querySelectorAll(".product-details").forEach(details => { details.open = false; });
    const position = button.id === "add-cost-line-bottom" ? "bottom" : "top";
    const row = addCostLine({}, position);
    row.querySelector(".line-product").focus();
  });
});
document.querySelector("#add-discount-line").addEventListener("click", () => {
  const discountRow = addDiscountLine();
  discountRow?.querySelector(".discount-type").focus();
});
document.querySelector("#reset-form").addEventListener("click", () => {
  if (documentCustomized && !window.confirm("Reset the form and discard all manual PDF text edits?")) return;
  form.reset();
  syncingUserCounts = false;
  datePickers.forEach(picker => picker.close());
  costLineList.replaceChildren();
  discountList.replaceChildren();
  nextCostLineId = 1;
  totalIsOverridden = false;
  includeOverageClause = false;
  toggleOverageClauseButton.setAttribute("aria-pressed", "false");
  toggleOverageClauseButton.textContent = "Include Auto-Expansion Clause";
  documentCustomized = false;
  resetDocumentButton.hidden = true;
  documentPage.innerHTML = automaticDocumentTemplate;
  addDefaultBase();
  syncCurrency();
  setDocumentEditing(true);
});
document.querySelector("#download-pdf").addEventListener("click", () => {
  if (!form.reportValidity()) return;
  // Validate pricing without replacing manual preview edits.
  const lines = getCostLines();
  const invalid = lines.find((item) => item.missingFeature || item.changeQuantity === 0 || item.invalidTermControl || item.invalidCreditControl || item.invalidDiscountControl);
  if (invalid) {
    const target = invalid.missingFeature
      ? invalid.row.querySelector(".line-product")
      : invalid.changeQuantity === 0
        ? invalid.row.querySelector(".line-new-quantity")
        : invalid.invalidTermControl || invalid.invalidCreditControl || invalid.invalidDiscountControl;
    invalid.row.querySelector(".product-details").open = true;
    target.focus();
    return;
  }
  const previousTitle = document.title;
  const customerName = fields.customerName.value.trim() || "Customer";
  const addendumNumber = fields.addendumNumber.value.trim() || "1";
  document.title = `${customerName} - Jotform Enterprise - Addendum ${addendumNumber}`;
  completePendingPagination();
  const restoreTitle = () => { document.title = previousTitle; window.removeEventListener("afterprint", restoreTitle); };
  window.addEventListener("afterprint", restoreTitle, { once: true });
  window.print();
  window.setTimeout(restoreTitle, 60000);
});

addDefaultBase();
syncCurrency();
setDocumentEditing(true);

// Fit the A4 preview to the panel without changing the printed page dimensions.
const previewPanel = document.querySelector(".preview-panel");
new ResizeObserver(() => {
  const style = getComputedStyle(previewPanel);
  const available = previewPanel.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  documentPage.style.zoom = String(Math.min(1, Math.max(0.25, available / (210 * 96 / 25.4))));
  schedulePagination();
}).observe(previewPanel);

// Resizable editor panel. Save the percentage so it adapts to the window size.
const panelResizer = document.querySelector("#panel-resizer");
let editorWidth = 33;
try {
  const savedWidth = Number(localStorage.getItem("renewal-editor-width-v2"));
  if (savedWidth >= 30 && savedWidth <= 70) editorWidth = savedWidth;
} catch {}
function setEditorWidth(width, persist = false) {
  editorWidth = Math.min(70, Math.max(30, width));
  document.documentElement.style.setProperty("--editor-width", `${editorWidth}%`);
  panelResizer.setAttribute("aria-valuenow", String(Math.round(editorWidth)));
  panelResizer.setAttribute("aria-valuetext", `${Math.round(editorWidth)} percent`);
  if (persist) { try { localStorage.setItem("renewal-editor-width-v2", String(editorWidth)); } catch {} }
}
setEditorWidth(editorWidth);
let resizingPanels = false;
panelResizer.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;
  resizingPanels = true;
  panelResizer.setPointerCapture(event.pointerId);
  document.body.classList.add("resizing-panels");
  event.preventDefault();
});
panelResizer.addEventListener("pointermove", event => {
  if (!resizingPanels) return;
  const bounds = document.querySelector(".app-shell").getBoundingClientRect();
  setEditorWidth((event.clientX - bounds.left) / bounds.width * 100);
});
function finishPanelResize() {
  if (!resizingPanels) return;
  resizingPanels = false;
  document.body.classList.remove("resizing-panels");
  setEditorWidth(editorWidth, true);
}
panelResizer.addEventListener("pointerup", finishPanelResize);
panelResizer.addEventListener("pointercancel", finishPanelResize);
panelResizer.addEventListener("lostpointercapture", finishPanelResize);
panelResizer.addEventListener("dblclick", () => setEditorWidth(33, true));
panelResizer.addEventListener("keydown", event => {
  const width = event.key === "ArrowLeft" ? editorWidth - 2 : event.key === "ArrowRight" ? editorWidth + 2 : event.key === "Home" ? 30 : event.key === "End" ? 70 : null;
  if (width === null) return;
  event.preventDefault();
  setEditorWidth(width, true);
});
