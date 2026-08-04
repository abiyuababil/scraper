// ============================================================
//  app.js — Client Logic & Event Handling (Robust Build)
// ============================================================

let currentResults = [];

// --- Helper UI Toast & Loading ---
function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    const toastMsg = document.getElementById("toast-message");
    if (!toast || !toastMsg) return;
    
    toastMsg.innerText = message;
    toast.classList.remove("hidden");
    
    setTimeout(() => {
        toast.classList.add("hidden");
    }, 3500);
}

function setLoadingState(isLoading, statusText = "", detailText = "", fillPercent = 0, currentCount = 0, totalCount = 0) {
    const floatingWidget = document.getElementById("floating-progress-widget");
    const widgetStatusTitle = document.getElementById("widget-status-title");
    const widgetStatusDetail = document.getElementById("widget-status-detail");
    const widgetProgressFill = document.getElementById("widget-progress-fill");
    const widgetProgressCounter = document.getElementById("widget-progress-counter");
    const btnSubmit = document.getElementById("btn-submit");

    if (isLoading) {
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Memproses (${currentCount}/${totalCount})...`;
        }

        if (widgetStatusTitle && statusText) widgetStatusTitle.innerText = statusText;
        if (widgetStatusDetail && detailText) widgetStatusDetail.innerText = detailText;
        if (widgetProgressFill) widgetProgressFill.style.width = `${fillPercent}%`;
        if (widgetProgressCounter) {
            if (totalCount > 0) {
                widgetProgressCounter.innerText = `${currentCount} / ${totalCount} (${fillPercent}%)`;
            } else {
                widgetProgressCounter.innerText = `${fillPercent}%`;
            }
        }
        
        if (floatingWidget) floatingWidget.classList.remove("hidden");
    } else {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<i class="fa-solid fa-play"></i> Proses & Jalankan OCR`;
        }

        if (floatingWidget) {
            setTimeout(() => {
                floatingWidget.classList.add("hidden");
            }, 800);
        }
    }
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}

function copyToClipboard(text) {
    if (!navigator.clipboard) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        return;
    }
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

// --- Smart Parser Input Teks ---
function parseInputUrls(text) {
    if (!text || !text.trim()) return [];
    
    // Match pola "796 : http..." atau "http..." di mana saja di dalam teks input
    const regex = /(?:(\d+)\s*[:\-]\s*)?(https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\/[A-Za-z0-9_\-]+[^\s]*)/gi;
    const matches = [...text.matchAll(regex)];
    
    if (matches.length > 0) {
        return matches.map(m => {
            const num = m[1];
            const url = m[2];
            return num ? `${num} : ${url}` : url;
        });
    }
    
    // Fallback split per line
    return text.trim().split("\n").map(u => u.trim()).filter(u => u.length > 0);
}

// --- Global Main Submit Process Function (Realtime SSE Streaming) ---
async function handleProcessSubmit(e, skipOcr = false) {
    if (e && e.preventDefault) e.preventDefault();
    
    const urlInput = document.getElementById("url-input");
    if (!urlInput) return;

    const rawUrls = parseInputUrls(urlInput.value);
    if (rawUrls.length === 0) {
        showToast("Silakan masukkan minimal 1 URL post Instagram!", "warning");
        return;
    }

    currentResults = [];
    renderResults(currentResults); // Reset UI & sembunyikan empty state

    const statusTitleText = skipOcr ? `Ambil Metadata Kilat (${rawUrls.length} post)...` : `Memproses ${rawUrls.length} post Instagram...`;
    const statusDetailText = skipOcr ? `Mengekstrak No. Aksi, Tanggal, Selebaran & Foto tanpa OCR...` : `Mempersiapkan pemrosesan & OCR...`;

    // Show initial loading modal progress
    setLoadingState(true, statusTitleText, statusDetailText, 0, 0, rawUrls.length);

    try {
        const response = await fetch("/api/process-stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ urls: rawUrls, skip_ocr: skipOcr })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Gagal memproses request");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || ""; // simpan sisa baris belum utuh

            for (const line of lines) {
                const cleanLine = line.trim();
                if (!cleanLine.startsWith("data: ")) continue;

                const jsonStr = cleanLine.replace(/^data:\s*/, "");
                try {
                    const event = JSON.parse(jsonStr);

                    if (event.type === "init") {
                        setLoadingState(true, `Memproses ${event.total} post Instagram...`, "Mulai mengunduh media & OCR...", 0, 0, event.total);
                    } else if (event.type === "progress") {
                        // Deduplikasi berdasarkan post_url agar tidak ada duplikasi kartu
                        const existingIdx = currentResults.findIndex(r => r.post_url === event.result.post_url);
                        if (existingIdx !== -1) {
                            currentResults[existingIdx] = event.result;
                        } else {
                            currentResults.push(event.result);
                        }
                        
                        // Update progress bar & counter live
                        setLoadingState(
                            true,
                            `Memproses post ${event.current} dari ${event.total}...`,
                            event.message || `Sedang menjalankan EasyOCR...`,
                            event.percent,
                            event.current,
                            event.total
                        );

                        // Live Card Rendering ke UI secara instan!
                        renderResults(currentResults);
                    } else if (event.type === "complete") {
                        setLoadingState(true, `Pemrosesan Selesai!`, `Seluruh ${event.total} post berhasil diproses.`, 100, event.total, event.total);
                    }
                } catch (pErr) {
                    console.error("JSON parse stream error:", pErr);
                }
            }
        }

        showToast(`✅ Berhasil memproses ${currentResults.length} post Instagram secara live!`, "success");
    } catch (err) {
        console.error(err);
        showToast(`Error: ${err.message}`, "error");
    } finally {
        setTimeout(() => {
            setLoadingState(false);
        }, 600);
    }
}

// Expose fungsi ke window object agar tombol HTML selalu bisa memanggilnya
window.handleProcessSubmit = handleProcessSubmit;

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

// --- Render Results to DOM ---
function renderResults(results) {
    const resultsContainer = document.getElementById("results-container");
    const emptyState = document.getElementById("empty-state");
    const globalActions = document.getElementById("global-actions");
    if (!resultsContainer) return;

    resultsContainer.innerHTML = "";
    
    if (results.length === 0) {
        if (emptyState) emptyState.classList.remove("hidden");
        if (globalActions) globalActions.classList.add("hidden");
        return;
    }

    if (emptyState) emptyState.classList.add("hidden");
    if (globalActions) globalActions.classList.remove("hidden");

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
                            <button class="btn-set-selebaran" data-card-index="${index}" data-foto-idx="${fIdx}" title="Klik untuk menjadikan gambar ini sebagai Selebaran Naskah">
                                <i class="fa-solid fa-file-signature"></i> Set Selebaran
                            </button>
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
                                <div class="ocr-header">
                                    <h5 class="gallery-title"><i class="fa-solid fa-file-image"></i> Gambar Selebaran</h5>
                                    <button class="btn btn-sm btn-outline btn-open-fullscreen" data-index="${index}">
                                        <i class="fa-solid fa-expand"></i> Layar Penuh (Fullscreen Editor)
                                    </button>
                                </div>
                                <a href="${item.selebaran}" target="_blank">
                                    <img src="${item.selebaran}" alt="Gambar Selebaran" loading="lazy" referrerpolicy="no-referrer" />
                                </a>
                            </div>
                            <div class="side-right-ocr">
                                <div class="ocr-header">
                                    <h5 class="gallery-title"><i class="fa-solid fa-edit"></i> Edit / Verifikasi Teks OCR</h5>
                                    <div style="display: flex; gap: 0.5rem;">
                                        <button class="btn btn-sm btn-accent btn-ai-refine" data-index="${index}">
                                            <i class="fa-solid fa-wand-magic-sparkles"></i> AI Rapikan Paragraf
                                        </button>
                                        <button class="btn btn-sm btn-outline btn-copy-ocr" data-index="${index}">
                                            <i class="fa-solid fa-copy"></i> Salin Teks OCR
                                        </button>
                                    </div>
                                </div>
                                <textarea class="ocr-textarea ocr-edit-input" data-index="${index}" id="card-ocr-textarea-${index}" placeholder="Teks OCR akan muncul di sini...">${escapeHtml(item.selebaran_ocr_text || "")}</textarea>
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

    // Event listener for Set Selebaran buttons
    document.querySelectorAll(".btn-set-selebaran").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const cardIdx = parseInt(e.currentTarget.getAttribute("data-card-index"), 10);
            const fotoIdx = parseInt(e.currentTarget.getAttribute("data-foto-idx"), 10);
            
            const item = currentResults[cardIdx];
            if (!item || !item.foto || !item.foto[fotoIdx]) return;

            const chosenFotoUrl = item.foto[fotoIdx];
            const oldSelebaranUrl = item.selebaran;

            // Tukar posisi gambar
            item.selebaran = chosenFotoUrl;
            item.foto.splice(fotoIdx, 1);
            if (oldSelebaranUrl) {
                item.foto.unshift(oldSelebaranUrl); // Masukkan selebaran lama ke awal array foto
            }

            renderResults(currentResults);
            showToast("📜 Gambar berhasil diubah menjadi Selebaran Naskah!", "success");
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

    // Event listener for Fullscreen Workspace Editor
    document.querySelectorAll(".btn-open-fullscreen").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const idx = e.currentTarget.getAttribute("data-index");
            const item = results[idx];
            if (!item) return;

            const fsModal = document.getElementById("fullscreen-editor-modal");
            const fsTitle = document.getElementById("fullscreen-modal-title");
            const fsImgLink = document.getElementById("fs-image-link");
            const fsImgPreview = document.getElementById("fs-image-preview");
            const fsTextarea = document.getElementById("fs-ocr-textarea");

            if (fsModal && fsImgPreview && fsTextarea) {
                fsTitle.innerHTML = `<i class="fa-solid fa-expand"></i> Fullscreen Workspace Editor — Kamisan ke-${item.kamisan_number}`;
                fsImgPreview.src = item.selebaran || "";
                fsImgLink.href = item.selebaran || "#";
                fsTextarea.value = item.selebaran_ocr_text || "";

                fsModal.classList.remove("hidden");

                // Live Sync dari Fullscreen Textarea ke Results Data & Card Textarea
                const syncHandler = (evt) => {
                    const updatedVal = evt.target.value;
                    item.selebaran_ocr_text = updatedVal;
                    const cardTextarea = document.getElementById(`card-ocr-textarea-${idx}`);
                    if (cardTextarea) cardTextarea.value = updatedVal;
                };

                fsTextarea.oninput = syncHandler;

                // Close Button Listener
                const btnClose = document.getElementById("btn-fullscreen-close");
                const btnCopy = document.getElementById("btn-fullscreen-copy");

                if (btnClose) {
                    btnClose.onclick = () => {
                        fsModal.classList.add("hidden");
                        showToast("Perubahan teks disimpan secara otomatis!");
                    };
                }

                if (btnCopy) {
                    btnCopy.onclick = () => {
                        copyToClipboard(fsTextarea.value);
                        showToast("Teks OCR berhasil disalin!");
                    };
                }

                // Esc Key Listener
                const escHandler = (evt) => {
                    if (evt.key === "Escape") {
                        fsModal.classList.add("hidden");
                        document.removeEventListener("keydown", escHandler);
                    }
                };
                document.addEventListener("keydown", escHandler);
            }
        });
    });

    // Event listener for AI Refine Paragraphs button
    document.querySelectorAll(".btn-ai-refine").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const idx = e.currentTarget.getAttribute("data-index");
            const item = results[idx];
            if (!item || !item.selebaran_ocr_text) {
                showToast("Tidak ada teks OCR untuk dirapikan!", "warning");
                return;
            }

            setLoadingState(true, "AI sedang merapikan susunan kalimat...", "Menghilangkan kata terputus & menyusun paragraf...");

            try {
                const resp = await fetch("/api/refine-text", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: item.selebaran_ocr_text })
                });

                if (!resp.ok) throw new Error("Gagal merapikan teks");

                const data = await resp.json();
                if (data.refined_text) {
                    item.selebaran_ocr_text = data.refined_text;
                    const cardTextarea = document.getElementById(`card-ocr-textarea-${idx}`);
                    if (cardTextarea) cardTextarea.value = data.refined_text;
                    showToast("✨ Teks OCR berhasil dirapikan secara otomatis!", "success");
                }
            } catch (err) {
                console.error(err);
                showToast("Gagal merapikan teks", "error");
            } finally {
                setLoadingState(false);
            }
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

// --- Dynamic Download File Name Generator ---
function getDynamicFileName(results, extension) {
    if (!results || results.length === 0) {
        return `kamisan_data.${extension}`;
    }

    const numbers = results
        .map(r => parseInt(r.kamisan_number))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);

    if (numbers.length === 0) {
        return `kamisan_data.${extension}`;
    }

    const minNum = numbers[0];
    const maxNum = numbers[numbers.length - 1];

    if (minNum === maxNum) {
        return `${minNum}.${extension}`;
    } else {
        return `${minNum}-${maxNum}.${extension}`;
    }
}

// --- DOMContentLoaded Init & Event Binding ---
document.addEventListener("DOMContentLoaded", () => {
    const btnSubmit = document.getElementById("btn-submit");
    const btnSample = document.getElementById("btn-sample");
    const btnFetchAccount = document.getElementById("btn-fetch-account");
    const urlInput = document.getElementById("url-input");

    const btnCopyAll = document.getElementById("btn-copy-all");
    const btnExportCsv = document.getElementById("btn-export-csv");
    const btnExportJanganDiam = document.getElementById("btn-export-jangandiam");
    const btnExportTxt = document.getElementById("btn-export-txt");
    const btnSaveArchive = document.getElementById("btn-save-archive");

    if (btnSaveArchive) {
        btnSaveArchive.addEventListener("click", async () => {
            if (!currentResults.length) return;

            const archiveSchema = currentResults.map(item => {
                const actNum = item.kamisan_number || "";
                const dateStr = item.date_utc ? item.date_utc.split("T")[0] : "";
                const ocrText = item.selebaran_ocr_text || "";
                
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
                    "source": "Selebaran Aksi Kamisan",
                    "sourceUrl": item.post_url,
                    "textBody": paragraphs || "<p></p>",
                    "attachments": attachments
                };
            });

            setLoadingState(true, "Menyimpan ke file archive.json...", "Memperbarui database katalog publik...");

            try {
                const resp = await fetch("/api/archive/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ items: archiveSchema })
                });

                if (!resp.ok) throw new Error("Gagal menyimpan ke archive.json");

                const resData = await resp.json();
                if (resData.auto_pushed) {
                    showToast(`✅ Berhasil menyimpan & otomatis sync ke GitHub Pages! (${resData.added} baru, ${resData.updated} diperbarui)`, "success");
                } else {
                    showToast(`✅ Berhasil menyimpan ${resData.added} data baru ke archive.json!`, "success");
                }
            } catch (err) {
                console.error(err);
                showToast("Gagal menyimpan ke archive.json", "error");
            } finally {
                setLoadingState(false);
            }
        });
    }

    if (btnSubmit) {
        btnSubmit.addEventListener("click", handleProcessSubmit);
    }

    if (btnSample && urlInput) {
        btnSample.addEventListener("click", () => {
            urlInput.value = `796 : https://www.instagram.com/p/CzvEbUay2gf/?img_index=3\n794 : https://www.instagram.com/p/Czc5ex0SdbX/?img_index=2`;
        });
    }

    if (btnFetchAccount) {
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
    }

    if (btnCopyAll) {
        btnCopyAll.addEventListener("click", () => {
            if (!currentResults.length) return;
            const allText = currentResults.map(item => formatSingleText(item)).join("\n\n============================================================\n\n");
            copyToClipboard(allText);
            showToast("Semua teks hasil berhasil disalin!");
        });
    }

    if (btnExportTxt) {
        btnExportTxt.addEventListener("click", () => {
            if (!currentResults.length) return;
            const allText = currentResults.map(item => formatSingleText(item)).join("\n\n============================================================\n\n");
            const fileName = getDynamicFileName(currentResults, "txt");
            downloadFile(allText, fileName, "text/plain");
        });
    }

    if (btnExportJanganDiam) {
        btnExportJanganDiam.addEventListener("click", () => {
            if (!currentResults.length) return;

            const jsonSchema = currentResults.map(item => {
                const actNum = item.kamisan_number || "";
                const dateStr = item.date_utc ? item.date_utc.split("T")[0] : "";
                const ocrText = item.selebaran_ocr_text || "";
                
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
                    "source": "Selebaran Aksi Kamisan",
                    "sourceUrl": item.post_url,
                    "textBody": paragraphs || "<p></p>",
                    "attachments": attachments
                };
            });

            const jsonStr = JSON.stringify(jsonSchema, null, 2);
            const fileName = getDynamicFileName(currentResults, "json");
            downloadFile(jsonStr, fileName, "application/json");
            showToast(`File JSON (${fileName}) berhasil diunduh!`);
        });
    }

    if (btnExportCsv) {
        btnExportCsv.addEventListener("click", () => {
            if (!currentResults.length) return;
            
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

            const csvContent = "\uFEFF" + rows.join("\n");
            const fileName = getDynamicFileName(currentResults, "csv");
            downloadFile(csvContent, fileName, "text/csv;charset=utf-8;");
            showToast(`File CSV Spreadsheet (${fileName}) berhasil diunduh!`);
        });
    }
});
