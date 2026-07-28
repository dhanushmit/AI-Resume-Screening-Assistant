document.addEventListener('DOMContentLoaded', () => {
    // --- State Variables ---
    let uploadedFiles = [];
    let screeningResults = [];

    // --- DOM Elements ---
    const apiProvider = document.getElementById('apiProvider');
    const apiKey = document.getElementById('apiKey');
    const embeddingProvider = document.getElementById('embeddingProvider');
    const chunkSize = document.getElementById('chunkSize');
    const chunkOverlap = document.getElementById('chunkOverlap');
    const topK = document.getElementById('topK');
    
    const btnOpenSettings = document.getElementById('btnOpenSettings');
    const btnCloseSettings = document.getElementById('btnCloseSettings');
    const settingsDrawer = document.getElementById('settingsDrawer');
    const settingsBackdrop = document.getElementById('settingsBackdrop');
    
    const jobDescription = document.getElementById('jobDescription');
    const btnLoadSampleJD = document.getElementById('btnLoadSampleJD');
    
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const fileCount = document.getElementById('fileCount');
    const btnClearAll = document.getElementById('btnClearAll');
    
    const btnStartScreen = document.getElementById('btnStartScreen');
    
    const progressCard = document.getElementById('progressCard');
    const progressBarFill = document.getElementById('progressBarFill');
    const progressPercentage = document.getElementById('progressPercentage');
    const progressText = document.getElementById('progressText');
    const terminalLogs = document.getElementById('terminalLogs');
    
    const resultsCard = document.getElementById('resultsCard');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const btnExportCSV = document.getElementById('btnExportCSV');
    
    // Modal Elements
    const candidateModal = document.getElementById('candidateModal');
    const closeModal = document.getElementById('closeModal');
    const modalCandidateName = document.getElementById('modalCandidateName');
    const modalCandidateRank = document.getElementById('modalCandidateRank');
    const modalScoreValue = document.getElementById('modalScoreValue');
    const modalScoreCircle = document.getElementById('modalScoreCircle');
    const modalVerdict = document.getElementById('modalVerdict');
    const modalMatchingSkills = document.getElementById('modalMatchingSkills');
    const modalMissingSkills = document.getElementById('modalMissingSkills');
    const modalGraphLogs = document.getElementById('modalGraphLogs');
    const modalRagChunks = document.getElementById('modalRagChunks');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    // Architecture Info Modal Elements
    const infoModal = document.getElementById('infoModal');
    const closeInfoModal = document.getElementById('closeInfoModal');
    const btnOpenRagInfo = document.getElementById('btnOpenRagInfo');
    const btnOpenGraphInfo = document.getElementById('btnOpenGraphInfo');
    const tabBtnsInfo = document.querySelectorAll('.tab-btn-info');
    const tabPanesInfo = document.querySelectorAll('.tab-pane-info');
    
    // Toast
    const toastContainer = document.getElementById('toastContainer');

    // --- Local Storage Initialization ---
    // Load saved settings
    if (localStorage.getItem('screenai_provider')) {
        apiProvider.value = localStorage.getItem('screenai_provider');
    }
    if (localStorage.getItem('screenai_key')) {
        apiKey.value = localStorage.getItem('screenai_key');
    }
    if (localStorage.getItem('screenai_embedding')) {
        embeddingProvider.value = localStorage.getItem('screenai_embedding');
    }
    
    // Auto-fallback to gemini embeddings on Render to prevent OOM crash (PyTorch/sentence-transformers uses >512MB RAM)
    if (window.location.hostname.includes('onrender.com')) {
        if (!localStorage.getItem('screenai_embedding') || localStorage.getItem('screenai_embedding') === 'sentence-transformers') {
            embeddingProvider.value = 'gemini';
            localStorage.setItem('screenai_embedding', 'gemini');
        }
    }
    
    // Save settings on change
    apiProvider.addEventListener('change', () => {
        localStorage.setItem('screenai_provider', apiProvider.value);
    });
    apiKey.addEventListener('input', () => {
        localStorage.setItem('screenai_key', apiKey.value);
    });
    embeddingProvider.addEventListener('change', () => {
        localStorage.setItem('screenai_embedding', embeddingProvider.value);
    });

    // --- Toggle Settings Drawer ---
    btnOpenSettings.addEventListener('click', () => {
        settingsDrawer.classList.add('active');
        settingsBackdrop.classList.add('active');
    });

    const closeSettings = () => {
        settingsDrawer.classList.remove('active');
        settingsBackdrop.classList.remove('active');
    };

    btnCloseSettings.addEventListener('click', closeSettings);
    settingsBackdrop.addEventListener('click', closeSettings);

    // --- Architecture Info Modal ---
    const switchInfoTab = (tabId) => {
        tabBtnsInfo.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab-info') === tabId);
        });
        tabPanesInfo.forEach(pane => {
            pane.classList.toggle('active', pane.getAttribute('id') === tabId);
        });
    };

    tabBtnsInfo.forEach(btn => {
        btn.addEventListener('click', () => {
            switchInfoTab(btn.getAttribute('data-tab-info'));
        });
    });

    const openInfoModalWithTab = (tabId) => {
        switchInfoTab(tabId);
        infoModal.classList.add('active');
    };

    btnOpenRagInfo.addEventListener('click', () => openInfoModalWithTab('info-rag'));
    btnOpenGraphInfo.addEventListener('click', () => openInfoModalWithTab('info-graph'));

    const closeInfoModalFunc = () => {
        infoModal.classList.remove('active');
    };

    closeInfoModal.addEventListener('click', closeInfoModalFunc);
    infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) {
            closeInfoModalFunc();
        }
    });

    // --- Toast Alert Helper ---
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = 'fa-circle-check';
        if (type === 'error') icon = 'fa-circle-xmark';
        if (type === 'warning') icon = 'fa-circle-exclamation';
        
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- Load Sample Job Description ---
    btnLoadSampleJD.addEventListener('click', () => {
        jobDescription.value = `Position: Senior Python & AI Engineer

Required Technical Skills:
- Strong experience in Python programming (OOP, async/await).
- Hands-on experience developing web applications using FastAPI or Flask.
- Experience with RAG (Retrieval-Augmented Generation) pipelines and Vector Databases like FAISS or Pinecone.
- Orchestration frameworks like LangChain, LlamaIndex, or LangGraph for LLM workflows.
- Solid understanding of Docker and containerized deployment.
- Familiarity with AWS services (S3, EC2, ECS) for cloud deployment.
- Experience with Git version control and CI/CD pipelines.

Responsibilities:
- Build and optimize retrieval-augmented generation (RAG) backend systems.
- Design agentic LLM workflows and deploy multi-agent graphs.
- Maintain high code coverage with unit testing.
- Collaborate with frontend teams to integrate AI models via REST APIs.`;
        showToast('Sample Job Description loaded!', 'success');
    });

    // --- Drag & Drop Resumes ---
    dropzone.addEventListener('click', () => fileInput.click());
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', () => {
        handleFiles(fileInput.files);
    });

    function handleFiles(files) {
        let addedCount = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                showToast(`File ${file.name} is not a PDF. Only PDFs are supported.`, 'error');
                continue;
            }
            // Check duplicate
            if (uploadedFiles.some(f => f.name === file.name && f.size === file.size)) {
                continue;
            }
            uploadedFiles.push(file);
            addedCount++;
        }
        if (addedCount > 0) {
            updateFileList();
            showToast(`Added ${addedCount} resume(s).`, 'success');
        }
    }

    function updateFileList() {
        if (uploadedFiles.length === 0) {
            fileList.innerHTML = '<li class="empty-state">No files uploaded yet.</li>';
            fileCount.textContent = '0';
            return;
        }

        fileCount.textContent = uploadedFiles.length;
        fileList.innerHTML = '';
        
        uploadedFiles.forEach((file, index) => {
            const li = document.createElement('li');
            li.className = 'file-item';
            
            const sizeKB = (file.size / 1024).toFixed(1);
            
            li.innerHTML = `
                <div class="file-info">
                    <i class="fa-solid fa-file-pdf"></i>
                    <div class="file-name-size">
                        <span>${file.name}</span>
                        <small>${sizeKB} KB</small>
                    </div>
                </div>
                <button class="btn-remove-file" data-index="${index}"><i class="fa-solid fa-xmark"></i></button>
            `;
            fileList.appendChild(li);
        });

        // Add remove handlers
        document.querySelectorAll('.btn-remove-file').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-index'));
                uploadedFiles.splice(idx, 1);
                updateFileList();
            });
        });
    }

    btnClearAll.addEventListener('click', () => {
        if (uploadedFiles.length === 0) return;
        uploadedFiles = [];
        updateFileList();
        showToast('All files removed.', 'warning');
    });

    // --- Terminal Logging Helpers ---
    function clearLogs() {
        terminalLogs.innerHTML = '';
    }

    function addLogLine(message, type = 'info') {
        const line = document.createElement('div');
        line.className = `terminal-line ${type}`;
        const time = new Date().toLocaleTimeString();
        line.innerHTML = `[${time}] ${message}`;
        terminalLogs.appendChild(line);
        terminalLogs.scrollTop = terminalLogs.scrollHeight;
    }

    // --- Start Screening Process ---
    btnStartScreen.addEventListener('click', async () => {
        // Validation
        const jdText = jobDescription.value.trim();
        const key = apiKey.value.trim();
        
        if (!jdText) {
            showToast('Please paste a Job Description first.', 'error');
            jobDescription.focus();
            return;
        }
        
        if (uploadedFiles.length === 0) {
            showToast('Please upload at least one candidate PDF resume.', 'error');
            return;
        }
        
        if (!key) {
            // Server-side fallback configuration will be used
        }

        // Reset and show progress card
        progressCard.style.display = 'block';
        resultsCard.style.display = 'none';
        progressBarFill.style.width = '0%';
        progressPercentage.textContent = '0%';
        btnStartScreen.disabled = true;
        clearLogs();

        addLogLine('Initializing screening backend pipeline...', 'info');
        progressBarFill.style.width = '10%';
        progressPercentage.textContent = '10%';
        
        // Form data construction
        const formData = new FormData();
        formData.append('job_description', jdText);
        formData.append('api_provider', apiProvider.value);
        formData.append('api_key', key);
        formData.append('embedding_provider', embeddingProvider.value);
        formData.append('top_k', topK.value);
        formData.append('chunk_size', chunkSize.value);
        formData.append('chunk_overlap', chunkOverlap.value);
        
        uploadedFiles.forEach(file => {
            formData.append('resumes', file);
        });

        // Simulate some steps to make it look responsive while server processes
        let progressInterval = setInterval(() => {
            const currentWidth = parseFloat(progressBarFill.style.width);
            if (currentWidth < 85) {
                const nextWidth = currentWidth + (90 - currentWidth) * 0.15;
                progressBarFill.style.width = `${nextWidth.toFixed(0)}%`;
                progressPercentage.textContent = `${nextWidth.toFixed(0)}%`;
                
                if (nextWidth > 20 && nextWidth < 35) {
                    addLogLine(`Parsing candidate PDF documents (${uploadedFiles.length} files detected)...`, 'info');
                } else if (nextWidth >= 35 && nextWidth < 55) {
                    addLogLine(`Splitting resume texts into overlapping chunks (Size: ${chunkSize.value} chars)...`, 'info');
                } else if (nextWidth >= 55 && nextWidth < 75) {
                    addLogLine(`Generating embeddings using ${embeddingProvider.value} provider...`, 'info');
                    addLogLine('Indexing chunks in FAISS vector stores...', 'info');
                } else if (nextWidth >= 75) {
                    addLogLine('Orchestrating agentic workflows using LangGraph...', 'info');
                    addLogLine('Running Graph Node 1 (Retrieve) & Node 2 (Score & Summarize) per candidate...', 'info');
                }
            }
        }, 1800);

        try {
            const response = await fetch('/api/screen', {
                method: 'POST',
                body: formData
            });

            clearInterval(progressInterval);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to screen resumes.');
            }

            const data = await response.json();
            
            if (data.status === 'error') {
                throw new Error(data.error || 'Unknown server error occurred.');
            }

            progressBarFill.style.width = '100%';
            progressPercentage.textContent = '100%';
            progressText.textContent = 'Screening Completed successfully!';
            addLogLine('LangGraph workflow completed successfully for all candidates.', 'success');
            addLogLine(`Successfully processed ${data.results.length} resumes.`, 'success');
            
            screeningResults = data.results;
            renderResults(data.results);
            resultsCard.style.display = 'block';
            showToast('Resume screening workflow completed!', 'success');
            
            // Print detailed logs from the server response
            data.results.forEach(res => {
                addLogLine(`[${res.candidate_name}] Logs:`, 'info');
                res.logs.forEach(logLine => {
                    addLogLine(` -> ${logLine}`, logLine.includes('Error') ? 'error' : 'success');
                });
            });

        } catch (err) {
            clearInterval(progressInterval);
            progressBarFill.style.backgroundColor = 'var(--danger)';
            progressText.textContent = 'Screening Failed';
            addLogLine(`Error: ${err.message}`, 'error');
            showToast(err.message, 'error');
        } finally {
            btnStartScreen.disabled = false;
        }
    });

    // --- Render Results Table ---
    function renderResults(results) {
        if (results.length === 0) {
            resultsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state" style="text-align: center; padding: 40px;">
                        No candidates screened successfully.
                    </td>
                </tr>
            `;
            return;
        }

        resultsTableBody.innerHTML = '';
        results.forEach((cand, idx) => {
            const tr = document.createElement('tr');
            
            // Rank badge
            let rankClass = 'rank-other';
            if (idx === 0) rankClass = 'rank-1';
            else if (idx === 1) rankClass = 'rank-2';
            else if (idx === 2) rankClass = 'rank-3';
            
            // Score badge color
            let scoreClass = 'score-low';
            if (cand.match_score >= 80) scoreClass = 'score-high';
            else if (cand.match_score >= 50) scoreClass = 'score-mid';
            
            // Display missing skills (show max 3, comma separated)
            const missingSkillsPreview = cand.missing_skills.length > 0 
                ? cand.missing_skills.slice(0, 3).map(s => `<span class="skill-tag missing">${s}</span>`).join(' ') + (cand.missing_skills.length > 3 ? ' ...' : '')
                : '<span class="skill-tag" style="border-color: var(--success); color: var(--success)">None! perfect overlap</span>';

            tr.innerHTML = `
                <td>
                    <span class="rank-badge ${rankClass}">${idx + 1}</span>
                </td>
                <td>
                    <strong style="font-size: 1rem;">${cand.candidate_name}</strong>
                </td>
                <td>
                    <span class="score-badge ${scoreClass}">${cand.match_score}%</span>
                </td>
                <td>
                    ${missingSkillsPreview}
                </td>
                <td style="text-align: center;">
                    <button class="btn btn-secondary btn-sm btn-view-details" data-id="${cand.candidate_id}" data-rank="${idx + 1}">
                        <i class="fa-solid fa-circle-info"></i> View Details
                    </button>
                </td>
            `;
            resultsTableBody.appendChild(tr);
        });

        // Add View Details click listeners
        document.querySelectorAll('.btn-view-details').forEach(btn => {
            btn.addEventListener('click', () => {
                const candId = btn.getAttribute('data-id');
                const rank = btn.getAttribute('data-rank');
                openDetailsModal(candId, rank);
            });
        });
    }

    // --- Modal Handler ---
    function openDetailsModal(candId, rank) {
        const cand = screeningResults.find(c => c.candidate_id === candId);
        if (!cand) return;

        // Populate Modal Fields
        modalCandidateName.textContent = cand.candidate_name;
        modalCandidateRank.textContent = `Rank #${rank}`;
        modalScoreValue.textContent = cand.match_score;
        modalVerdict.textContent = cand.summary || "No summary provided.";

        // Circle Progress Animation
        const offset = 251.2 - (251.2 * cand.match_score) / 100;
        modalScoreCircle.style.strokeDashoffset = offset;
        
        // Color transition for modal score circle
        if (cand.match_score >= 80) {
            modalScoreCircle.style.stroke = 'var(--success)';
        } else if (cand.match_score >= 50) {
            modalScoreCircle.style.stroke = 'var(--warning)';
        } else {
            modalScoreCircle.style.stroke = 'var(--danger)';
        }

        // Render matching skills
        modalMatchingSkills.innerHTML = '';
        if (cand.matching_skills.length === 0) {
            modalMatchingSkills.innerHTML = '<li>None identified</li>';
        } else {
            cand.matching_skills.forEach(skill => {
                const li = document.createElement('li');
                li.textContent = skill;
                modalMatchingSkills.appendChild(li);
            });
        }

        // Render missing skills
        modalMissingSkills.innerHTML = '';
        if (cand.missing_skills.length === 0) {
            modalMissingSkills.innerHTML = '<li>No missing requirements!</li>';
        } else {
            cand.missing_skills.forEach(skill => {
                const li = document.createElement('li');
                li.textContent = skill;
                modalMissingSkills.appendChild(li);
            });
        }

        // Render LangGraph logs in details modal
        modalGraphLogs.innerHTML = '';
        cand.logs.forEach(logLine => {
            const div = document.createElement('div');
            div.className = 'terminal-line';
            
            // Format log colors
            if (logLine.includes('Node 1')) div.style.color = '#93c5fd';
            else if (logLine.includes('Node 2')) div.style.color = '#c084fc';
            else if (logLine.includes('Error')) div.style.color = '#f87171';
            else div.style.color = '#34d399';
            
            div.textContent = `>>> ${logLine}`;
            modalGraphLogs.appendChild(div);
        });

        // Render RAG Chunks
        modalRagChunks.innerHTML = '';
        if (cand.retrieved_chunks.length === 0) {
            modalRagChunks.innerHTML = '<div class="empty-state">No chunks retrieved for comparison.</div>';
        } else {
            cand.retrieved_chunks.forEach((chunk, index) => {
                const div = document.createElement('div');
                div.className = 'rag-chunk';
                div.innerHTML = `
                    <div class="rag-chunk-header">
                        <span>Chunk #${index + 1}</span>
                        <span>Length: ${chunk.length} chars</span>
                    </div>
                    <div class="rag-chunk-body">${escapeHTML(chunk)}</div>
                `;
                modalRagChunks.appendChild(div);
            });
        }

        // Reset and trigger Graph Node animation sequence
        resetGraphNodeVisuals();
        animateGraphFlow(cand.logs);

        // Reset Modal Tabs
        switchTab('tab-summary');

        // Show Modal
        candidateModal.classList.add('active');
    }

    function escapeHTML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Close Modal
    closeModal.addEventListener('click', () => {
        candidateModal.classList.remove('active');
    });

    candidateModal.addEventListener('click', (e) => {
        if (e.target === candidateModal) {
            candidateModal.classList.remove('active');
        }
    });

    // --- Modal Tab switching ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    function switchTab(tabId) {
        tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        });
        tabPanes.forEach(pane => {
            pane.classList.toggle('active', pane.getAttribute('id') === tabId);
        });
    }

    // --- LangGraph Visualization Animations ---
    const nodeStart = document.getElementById('node-start');
    const nodeRetrieve = document.getElementById('node-retrieve');
    const nodeScore = document.getElementById('node-score');
    const nodeEnd = document.getElementById('node-end');
    const arrowToScore = document.getElementById('arrow-to-score');
    const arrowToEnd = document.getElementById('arrow-to-end');

    function resetGraphNodeVisuals() {
        nodeRetrieve.className = 'graph-node';
        nodeScore.className = 'graph-node';
        nodeEnd.className = 'graph-node';
        arrowToScore.className = 'graph-arrow';
        arrowToEnd.className = 'graph-arrow';
    }

    function animateGraphFlow(logs) {
        // Start node starts active
        nodeStart.className = 'graph-node active-node';
        
        // Node 1: Retrieve (Start sequence)
        setTimeout(() => {
            nodeStart.className = 'graph-node completed-node';
            nodeRetrieve.className = 'graph-node active-node';
        }, 800);

        // Node 2: Score & Summarize
        setTimeout(() => {
            // Check if there was a retrieval error in logs
            const hasError = logs.some(l => l.includes('Error') && l.includes('retrieval'));
            if (hasError) {
                nodeRetrieve.className = 'graph-node error-node'; // Custom styling if needed, or fallback
                return;
            }
            nodeRetrieve.className = 'graph-node completed-node';
            arrowToScore.className = 'graph-arrow arrow-completed';
            nodeScore.className = 'graph-node active-node';
        }, 1800);

        // End Node
        setTimeout(() => {
            const hasScoreError = logs.some(l => l.includes('Error') && l.includes('scoring'));
            nodeScore.className = hasScoreError ? 'graph-node error-node' : 'graph-node completed-node';
            arrowToEnd.className = 'graph-arrow arrow-completed';
            nodeEnd.className = 'graph-node completed-node';
        }, 2800);
    }

    // --- Export Results to CSV ---
    btnExportCSV.addEventListener('click', () => {
        if (screeningResults.length === 0) return;
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Rank,Candidate Name,Match Score,Matching Skills,Missing Skills,Recruiter Summary\n";
        
        screeningResults.forEach((cand, idx) => {
            const row = [
                idx + 1,
                `"${cand.candidate_name.replace(/"/g, '""')}"`,
                `"${cand.match_score}%"`,
                `"${cand.matching_skills.join(', ').replace(/"/g, '""')}"`,
                `"${cand.missing_skills.join(', ').replace(/"/g, '""')}"`,
                `"${cand.summary.replace(/"/g, '""')}"`
            ].join(",");
            csvContent += row + "\n";
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Screening_Results_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        
        link.click();
        document.body.removeChild(link);
        showToast('Exported CSV successfully!', 'success');
    });
});
