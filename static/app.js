// ============================================================
//  app.js — Client Logic & Event Handling
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    const processForm = document.getElementById("process-form");
    const urlInput = document.getElementById("url-input");
    const btnSubmit = document.getElementById("btn-submit");
    const btnSample = document.getElementById("btn-sample");
    const btnFetchAccount = document.getElementById("btn-fetch-account");
    const progressContainer = document.getElementById("progress-container");
    const progressStatus = document.getElementById("progress-status");
    const progressDetail = document.getElementById("progress-detail");
    const emptyState = document.getElementById("empty-state");
    const resultsContainer = document.getElementById("results-container");
    const globalActions = document.getElementById("global-actions");

    // --- Auto-Fetch Link Akun Target Button ---
    btnFetchAccount.addEventListener("click", async () => {
        const username = prompt("Masukkan username Instagram yang ingin diambil seluruh link post-nya:", "sumarsihmaria");
        if (!username) return;

        setLoadingState(true, `Mengambil daftar link post dari @${username}...`, "Menghubungi Instagram & mengumpulkan URL...");

        try {
            const resp = await fetch("/api/fetch-account-urls", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: username, limit: 50 })
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.detail || "Gagal mengambil link post");
            }

            const data = await resp.json();
            if (data.urls && data.urls.length > 0) {
                urlInput.value = data.urls.join("\n");
                showToast(`✅ Berhasil mengambil ${data.urls.length} link post dari @${data.username}!`, "success");
            } else {
                showToast(`⚠️ Tidak ada link post ditemukan untuk @${username}`, "warning");
            }
        } catch (err) {
            console.error(err);
            showToast(`Error: ${err.message}`, "error");
        } finally {
            setLoadingState(false);
        }
    });
    
    // Global action buttons
    const btnCopyAll = document.getElementById("btn-copy-all");
    const btnExportCsv = document.getElementById("btn-export-csv");
    const btnExportJson = document.getElementById("btn-export-json");
    const btnExportTxt = document.getElementById("btn-export-txt");

    let currentResults = [];

    // --- Sample Data Button ---
    btnSample.addEventListener("click", () => {
        urlInput.value = `https://www.instagram.com/p/C-J12345/
https://www.instagram.com/p/C-K67890/`;
    });

    // --- Form Submit Handler ---
    processForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const rawUrls = urlInput.value.trim().split("\n").map(u => u.trim()).filter(u => u.length > 0);
        if (rawUrls.length === 0) {
            showToast("Silakan masukkan minimal 1 URL post Instagram!", "warning");
            return;
        }

        // Show loading progress
        setLoadingState(true, `Memproses ${rawUrls.length} post Instagram...`, "Mengambil data post & mengunduh gambar...");

        try {
            const response = await fetch("/api/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls: rawUrls })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || "Gagal memproses request");
            }

            const data = await response.json();
            currentResults = data.results || [];
            
            renderResults(currentResults);
            showToast(`Berhasil memproses ${currentResults.length} post!`, "success");
        } catch (err) {
            console.error(err);
            showToast(`Error: ${err.message}`, "error");
        } finally {
            setLoadingState(false);
        }
    });

    // --- Render Results ---
    function renderResults(results) {
        resultsContainer.innerHTML = "";
        
        if (results.length === 0) {
            emptyState.classList.remove("hidden");
            globalActions.classList.add("hidden");
            return;
        }

        emptyState.classList.add("hidden");
        globalActions.classList.remove("hidden");

        results.forEach((item, index) => {
            const card = document.createElement("div");
            card.className = "result-card";

        results.forEach((item, index) => {
            const card = document.createElement("div");
            card.className = "result-card";

            const formattedText = formatSingleText(item);
            
            // Build Image Previews HTML
            let mediaPreviewHtml = "";
            if (item.selebaran || (item.foto && item.foto.length > 0)) {
                mediaPreviewHtml += `<div class="media-gallery-section">
                    <h5 class="gallery-title"><i class="fa-solid fa-images"></i> Pratinjau Gambar</h5>
                    <div class="gallery-grid">`;
                
                if (item.selebaran) {
                    mediaPreviewHtml += `
                        <div class="media-thumb-wrapper selebaran-thumb">
                            <span class="thumb-badge badge-selebaran"><i class="fa-solid fa-file-text"></i> Selebaran</span>
                            <a href="${item.selebaran}" target="_blank" title="Klik untuk membuka gambar penuh">
                                <img src="${item.selebaran}" alt="Selebaran" class="media-img" loading="lazy" referrerpolicy="no-referrer" />
                            </a>
                        </div>`;
                }

                if (item.foto && item.foto.length > 0) {
                    item.foto.forEach((fotoUrl, fIdx) => {
                        mediaPreviewHtml += `
                            <div class="media-thumb-wrapper foto-thumb">
                                <span class="thumb-badge badge-foto"><i class="fa-solid fa-camera"></i> Foto #${fIdx + 1}</span>
                                <a href="${fotoUrl}" target="_blank" title="Klik untuk membuka gambar penuh">
                                    <img src="${fotoUrl}" alt="Foto Aksi ${fIdx + 1}" class="media-img" loading="lazy" referrerpolicy="no-referrer" />
                                </a>
                            </div>`;
                    });
                }

                mediaPreviewHtml += `</div></div>`;
            }

            // Build Quick Interactive Links HTML (Pill buttons)
            let quickLinksHtml = `<div class="quick-links-section">
                <h5 class="gallery-title"><i class="fa-solid fa-link"></i> Link Pintas & Salin URL</h5>
                <div class="quick-links-grid">
                    <a href="${item.post_url}" target="_blank" class="link-pill">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> Sumber Post IG
                    </a>`;
            
            if (item.selebaran) {
                quickLinksHtml += `
                    <a href="${item.selebaran}" target="_blank" class="link-pill">
                        <i class="fa-solid fa-file-image"></i> Buka Link Selebaran
                    </a>
                    <button class="link-pill btn-copy-url" data-url="${item.selebaran}">
                        <i class="fa-solid fa-copy"></i> Salin URL Selebaran
                    </button>`;
            }

            if (item.foto && item.foto.length > 0) {
                item.foto.forEach((fotoUrl, fIdx) => {
                    quickLinksHtml += `
                        <a href="${fotoUrl}" target="_blank" class="link-pill">
                            <i class="fa-solid fa-image"></i> Buka Foto #${fIdx + 1}
                        </a>
                        <button class="link-pill btn-copy-url" data-url="${fotoUrl}">
                            <i class="fa-solid fa-copy"></i> Salin URL Foto #${fIdx + 1}
                        </button>`;
                });
            }

            quickLinksHtml += `</div></div>`;

            // Build Collapsible Side-by-Side OCR Section
            let sideBySideOcrHtml = "";
            if (item.selebaran) {
                sideBySideOcrHtml = `
                    <div class="collapsible-wrapper">
                        <div class="collapsible-header" data-target="ocr-collapse-${index}">
                            <div class="collapsible-title">
                                <i class="fa-solid fa-columns"></i> Side-by-Side Selebaran & Hasil OCR Teks
                            </div>
                            <i class="fa-solid fa-chevron-down chevron-icon"></i>
                        </div>
                        <div id="ocr-collapse-${index}" class="collapsible-content">
                            <div class="side-by-side-container">
                                <div class="side-left-image">
                                    <h5 class="gallery-title"><i class="fa-solid fa-file-image"></i> Gambar Selebaran</h5>
                                    <a href="${item.selebaran}" target="_blank">
                                        <img src="${item.selebaran}" alt="Gambar Selebaran" loading="lazy" referrerpolicy="no-referrer" />
                                    </a>
                                </div>
                                <div class="side-right-ocr">
                                    <div class="ocr-header">
                                        <h5 class="gallery-title"><i class="fa-solid fa-edit"></i> Edit / Verifikasi Teks OCR</h5>
                                        <button class="btn btn-sm btn-outline btn-copy-ocr" data-index="${index}">
                                            <i class="fa-solid fa-copy"></i> Salin Teks OCR
                                        </button>
                                    </div>
                                    <textarea class="ocr-textarea ocr-edit-input" data-index="${index}" placeholder="Teks OCR akan muncul di sini...">${escapeHtml(item.selebaran_ocr_text || "")}</textarea>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Build Collapsible Format Text Section
            let collapsibleFormattedHtml = `
                <div class="collapsible-wrapper">
                    <div class="collapsible-header" data-target="fmt-collapse-${index}">
                        <div class="collapsible-title">
                            <i class="fa-solid fa-code"></i> Format Teks Terkompilasi (Klik untuk Buka/Tutup)
                        </div>
                        <i class="fa-solid fa-chevron-down chevron-icon"></i>
                    </div>
                    <div id="fmt-collapse-${index}" class="collapsible-content">
                        <div class="result-text-block">${escapeHtml(formattedText)}</div>
                    </div>
                </div>
            `;

            card.innerHTML = `
                <div class="card-top">
                    <span class="kamisan-title">Kamisan ke-${item.kamisan_number}</span>
                    <span class="help-text">Post #${index + 1}</span>
                </div>
                
                ${mediaPreviewHtml}

                ${quickLinksHtml}

                ${sideBySideOcrHtml}

                ${collapsibleFormattedHtml}

                <div class="card-actions">
                    <button class="btn btn-sm btn-secondary btn-copy-card" data-index="${index}">
                        <i class="fa-solid fa-copy"></i> Salin Format Post Ini
                    </button>
                </div>
            `;

            resultsContainer.appendChild(card);
        });

        // Event Listeners for Collapsible Headers
        document.querySelectorAll(".collapsible-header").forEach(header => {
            header.addEventListener("click", () => {
                header.classList.toggle("active");
                const targetId = header.getAttribute("data-target");
                const content = document.getElementById(targetId);
                if (content) {
                    content.classList.toggle("open");
                }
            });
        });

        // Event Listener for Live Editable OCR Textarea
        document.querySelectorAll(".ocr-edit-input").forEach(textarea => {
            textarea.addEventListener("input", (e) => {
                const idx = e.target.getAttribute("data-index");
                if (results[idx]) {
                    results[idx].selebaran_ocr_text = e.target.value;
                }
            });
        });

        // Event listener for single copy buttons
        document.querySelectorAll(".btn-copy-card").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const idx = e.currentTarget.getAttribute("data-index");
                const textToCopy = formatSingleText(results[idx]);
                copyToClipboard(textToCopy);
                showToast("Format teks post berhasil disalin!");
            });
        });

        // Event listener for individual URL copy buttons
        document.querySelectorAll(".btn-copy-url").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const urlToCopy = e.currentTarget.getAttribute("data-url");
                copyToClipboard(urlToCopy);
                showToast("URL gambar berhasil disalin ke clipboard!");
            });
        });

        // Event listener for OCR text copy buttons
        document.querySelectorAll(".btn-copy-ocr").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const idx = e.currentTarget.getAttribute("data-index");
                const ocrText = results[idx].selebaran_ocr_text || "";
                copyToClipboard(ocrText);
                showToast("Teks OCR Selebaran berhasil disalin!");
            });
        });
    }

    // --- Helper: Format Single Item ---
    function formatSingleText(item) {
        const lines = [];
        lines.append = (str) => lines.push(str);

        lines.append(`Kamisan ke-${item.kamisan_number}`);
        lines.append(`Sumber: ${item.post_url}`);
        
        const selebaran = item.selebaran || "-";
        lines.append(`Selebaran: ${selebaran}`);

        const fotoList = item.foto || [];
        if (fotoList.length === 1) {
            lines.append(`Foto: ${fotoList[0]}`);
        } else if (fotoList.length > 1) {
            lines.append("Foto:");
            fotoList.forEach((url, i) => lines.append(`  ${i + 1}. ${url}`));
        } else {
            lines.append("Foto: -");
        }

        return lines.join("\n");
    }

    // Global Export Buttons
    const btnExportJanganDiam = document.getElementById("btn-export-jangandiam");

    // --- Export & Copy All Handlers ---
    btnCopyAll.addEventListener("click", () => {
        if (!currentResults.length) return;
        const allText = currentResults.map(item => formatSingleText(item)).join("\n\n============================================================\n\n");
        copyToClipboard(allText);
        showToast("Semua teks hasil berhasil disalin!");
    });

    btnExportTxt.addEventListener("click", () => {
        if (!currentResults.length) return;
        const allText = currentResults.map(item => formatSingleText(item)).join("\n\n============================================================\n\n");
        downloadFile(allText, "kamisan_formatted.txt", "text/plain");
    });

    // --- Export JSON Format "Jangan-Diam.github.io" Schema ---
    btnExportJanganDiam.addEventListener("click", () => {
        if (!currentResults.length) return;

        const janganDiamSchema = currentResults.map(item => {
            const actNum = item.kamisan_number || "";
            const dateStr = item.date_utc ? item.date_utc.split("T")[0] : "";
            const ocrText = item.selebaran_ocr_text || "";
            
            // Reconstruct textBody ke tag HTML <p>
            const paragraphs = ocrText.split("\n")
                                      .filter(p => p.trim().length > 0)
                                      .map(p => `<p>${escapeHtml(p)}</p>`)
                                      .join("");

            const attachments = [];
            if (item.selebaran) {
                attachments.push({
                    "type": "naskah",
                    "title": "Hasil Pindaian Surat Terbuka",
                    "subtitle": `Surat Terbuka Aksi Kamisan #${actNum}`,
                    "icon": "lucide:file-text",
                    "imageUrl": item.selebaran,
                    "footer": "Naskah Surat Terbuka"
                });
            }

            if (item.foto && item.foto.length > 0) {
                item.foto.forEach((fotoUrl, fIdx) => {
                    attachments.push({
                        "type": "foto",
                        "title": "Dokumentasi Aksi Lapangan",
                        "subtitle": `Foto Aksi Kamisan #${actNum} (${fIdx + 1})`,
                        "icon": "lucide:camera",
                        "imageUrl": fotoUrl,
                        "footer": `Foto Aksi #${actNum}`
                    });
                });
            }

            return {
                "id": actNum,
                "actNum": actNum,
                "docNum": "",
                "date": dateStr,
                "title": `Surat Terbuka #${actNum}`,
                "tags": ["Aksi Kamisan"],
                "summary": item.caption ? item.caption.substring(0, 180).replace(/["\r\n]/g, " ") : "",
                "insights": [],
                "casesReferred": [],
                "source": "Selebaran Aksi Kamisan / JSKK",
                "sourceUrl": item.post_url,
                "textBody": paragraphs || "<p></p>",
                "attachments": attachments
            };
        });

        const jsonStr = JSON.stringify(janganDiamSchema, null, 2);
        downloadFile(jsonStr, "archive_jangan_diam.json", "application/json");
        showToast("File JSON schema 'Jangan-Diam' berhasil diunduh!");
    });

    // --- Export CSV Spreadsheet Komprehensif ---
    btnExportCsv.addEventListener("click", () => {
        if (!currentResults.length) return;
        
        // Header kolom CSV
        const headers = ["No Aksi", "Tanggal", "URL Sumber Post IG", "URL Gambar Selebaran", "List URL Foto Aksi", "Teks OCR Selebaran", "Caption IG"];
        const rows = [headers.map(h => `"${h}"`).join(",")];

        currentResults.forEach(item => {
            const fotoStr = (item.foto || []).join(" | ");
            const ocrClean = (item.selebaran_ocr_text || "").replace(/"/g, '""');
            const captionClean = (item.caption || "").replace(/"/g, '""');

            const row = [
                `"${item.kamisan_number}"`,
                `"${item.date_utc ? item.date_utc.split("T")[0] : ""}"`,
                `"${item.post_url}"`,
                `"${item.selebaran || ""}"`,
                `"${fotoStr}"`,
                `"${ocrClean}"`,
                `"${captionClean}"`
            ];
            rows.push(row.join(","));
        });

        // Sertakan UTF-8 BOM (\uFEFF) agar dibuka sempurna di Microsoft Excel / Google Sheets
        const csvContent = "\uFEFF" + rows.join("\n");
        downloadFile(csvContent, "kamisan_spreadsheet.csv", "text/csv;charset=utf-8;");
        showToast("File CSV Spreadsheet berhasil diunduh!");
    });

    // --- Helper Functions ---
    const progressModal = document.getElementById("progress-modal");
    const modalStatusTitle = document.getElementById("modal-status-title");
    const modalStatusDetail = document.getElementById("modal-status-detail");
    const modalProgressFill = document.getElementById("modal-progress-fill");

    function setLoadingState(isLoading, statusText = "", detailText = "", fillPercent = 100) {
        if (isLoading) {
            btnSubmit.disabled = true;
            btnSubmit.innerText = "Memproses...";
            if (btnFetchAccount) btnFetchAccount.disabled = true;
            if (btnSample) btnSample.disabled = true;

            if (statusText) modalStatusTitle.innerText = statusText;
            if (detailText) modalStatusDetail.innerText = detailText;
            if (modalProgressFill) modalProgressFill.style.width = `${fillPercent}%`;
            
            progressModal.classList.remove("hidden");
        } else {
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Proses & Jalankan OCR";
            if (btnFetchAccount) btnFetchAccount.disabled = false;
            if (btnSample) btnSample.disabled = false;

            progressModal.classList.add("hidden");
        }
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error("Gagal menyalin: ", err);
        });
    }

    function downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function showToast(message, type = "success") {
        const toast = document.getElementById("toast");
        const toastMsg = document.getElementById("toast-message");
        toastMsg.innerText = message;
        toast.classList.remove("hidden");
        
        setTimeout(() => {
            toast.classList.add("hidden");
        }, 3000);
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/"/g, "&quot;")
                  .replace(/'/g, "&#039;");
    }
});
