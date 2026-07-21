/* ==========================================================================
   CRIMEINTEL AI - PRODUCTION INTERACTIVE APPLICATION ENGINE
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    initMetricsCounter();
    initCommandPalette();
    initTableSearch();
    initToastSystem();
});

/* --- 1. ANIMATED METRICS COUNT-UP ENGINE --- */
function initMetricsCounter() {
    const counters = document.querySelectorAll('.counter');
    if (!counters.length) return;

    counters.forEach(counter => {
        const target = +counter.getAttribute('data-target');
        if (isNaN(target)) return;

        const speed = 60;
        const increment = target / speed;
        let current = 0;

        const updateCount = () => {
            current += increment;
            if (current < target) {
                counter.innerText = Math.ceil(current).toLocaleString();
                setTimeout(updateCount, 15);
            } else {
                counter.innerText = target.toLocaleString();
            }
        };
        updateCount();
    });
}

/* --- 2. STACKABLE TOAST NOTIFICATION ENGINE --- */
function initToastSystem() {
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.style.position = "fixed";
        container.style.bottom = "24px";
        container.style.right = "24px";
        container.style.zIndex = "9999";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.gap = "10px";
        container.style.pointerEvents = "none";
        document.body.appendChild(container);
    }
}

function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.style.pointerEvents = "auto";
    toast.style.backgroundColor = "#FFF8F5";
    toast.style.color = "#2A080C";
    toast.style.padding = "12px 18px";
    toast.style.borderRadius = "10px";
    toast.style.border = "1px solid rgba(153, 0, 17, 0.22)";
    toast.style.boxShadow = "0 8px 24px rgba(153, 0, 17, 0.12)";
    toast.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
    toast.style.fontSize = "0.85rem";
    toast.style.fontWeight = "600";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.gap = "10px";
    toast.style.minWidth = "280px";
    toast.style.transform = "translateY(10px)";
    toast.style.opacity = "0";
    toast.style.transition = "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)";

    const iconClass = type === "critical" ? "fa-triangle-exclamation" : (type === "success" ? "fa-circle-check" : "fa-circle-info");
    const iconColor = type === "critical" ? "#990011" : (type === "success" ? "#166534" : "#990011");

    toast.innerHTML = `
        <i class="fa-solid ${iconClass}" style="color: ${iconColor}; font-size: 1rem;"></i>
        <span style="flex: 1;">${message}</span>
        <i class="fa-solid fa-xmark" style="color: #8A7074; cursor: pointer; font-size: 0.8rem;" onclick="this.parentElement.remove()"></i>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.transform = "translateY(0)";
        toast.style.opacity = "1";
    });

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => toast.remove(), 250);
    }, 3200);
}

function triggerAction(actionName) {
    showToast(`Initiating Module: ${actionName}`, "success");
}

/* --- 3. LIVE TABLE SEARCH & FILTER ENGINE --- */
function initTableSearch() {
    const searchInputs = document.querySelectorAll(".table-search-input");
    searchInputs.forEach(input => {
        input.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase().trim();
            const table = input.closest(".table-container-card").querySelector(".data-table");
            if (!table) return;

            const rows = table.querySelectorAll("tbody tr");
            let visibleCount = 0;

            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                if (text.includes(query)) {
                    row.style.display = "";
                    visibleCount++;
                } else {
                    row.style.display = "none";
                }
            });

            // Handle Empty State
            let emptyMsg = table.querySelector(".empty-state-row");
            if (visibleCount === 0) {
                if (!emptyMsg) {
                    emptyMsg = document.createElement("tr");
                    emptyMsg.className = "empty-state-row";
                    emptyMsg.innerHTML = `<td colspan="100%" style="text-align: center; padding: 24px; color: var(--text-muted);">No records found matching "${e.target.value}"</td>`;
                    table.querySelector("tbody").appendChild(emptyMsg);
                }
            } else if (emptyMsg) {
                emptyMsg.remove();
            }
        });
    });
}

function filterTableByStatus(status, btn) {
    if (btn) {
        btn.closest(".filter-group").querySelectorAll(".btn-toggle").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
    }

    const table = document.querySelector(".data-table");
    if (!table) return;

    const rows = table.querySelectorAll("tbody tr");
    rows.forEach(row => {
        if (status === "all") {
            row.style.display = "";
        } else {
            const pill = row.querySelector(".status-pill");
            if (pill && pill.classList.contains(status)) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        }
    });
    showToast(`Filter applied: ${status.toUpperCase()} records`, "info");
}

/* --- 4. COMMAND PALETTE MODAL (CTRL + K) --- */
function initCommandPalette() {
    // Inject Modal DOM if missing
    if (!document.getElementById("cmdModalBackdrop")) {
        const modalHtml = `
            <div class="modal-backdrop" id="cmdModalBackdrop" onclick="closeCommandPalette(event)">
                <div class="cmd-modal" onclick="event.stopPropagation()">
                    <input type="text" class="cmd-search-input" id="cmdSearchInput" placeholder="Type a command or search workstations... (Esc to close)">
                    <div class="cmd-list">
                        <div class="cmd-item" onclick="navigateCommand('index.html')">
                            <i class="fa-solid fa-house"></i>
                            <span>Go to Command Center Dashboard</span>
                        </div>
                        <div class="cmd-item" onclick="navigateCommand('analytics.html')">
                            <i class="fa-solid fa-chart-line"></i>
                            <span>Open Analytics & Geospatial Maps</span>
                        </div>
                        <div class="cmd-item" onclick="navigateCommand('assistant.html')">
                            <i class="fa-solid fa-robot"></i>
                            <span>Ask AI Assistant Workstation</span>
                        </div>
                        <div class="cmd-item" onclick="navigateCommand('login.html')">
                            <i class="fa-solid fa-lock"></i>
                            <span>Command Network Portal Login</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML("beforeend", modalHtml);
    }

    // Keyboard Shortcuts Listener
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            toggleCommandPalette();
        } else if (e.key === 'Escape') {
            closeCommandPalette();
        }
    });
}

function toggleCommandPalette() {
    const backdrop = document.getElementById("cmdModalBackdrop");
    if (!backdrop) return;
    const isOpening = !backdrop.classList.contains("active");
    backdrop.classList.toggle("active");
    if (isOpening) {
        setTimeout(() => document.getElementById("cmdSearchInput").focus(), 50);
    }
}

function closeCommandPalette(e) {
    const backdrop = document.getElementById("cmdModalBackdrop");
    if (backdrop) backdrop.classList.remove("active");
}

function navigateCommand(url) {
    closeCommandPalette();
    showToast(`Navigating to ${url}...`, "info");
    setTimeout(() => { window.location.href = url; }, 200);
}