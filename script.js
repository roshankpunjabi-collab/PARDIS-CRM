// =======================================
// PARDIS PROPERTIES CRM v6
// Same Supabase table/fields as before —
// presentation layer + new views added.
// =======================================

// ---------- DATA ----------

let units = [];
let currentUnit = null;
let currentView = "floor"; // inventory sub-view: "floor" | "grid"
let currentPage = "dashboard"; // "dashboard" | "inventory" | "customers" | "reports" | "settings"

// PROJECT — this same script.js powers every project's dashboard.
// Which project's units get loaded is set per-page via
// <body data-project="Sai Saburi"> (or "Chitragandha", etc.)
const PROJECT_NAME = document.body.dataset.project || "Sai Saburi";

// ---------- ELEMENTS ----------

const inventoryGrid = document.getElementById("inventoryGrid");

const totalUnits = document.getElementById("totalUnits");
const availableUnits = document.getElementById("availableUnits");
const holdUnits = document.getElementById("holdUnits");
const soldUnits = document.getElementById("soldUnits");

const search = document.getElementById("search");
const typeFilter = document.getElementById("typeFilter");
const statusFilter = document.getElementById("statusFilter");
const viewToggle = document.getElementById("viewToggle");

const customerSearch = document.getElementById("customerSearch");
const customerStatusFilter = document.getElementById("customerStatusFilter");
const customersTableBody = document.getElementById("customersTableBody");
const customersEmpty = document.getElementById("customersEmpty");

const popup = document.getElementById("popup");
const popupTitle = document.getElementById("popupTitle");
const closePopup = document.getElementById("closePopup");

const statusInput = document.getElementById("status");
const clientInput = document.getElementById("client");
const phoneInput = document.getElementById("phone");
const executiveInput = document.getElementById("executive");
const priceInput = document.getElementById("price");
const emailInput = document.getElementById("email");
const notesInput = document.getElementById("notes");
const slabInput = document.getElementById("slab");
const percentInput = document.getElementById("percentPaid");
const demandInput = document.getElementById("demandAmount");
const receivedInput = document.getElementById("amountReceived");
const balanceInput = document.getElementById("balanceAmount");

const saveButton = document.getElementById("saveButton");
const toast = document.getElementById("toast");

const navLinks = document.querySelectorAll(".nav-link");
const viewTitle = document.getElementById("viewTitle");
const viewEyebrow = document.getElementById("viewEyebrow");

const PAGE_META = {
    dashboard: { title: PROJECT_NAME, eyebrow: "Live inventory management" },
    inventory: { title: "Inventory", eyebrow: "Every unit, every floor" },
    customers: { title: "Customers", eyebrow: "Clients across all units" },
    reports:   { title: "Reports", eyebrow: "Sales performance & breakdowns" },
    settings:  { title: "Settings", eyebrow: "Workspace preferences" },
};

// =======================================
// LOAD DATA
// =======================================

async function loadInventory() {

    inventoryGrid.innerHTML =
    "<div class='empty-state'><h2>Loading inventory…</h2></div>";

    const { data, error } = await db
        .from("units")
        .select("*")
        .eq("project", PROJECT_NAME)
        .order("id", { ascending: true });

    if (error) {

        console.error(error);

        inventoryGrid.innerHTML =
        "<div class='empty-state'><h2 style='color:#9A4A44'>Database error</h2><p>Check your Supabase connection.</p></div>";

        return;

    }

    units = data || [];

    populateTypeFilter();
    updateDashboard();
    renderCurrentPage();

}

// =======================================
// TYPE FILTER (built from real data)
// =======================================

function populateTypeFilter() {

    const current = typeFilter.value;
    const types = [...new Set(units.map(u => u.type).filter(Boolean))].sort();

    typeFilter.innerHTML = '<option value="all">All types</option>' +
        types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");

    if (types.includes(current)) typeFilter.value = current;

}

// =======================================
// DASHBOARD STAT CARDS (shared across pages)
// =======================================

function updateDashboard(){

    totalUnits.textContent = units.length;

    availableUnits.textContent =
    units.filter(u => u.status === "available").length;

    holdUnits.textContent =
    units.filter(u => u.status === "hold").length;

    soldUnits.textContent =
    units.filter(u => u.status === "sold").length;

}

// =======================================
// NAVIGATION
// =======================================

navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        const page = link.dataset.view;
        navLinks.forEach(l => l.classList.remove("active"));
        link.classList.add("active");
        document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
        document.getElementById("view-" + page).classList.add("active");
        currentPage = page;

        const meta = PAGE_META[page];
        if (meta) {
            viewTitle.textContent = meta.title;
            viewEyebrow.textContent = meta.eyebrow;
        }

        renderCurrentPage();
    });
});

function renderCurrentPage() {
    if (currentPage === "dashboard") renderDashboardPanels();
    else if (currentPage === "inventory") renderInventory();
    else if (currentPage === "customers") renderCustomers();
    else if (currentPage === "reports") renderReports();
}

// =======================================
// DASHBOARD PANELS: status-by-floor + recent
// =======================================

function renderDashboardPanels() {

    // Status-by-floor stacked bar chart
    const byFloor = {};
    units.forEach(u => {
        if (!byFloor[u.floor]) byFloor[u.floor] = { available: 0, hold: 0, sold: 0, total: 0 };
        if (byFloor[u.floor][u.status] !== undefined) byFloor[u.floor][u.status]++;
        byFloor[u.floor].total++;
    });

    const floors = Object.keys(byFloor).map(Number).sort((a, b) => b - a);
    const chartEl = document.getElementById("floorStatusChart");

    chartEl.innerHTML = floors.map(floor => {
        const f = byFloor[floor];
        const pct = (n) => f.total ? (n / f.total) * 100 : 0;
        return `
            <div class="bar-row">
                <span class="bar-row-label">Floor ${floor}</span>
                <div class="bar-track">
                    <div class="bar-seg available" style="width:${pct(f.available)}%"></div>
                    <div class="bar-seg hold" style="width:${pct(f.hold)}%"></div>
                    <div class="bar-seg sold" style="width:${pct(f.sold)}%"></div>
                </div>
                <span class="bar-row-value">${f.total} units</span>
            </div>
        `;
    }).join("") || `<p class="empty-state-inline">No units yet.</p>`;

    if (floors.length) {
        chartEl.insertAdjacentHTML("beforeend", `
            <div class="chart-legend">
                <span><span class="legend-dot available"></span>Available</span>
                <span><span class="legend-dot hold"></span>Hold</span>
                <span><span class="legend-dot sold"></span>Sold</span>
            </div>
        `);
    }

    // Recently updated (uses the real updated_at column)
    const recentEl = document.getElementById("recentUpdatesList");
    const recent = [...units]
        .filter(u => u.updated_at)
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, 8);

    recentEl.innerHTML = recent.map(u => `
        <li class="mini-item">
            <span class="mini-item-main">
                <b>Unit ${escapeHtml(String(u.id))}</b>
                <span class="mini-item-sub">${escapeHtml(u.client) || "No client"} · ${escapeHtml(u.status)}</span>
            </span>
            <span class="mini-item-time">${timeAgo(u.updated_at)}</span>
        </li>
    `).join("") || `<li class="mini-item"><span class="mini-item-main">No activity yet.</span></li>`;

}

function timeAgo(isoString) {
    const then = new Date(isoString).getTime();
    const s = Math.floor((Date.now() - then) / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    const d = Math.floor(h / 24);
    return d + "d ago";
}

// =======================================
// INVENTORY FILTER
// =======================================

function filteredUnits(){

    let list = [...units];

    const keyword = search.value.trim().toLowerCase();

    if (keyword) {
        list = list.filter(u =>
            String(u.id).toLowerCase().includes(keyword)
        );
    }

    if (typeFilter.value !== "all") {
        list = list.filter(u => u.type === typeFilter.value);
    }

    if (statusFilter.value !== "all") {
        list = list.filter(u => u.status === statusFilter.value);
    }

    return list;

}

search.addEventListener("input", renderInventory);
typeFilter.addEventListener("change", renderInventory);
statusFilter.addEventListener("change", renderInventory);

// =======================================
// INVENTORY VIEW TOGGLE (by floor / all units)
// =======================================

viewToggle.querySelectorAll(".view-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        viewToggle.querySelectorAll(".view-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentView = btn.dataset.view;
        renderInventory();
    });
});

// =======================================
// RENDER INVENTORY
// =======================================

function renderInventory() {

    const list = filteredUnits();

    inventoryGrid.className = "inventory";
    inventoryGrid.innerHTML = "";

    if (list.length === 0) {
        inventoryGrid.innerHTML = `
            <div class="empty-state">
                <h2>No units found</h2>
                <p>Try a different search term or filter.</p>
            </div>
        `;
        return;
    }

    if (currentView === "floor") {
        renderFloorBands(list);
    } else {
        renderGrid(list);
    }

}

function renderFloorBands(list) {

    const byFloor = {};
    list.forEach(u => {
        if (!byFloor[u.floor]) byFloor[u.floor] = [];
        byFloor[u.floor].push(u);
    });

    const floors = Object.keys(byFloor).map(Number).sort((a, b) => b - a);

    floors.forEach(floor => {

        const band = document.createElement("div");
        band.className = "floor-band";

        const unitsHtml = byFloor[floor].map(unit => `
            <div class="unit-chip" data-id="${escapeHtml(String(unit.id))}">
                <span class="unit-chip-id">${escapeHtml(String(unit.id))}</span>
                <span class="unit-chip-meta">${escapeHtml(unit.type)} · ${escapeHtml(String(unit.carpet))} sq.ft</span>
                <span class="chip-status ${unit.status}">${escapeHtml(unit.status)}</span>
                ${unit.showflat ? '<span class="chip-showflat">Show flat</span>' : ""}
            </div>
        `).join("");

        band.innerHTML = `
            <div class="floor-label"><b>${floor}</b>Floor</div>
            <div class="floor-units">${unitsHtml}</div>
        `;

        band.querySelectorAll(".unit-chip").forEach(chip => {
            chip.addEventListener("click", () => {
                const unit = units.find(u => String(u.id) === chip.dataset.id);
                if (unit) openPopup(unit);
            });
        });

        inventoryGrid.appendChild(band);

    });

}

function renderGrid(list) {

    inventoryGrid.className = "inventory grid-mode";

    list.forEach(unit => {

        const card = document.createElement("div");
        card.className = "unit-card";

        const statusColor = unit.status.toLowerCase();

        card.innerHTML = `

            <div class="card-top">
                <h2>Unit ${escapeHtml(String(unit.id))}</h2>
                <span class="badge ${statusColor}">${escapeHtml(unit.status.toUpperCase())}</span>
            </div>

            <div class="card-body">

                <p>Floor</p>
                <h3>${escapeHtml(String(unit.floor))}</h3>

                <p>Type</p>
                <h3>${escapeHtml(unit.type)}</h3>

                <p>Carpet area</p>
                <h3>${escapeHtml(String(unit.carpet))} sq.ft</h3>

                <p>Client</p>
                <h3>${escapeHtml(unit.client) || "—"}</h3>

                <p>Executive</p>
                <h3>${escapeHtml(unit.executive) || "—"}</h3>

                ${unit.showflat ? '<div class="badge showflat">Show flat</div>' : ""}

            </div>

            <button class="details-btn">View details</button>

        `;

        card.querySelector(".details-btn").addEventListener("click", () => {
            openPopup(unit);
        });

        inventoryGrid.appendChild(card);

    });

}

// =======================================
// CUSTOMERS VIEW
// Derived from units where a client name
// has been entered — there's no separate
// customers table in the schema.
// =======================================

customerSearch.addEventListener("input", renderCustomers);
customerStatusFilter.addEventListener("change", renderCustomers);

function renderCustomers() {

    let list = units.filter(u => u.client && u.client.trim() !== "");

    const keyword = customerSearch.value.trim().toLowerCase();
    if (keyword) {
        list = list.filter(u =>
            (u.client || "").toLowerCase().includes(keyword) ||
            (u.phone || "").toLowerCase().includes(keyword) ||
            (u.executive || "").toLowerCase().includes(keyword)
        );
    }

    if (customerStatusFilter.value !== "all") {
        list = list.filter(u => u.status === customerStatusFilter.value);
    }

    list.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));

    if (list.length === 0) {
        customersTableBody.innerHTML = "";
        customersEmpty.hidden = false;
        return;
    }
    customersEmpty.hidden = true;

    customersTableBody.innerHTML = list.map(u => `
        <tr data-id="${escapeHtml(String(u.id))}">
            <td class="client-cell">${escapeHtml(u.client)}</td>
            <td>${u.phone ? `<a class="wa-cell-link" href="${whatsappUrl(u.phone)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">💬 ${escapeHtml(u.phone)}</a>` : "—"}</td>
            <td>${u.email ? `<a class="mail-cell-link" href="${mailtoUrl(u.email)}" onclick="event.stopPropagation()">✉ ${escapeHtml(u.email)}</a>` : "—"}</td>
            <td class="unit-cell">${escapeHtml(String(u.id))}</td>
            <td>${escapeHtml(u.executive) || "—"}</td>
            <td><span class="badge ${u.status}">${escapeHtml(u.status.toUpperCase())}</span></td>
            <td class="num-cell">${u.price ? formatCurrency(u.price) : "—"}</td>
            <td class="num-cell">${u.slab ?? "—"}</td>
            <td class="num-cell">${u.percent_paid ? u.percent_paid + "%" : "—"}</td>
            <td class="num-cell">${u.demand_amount ? formatCurrency(u.demand_amount) : "—"}</td>
            <td class="num-cell">${u.amount_received ? formatCurrency(u.amount_received) : "—"}</td>
            <td class="num-cell">${u.balance_amount !== null && u.balance_amount !== undefined ? formatCurrency(u.balance_amount) : "—"}</td>
            <td>${u.updated_at ? timeAgo(u.updated_at) : "—"}</td>
        </tr>
    `).join("");

    customersTableBody.querySelectorAll("tr").forEach(row => {
        row.addEventListener("click", () => {
            const unit = units.find(u => String(u.id) === row.dataset.id);
            if (unit) openPopup(unit);
        });
    });

}

// =======================================
// REPORTS VIEW
// All figures derived from the units table.
// =======================================

function parsePrice(priceText) {
    if (!priceText) return 0;
    const n = parseFloat(String(priceText).replace(/[^0-9.]/g, ""));
    return isNaN(n) ? 0 : n;
}

function formatCurrency(n) {
    return "₹" + Math.round(n).toLocaleString("en-IN");
}

function renderReports() {

    const sold = units.filter(u => u.status === "sold");
    const hold = units.filter(u => u.status === "hold");

    const soldValue = sold.reduce((s, u) => s + parsePrice(u.price), 0);
    const holdValue = hold.reduce((s, u) => s + parsePrice(u.price), 0);
    const avgTicket = sold.length ? soldValue / sold.length : 0;
    const conversion = units.length ? (sold.length / units.length) * 100 : 0;

    document.getElementById("repConversion").textContent = conversion.toFixed(1) + "%";
    document.getElementById("repSoldValue").textContent = formatCurrency(soldValue);
    document.getElementById("repHoldValue").textContent = formatCurrency(holdValue);
    document.getElementById("repAvgTicket").textContent = formatCurrency(avgTicket);

    // Sales by executive
    const byExec = {};
    units.forEach(u => {
        const name = (u.executive || "").trim();
        if (!name) return;
        if (!byExec[name]) byExec[name] = { sold: 0, hold: 0, value: 0 };
        if (u.status === "sold") { byExec[name].sold++; byExec[name].value += parsePrice(u.price); }
        if (u.status === "hold") byExec[name].hold++;
    });

    const execRows = Object.entries(byExec).sort((a, b) => b[1].value - a[1].value);
    const execBody = document.getElementById("execTableBody");
    execBody.innerHTML = execRows.map(([name, r]) => `
        <tr>
            <td class="client-cell">${escapeHtml(name)}</td>
            <td>${r.sold}</td>
            <td>${r.hold}</td>
            <td>${formatCurrency(r.value)}</td>
        </tr>
    `).join("") || `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:24px;">No executive assigned to any unit yet.</td></tr>`;

    // Inventory by unit type
    const byType = {};
    units.forEach(u => {
        const t = u.type || "Unspecified";
        byType[t] = (byType[t] || 0) + 1;
    });
    const maxType = Math.max(1, ...Object.values(byType));
    const typeChartEl = document.getElementById("typeChart");
    typeChartEl.innerHTML = Object.entries(byType).map(([t, count]) => `
        <div class="bar-row">
            <span class="bar-row-label">${escapeHtml(t)}</span>
            <div class="bar-track"><div class="bar-seg available" style="width:${(count / maxType) * 100}%"></div></div>
            <span class="bar-row-value">${count}</span>
        </div>
    `).join("") || `<p class="empty-state-inline">No units yet.</p>`;

}

// =======================================
// PHONE / WHATSAPP HELPERS
// New numbers get +91 prefixed automatically
// on save. Existing 10-digit numbers are
// treated as Indian numbers for the wa.me link.
// =======================================

function normalizePhone(raw) {
    if (!raw) return "";
    let digits = String(raw).replace(/[^\d]/g, "");
    if (digits.length === 10) digits = "91" + digits;
    else if (digits.length === 11 && digits.startsWith("0")) digits = "91" + digits.slice(1);
    return digits ? "+" + digits : "";
}

function whatsappUrl(raw) {
    const normalized = normalizePhone(raw).replace("+", "");
    return normalized ? `https://wa.me/${normalized}` : "";
}

function updateWhatsappPreview() {
    const url = whatsappUrl(phoneInput.value);
    const link = document.getElementById("whatsappLink");
    if (url) {
        link.href = url;
        link.hidden = false;
    } else {
        link.hidden = true;
    }
}

phoneInput.addEventListener("input", updateWhatsappPreview);

// =======================================
// EMAIL / MAIL LINK HELPER
// =======================================

function mailtoUrl(email) {
    const trimmed = (email || "").trim();
    if (!trimmed || !trimmed.includes("@")) return "";
    return `mailto:${trimmed}`;
}

function updateMailPreview() {
    const url = mailtoUrl(emailInput.value);
    const link = document.getElementById("mailLink");
    if (url) {
        link.href = url;
        link.hidden = false;
    } else {
        link.hidden = true;
    }
}

emailInput.addEventListener("input", updateMailPreview);

// =======================================
// SHARED HELPERS
// =======================================

function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
}

// =======================================
// OPEN POPUP
// =======================================

function openPopup(unit) {

    currentUnit = unit;

    popup.style.display = "flex";

    popupTitle.textContent = "Unit " + unit.id;

    statusInput.value = unit.status || "available";
    clientInput.value = unit.client || "";
    phoneInput.value = unit.phone || "";
    executiveInput.value = unit.executive || "";
    priceInput.value = unit.price || "";
    emailInput.value = unit.email || "";
    notesInput.value = unit.notes || "";
    slabInput.value = unit.slab ?? "";
    percentInput.value = unit.percent_paid ?? "";
    demandInput.value = unit.demand_amount ?? "";
    receivedInput.value = unit.amount_received ?? "";
    balanceInput.value = unit.balance_amount ?? "";

    updateWhatsappPreview();
    updateMailPreview();

}

// =======================================
// CLOSE POPUP
// =======================================

closePopup.addEventListener("click", () => {
    popup.style.display = "none";
});

window.addEventListener("click", e => {
    if (e.target === popup) {
        popup.style.display = "none";
    }
});

// =======================================
// SAVE UNIT
// =======================================

saveButton.addEventListener("click", async () => {

    if (!currentUnit) return;

    saveButton.disabled = true;
    saveButton.textContent = "Saving…";

    const updates = {
        status: statusInput.value,
        client: clientInput.value.trim(),
        phone: normalizePhone(phoneInput.value) || phoneInput.value.trim(),
        executive: executiveInput.value.trim(),
        price: priceInput.value.trim() ? Number(priceInput.value.replace(/[^0-9.]/g, "")) : null,
        email: emailInput.value.trim(),
        notes: notesInput.value.trim(),
        slab: slabInput.value.trim() ? Number(slabInput.value) : null,
        percent_paid: percentInput.value.trim() ? Number(percentInput.value) : null,
        demand_amount: demandInput.value.trim() ? Number(demandInput.value.replace(/[^0-9.]/g, "")) : null,
        amount_received: receivedInput.value.trim() ? Number(receivedInput.value.replace(/[^0-9.]/g, "")) : null,
        balance_amount: balanceInput.value.trim() ? Number(balanceInput.value.replace(/[^0-9.]/g, "")) : null
    };

    const { error } = await db
        .from("units")
        .update(updates)
        .eq("id", currentUnit.id);

    saveButton.disabled = false;
    saveButton.textContent = "Save information";

    if (error) {
        console.error(error);
        alert("Unable to save data.");
        return;
    }

    popup.style.display = "none";

    toast.textContent = "Information saved successfully";
    toast.style.display = "block";

    setTimeout(() => {
        toast.style.display = "none";
    }, 2500);

    await loadInventory();

});

// =======================================
// ESC CLOSE
// =======================================

document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
        popup.style.display = "none";
    }
});

// =======================================
// REFRESH
// =======================================

async function refresh() {
    await loadInventory();
}

// =======================================
// START APP
// =======================================

document.addEventListener("DOMContentLoaded", async () => {

    try {

        await loadInventory();
        console.log("✅ Pardis Properties CRM loaded");

    } catch (err) {

        console.error(err);

        inventoryGrid.innerHTML = `
            <div class="empty-state">
                <h2>Something went wrong</h2>
                <p>Check your Supabase connection.</p>
            </div>
        `;

    }

});

// =======================================
// GLOBAL FUNCTIONS
// =======================================

window.refresh = refresh;
