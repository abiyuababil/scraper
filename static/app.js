// ============================================================
//  app.js — Client Logic & Event Handling
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    const processForm = document.getElementById("process-form");
    const urlInput = document.getElementById("url-input");
    const btnSubmit = document.getElementById("btn-submit");
    const btnSample = document.getElementById("btn-sample");
    const progressContainer = document.getElementById("progress-container");
    const progressStatus = document.getElementById("progress-status");
    const progressDetail = document.getElementById("progress-detail");
    const emptyState = document.getElementById("empty-state");
    const resultsContainer = document.getElementById("results-container");
    const globalActions = document.getElementById("global-actions");
    
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

            // Build OCR Text Block for Selebaran HTML
            let ocrTextBlockHtml = "";
            if (item.selebaran_ocr_text) {
                ocrTextBlockHtml = `
                    <div class="ocr-text-section">
                        <div class="ocr-header">
                            <h5><i class="fa-solid fa-align-left"></i> Hasil OCR Teks Selebaran</h5>
                            <button class="btn btn-sm btn-outline btn-copy-ocr" data-index="${index}">
                                <i class="fa-solid fa-copy"></i> Salin Teks OCR Selebaran
                            </button>
                        </div>
                        <div class="ocr-content-box">${escapeHtml(item.selebaran_ocr_text)}</div>
                    </div>
                `;
            } else if (item.selebaran) {
                ocrTextBlockHtml = `
                    <div class="ocr-text-section">
                        <div class="ocr-header">
                            <h5><i class="fa-solid fa-align-left"></i> Hasil OCR Teks Selebaran</h5>
                        </div>
                        <div class="ocr-content-box text-muted">Tidak ada teks signifikan yang terdeteksi di selebaran ini.</div>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="card-top">
                    <span class="kamisan-title">Kamisan ke-${item.kamisan_number}</span>
                    <span class="help-text">Post #${index + 1}</span>
                </div>
                
                ${mediaPreviewHtml}

                <div class="section-title"><i class="fa-solid fa-code"></i> Format Teks Terkompilasi</div>
                <div class="result-text-block">${escapeHtml(formattedText)}</div>
                
                ${ocrTextBlockHtml}

                <div class="card-actions">
                    <button class="btn btn-sm btn-secondary btn-copy-card" data-index="${index}">
                        <i class="fa-solid fa-copy"></i> Salin Format Post Ini
                    </button>
                </div>
            `;

            resultsContainer.appendChild(card);
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

    btnExportJson.addEventListener("click", () => {
        if (!currentResults.length) return;
        const jsonStr = JSON.stringify(currentResults, null, 2);
        downloadFile(jsonStr, "kamisan_data.json", "application/json");
    });

    btnExportCsv.addEventListener("click", () => {
        if (!currentResults.length) return;
        const headers = ["kamisan_number", "post_url", "date_utc", "selebaran", "foto"];
        const rows = [headers.join(",")];

        currentResults.forEach(item => {
            const fotoStr = (item.foto || []).join(" | ");
            const row = [
                item.kamisan_number,
                `"${item.post_url}"`,
                `"${item.date_utc || ""}"`,
                `"${item.selebaran || ""}"`,
                `"${fotoStr}"`
            ];
            rows.push(row.join(","));
        });

        downloadFile(rows.join("\n"), "kamisan_data.csv", "text/csv");
    });

    // --- Helper Functions ---
    function setLoadingState(isLoading, statusText = "", detailText = "") {
        if (isLoading) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Memproses...`;
            progressContainer.classList.remove("hidden");
            if (statusText) progressStatus.innerText = statusText;
            if (detailText) progressDetail.innerText = detailText;
        } else {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<i class="fa-solid fa-bolt"></i> Proses & Jalankan OCR`;
            progressContainer.classList.add("hidden");
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
