const DOM = {
    settingsModal: document.getElementById('settingsModal'),
    btnOpenSettings: document.getElementById('btnOpenSettings'),
    btnSaveSettings: document.getElementById('btnSaveSettings'),
    btnTestConn: document.getElementById('btnTestConn'),

    // Settings Tabs
    tabDremio: document.getElementById('tabDremio'),
    tabPolaris: document.getElementById('tabPolaris'),
    settingsDremio: document.getElementById('settingsDremio'),
    settingsPolaris: document.getElementById('settingsPolaris'),

    // Dremio Settings
    setDremioUrl: document.getElementById('setDremioUrl'),
    setDremioPat: document.getElementById('setDremioPat'),
    setDremioProjectId: document.getElementById('setDremioProjectId'),
    setDremioUsername: document.getElementById('setDremioUsername'),
    setDremioPassword: document.getElementById('setDremioPassword'),

    // Polaris Settings
    setPolarisType: document.getElementById('setPolarisType'),
    setPolarisUrl: document.getElementById('setPolarisUrl'),
    setPolarisClientId: document.getElementById('setPolarisClientId'),
    setPolarisClientSecret: document.getElementById('setPolarisClientSecret'),
    setPolarisToken: document.getElementById('setPolarisToken'),
    setPolarisWarehouse: document.getElementById('setPolarisWarehouse'),
    polarisOauthGroup: document.getElementById('polarisOauthGroup'),
    polarisTokenGroup: document.getElementById('polarisTokenGroup'),

    // Source UI
    manualSourceGroup: document.getElementById('manualSourceGroup'),
    manualSourceInput: document.getElementById('manualSourceInput'),
    dremioSourceGroup: document.getElementById('dremioSourceGroup'),
    sourceTree: document.getElementById('sourceTree'),
    sourcePathDisplay: document.getElementById('sourcePathDisplay'),

    // Target UI
    chkManualMode: document.getElementById('chkManualMode'),
    dremioSourceGroup: document.getElementById('dremioSourceGroup'),
    manualSourceGroup: document.getElementById('manualSourceGroup'),
    manualSourceInput: document.getElementById('manualSourceInput'),
    bulkMigrateGroup: document.getElementById('bulkMigrateGroup'),
    sourceDescription: document.getElementById('sourceDescription'),

    targetPathInput: document.getElementById('targetPathInput'),
    clusterByInput: document.getElementById('clusterByInput'),
    migrationStrategy: document.getElementById('migrationStrategy'),
    chkValidate: document.getElementById('chkValidate'),
    chkBulkMigrate: document.getElementById('chkBulkMigrate'),

    btnMigrate: document.getElementById('btnMigrate'),
    logConsole: document.getElementById('logConsole'),
    toast: document.getElementById('toast'),

    // History Modal
    historyModal: document.getElementById('historyModal'),
    btnOpenHistory: document.getElementById('btnOpenHistory'),
    btnCloseHistoryModal: document.getElementById('btnCloseHistoryModal'),
    historyTableBody: document.getElementById('historyTableBody'),

    // Diagnostics Modal
    diagnosticsModal: document.getElementById('diagnosticsModal'),
    btnOpenDiagnostics: document.getElementById('btnOpenDiagnostics'),
    btnCloseDiagnosticsModal: document.getElementById('btnCloseDiagnosticsModal'),
    btnRunDiagnostics: document.getElementById('btnRunDiagnostics'),
    diagnosticsResults: document.getElementById('diagnosticsResults'),
    
    // Shutdown
    btnShutdown: document.getElementById('btnShutdown')
};

let selectedSourcePath = null;
let selectedSourceItem = null;

function showToast(msg, isError = false) {
    DOM.toast.textContent = msg;
    DOM.toast.style.borderLeftColor = isError ? 'var(--danger)' : 'var(--primary)';
    DOM.toast.classList.add('show');
    setTimeout(() => DOM.toast.classList.remove('show'), 3000);
}

function logMsg(msg, color = '#a7f3d0') {
    const time = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.style.color = color;
    div.textContent = `[${time}] ${msg}`;
    DOM.logConsole.appendChild(div);
    DOM.logConsole.scrollTop = DOM.logConsole.scrollHeight;
}

// --- Settings ---
DOM.tabDremio.addEventListener('click', () => {
    DOM.tabDremio.style.color = 'var(--primary)';
    DOM.tabPolaris.style.color = 'var(--text-muted)';
    DOM.settingsDremio.classList.remove('hidden');
    DOM.settingsPolaris.classList.add('hidden');
    DOM.btnTestConn.style.display = 'block';
});

DOM.tabPolaris.addEventListener('click', () => {
    DOM.tabPolaris.style.color = 'var(--primary)';
    DOM.tabDremio.style.color = 'var(--text-muted)';
    DOM.settingsPolaris.classList.remove('hidden');
    DOM.settingsDremio.classList.add('hidden');
    DOM.btnTestConn.style.display = 'none'; // Polaris test not implemented via REST yet
});

DOM.setPolarisType.addEventListener('change', () => {
    if (DOM.setPolarisType.value === 'STANDARD') {
        DOM.polarisOauthGroup.classList.remove('hidden');
        DOM.polarisTokenGroup.classList.add('hidden');
    } else {
        DOM.polarisOauthGroup.classList.add('hidden');
        DOM.polarisTokenGroup.classList.remove('hidden');
    }
});

DOM.migrationStrategy.addEventListener('change', () => {
    const strat = DOM.migrationStrategy.value;
    if (strat === 'IN_PLACE' || strat === 'SNAPSHOT') {
        DOM.manualSourceGroup.style.display = 'block';
    } else {
        DOM.manualSourceGroup.style.display = 'none';
        DOM.manualSourceInput.value = ''; // clear override
    }
});

DOM.chkBulkMigrate.addEventListener('change', () => {
    if (DOM.chkBulkMigrate.checked) {
        DOM.targetPathInput.placeholder = "catalog.namespace";
    } else {
        DOM.targetPathInput.placeholder = "catalog.namespace.table";
    }
});

async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.dremio_url) DOM.setDremioUrl.value = data.dremio_url;
        if (data.dremio_pat) DOM.setDremioPat.value = data.dremio_pat;
        if (data.dremio_project_id) DOM.setDremioProjectId.value = data.dremio_project_id;
        if (data.dremio_username) DOM.setDremioUsername.value = data.dremio_username;
        if (data.dremio_password) DOM.setDremioPassword.value = data.dremio_password;

        if (data.polaris_type) {
            DOM.setPolarisType.value = data.polaris_type;
            DOM.setPolarisType.dispatchEvent(new Event('change'));
        }
        if (data.polaris_url) DOM.setPolarisUrl.value = data.polaris_url;
        if (data.polaris_client_id) DOM.setPolarisClientId.value = data.polaris_client_id;
        if (data.polaris_client_secret) DOM.setPolarisClientSecret.value = data.polaris_client_secret;
        if (data.polaris_token) DOM.setPolarisToken.value = data.polaris_token;
        if (data.polaris_warehouse) DOM.setPolarisWarehouse.value = data.polaris_warehouse;
    } catch (e) {
        console.error(e);
    }
}

async function saveSettings() {
    const payload = {
        dremio_url: DOM.setDremioUrl.value,
        dremio_pat: DOM.setDremioPat.value,
        dremio_project_id: DOM.setDremioProjectId.value,
        dremio_username: DOM.setDremioUsername.value,
        dremio_password: DOM.setDremioPassword.value,
        polaris_type: DOM.setPolarisType.value,
        polaris_url: DOM.setPolarisUrl.value,
        polaris_client_id: DOM.setPolarisClientId.value,
        polaris_client_secret: DOM.setPolarisClientSecret.value,
        polaris_token: DOM.setPolarisToken.value,
        polaris_warehouse: DOM.setPolarisWarehouse.value
    };
    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            showToast("Settings saved successfully.");
            DOM.settingsModal.classList.add('hidden');
            loadNamespaceRoot(); // refresh tree
        }
    } catch (e) {
        showToast("Failed to save settings.", true);
    }
}

async function testConnection() {
    DOM.btnTestConn.textContent = "Testing...";
    try {
        await saveSettings(); // Save first then test
        const res = await fetch('/api/test-connection', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast("Connection Successful!");
        } else {
            showToast(`Connection Failed: ${data.message}`, true);
        }
    } catch (e) {
        showToast("Error testing connection.", true);
    } finally {
        DOM.btnTestConn.textContent = "Test Dremio";
    }
}

// --- Namespace Browser ---
function createTreeNode(item, pathList) {
    const div = document.createElement('div');

    const nodeRow = document.createElement('div');
    nodeRow.className = 'tree-node';

    // Icon based on type
    let icon = '📁';
    if (item.type === 'CONTAINER' || item.type === 'SOURCE' || item.type === 'SPACE') icon = '🗄️';
    if (item.type === 'DATASET' || item.type === 'PHYSICAL_DATASET') icon = '📊';
    if (item.type === 'FILE') icon = '📄';

    nodeRow.innerHTML = `<span>${icon}</span> <span>${item.name}</span>`;

    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children hidden';

    div.appendChild(nodeRow);
    div.appendChild(childrenContainer);

    let loaded = false;

    nodeRow.addEventListener('click', async (e) => {
        e.stopPropagation();

        // Select logic
        document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('selected'));
        nodeRow.classList.add('selected');
        selectedSourcePath = item.path.join('.'); // Format for Dremio SQL
        selectedSourceItem = item;
        DOM.sourcePathDisplay.value = selectedSourcePath;

        // Expand logic for containers
        if (item.type !== 'DATASET' && item.type !== 'PHYSICAL_DATASET' && item.type !== 'FILE') {
            childrenContainer.classList.toggle('hidden');

            if (!childrenContainer.classList.contains('hidden') && !loaded) {
                nodeRow.querySelector('span').textContent = '⏳'; // Loading
                try {
                    const encodedPath = encodeURIComponent(item.path.join(','));
                    const res = await fetch(`/api/catalog/children?path=${encodedPath}`);
                    const data = await res.json();

                    if (data.success && data.data && data.data.children) {
                        childrenContainer.innerHTML = '';
                        data.data.children.forEach(child => {
                            const cPath = [...item.path, child.path ? child.path[child.path.length - 1] : child.id];
                            childrenContainer.appendChild(createTreeNode({
                                name: child.id,
                                type: child.type,
                                path: cPath
                            }, cPath));
                        });
                        loaded = true;
                    }
                } catch (e) {
                    console.error("Failed to load children", e);
                } finally {
                    nodeRow.querySelector('span').textContent = icon;
                }
            }
        }
    });

    return div;
}

async function loadNamespaceRoot() {
    DOM.sourceTree.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);"><div class="loader"></div> Loading Namespace...</div>';
    try {
        const res = await fetch('/api/catalog/root');
        const data = await res.json();

        DOM.sourceTree.innerHTML = '';
        if (data.success && data.data) {
            data.data.forEach(item => {
                DOM.sourceTree.appendChild(createTreeNode(item, item.path));
            });
            logMsg("Loaded namespace.");
        } else {
            DOM.sourceTree.innerHTML = `<div style="padding: 1rem; color: var(--danger);">${data.error || 'Failed to load namespace'}</div>`;
            logMsg("Failed to load namespace. Please check settings.", "var(--danger)");
        }
    } catch (e) {
        DOM.sourceTree.innerHTML = `<div style="padding: 1rem; color: var(--danger);">Connection error</div>`;
    }
}

// --- Migration Execution ---
async function pollJob(jobId, isPySpark = false) {
    let lastState = null;

    while (true) {
        await new Promise(r => setTimeout(r, 2000));
        try {
            const res = await fetch(`/api/job/${jobId}?pyspark=${isPySpark}`);
            const data = await res.json();
            if (data.success && data.data) {
                const state = data.data.jobState;

                // Only log if state changed to avoid spam
                if (state !== lastState) {
                    logMsg(`Job Status: ${state}`);
                    lastState = state;
                }

                if (state === 'COMPLETED') {
                    return true;
                } else if (state === 'FAILED' || state === 'CANCELED') {
                    const err = data.data.errorMessage || "Unknown Error";
                    logMsg(`Job Failed: ${err}`, "var(--danger)");
                    return false;
                }
            }
        } catch (e) {
            console.error("Polling error", e);
        }
    }
}

async function startBulkMigration(strat, targetNamespace, isPySpark) {
    if (!selectedSourceItem || (selectedSourceItem.type === 'DATASET' || selectedSourceItem.type === 'PHYSICAL_DATASET' || selectedSourceItem.type === 'FILE')) {
        showToast("For Bulk Migration, please select a Folder or Source from the tree.", true);
        return;
    }

    DOM.btnMigrate.disabled = true;
    DOM.btnMigrate.innerHTML = '<div class="loader"></div> Bulk Migrating...';

    logMsg(`--- Starting Bulk Migration: ${selectedSourcePath} ---`, "var(--primary)");
    logMsg("Fetching folder contents from Dremio...");

    try {
        const encodedPath = encodeURIComponent(selectedSourceItem.path.join(','));
        const res = await fetch(`/api/catalog/children?path=${encodedPath}`);
        const data = await res.json();

        if (!data.success || !data.data || !data.data.children) {
            logMsg("Failed to retrieve folder contents.", "var(--danger)");
            DOM.btnMigrate.disabled = false;
            DOM.btnMigrate.textContent = 'Start Migration';
            return;
        }

        const datasets = data.data.children.filter(c => c.type === 'DATASET' || c.type === 'PHYSICAL_DATASET');

        if (datasets.length === 0) {
            logMsg("No tables found directly inside this folder.", "var(--danger)");
            DOM.btnMigrate.disabled = false;
            DOM.btnMigrate.textContent = 'Start Migration';
            return;
        }

        logMsg(`Found ${datasets.length} tables to migrate.`);

        let successCount = 0;
        for (let i = 0; i < datasets.length; i++) {
            const table = datasets[i];
            const tableName = table.path ? table.path[table.path.length - 1] : table.id;
            const fullSourcePath = [...selectedSourceItem.path, tableName].join('.');
            const fullTargetPath = `${targetNamespace}.${tableName}`;

            logMsg(`[${i + 1}/${datasets.length}] Migrating ${tableName}...`);

            const clusterBy = DOM.clusterByInput.value.trim();
            const validate = DOM.chkValidate.checked;

            const payload = {
                source_path: fullSourcePath,
                target_path: fullTargetPath,
                strategy: strat,
                cluster_by: clusterBy,
                validate: validate
            };

            try {
                const mRes = await fetch('/api/migrate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const mData = await mRes.json();

                if (mData.success && mData.job_id) {
                    const ok = await pollJob(mData.job_id, isPySpark);
                    if (ok) successCount++;
                } else {
                    logMsg(`Failed to start job for ${tableName}: ${mData.error}`, "var(--danger)");
                }
            } catch (err) {
                logMsg(`Error migrating ${tableName}`, "var(--danger)");
            }
        }

        logMsg(`--- Bulk Migration Complete! Migrated ${successCount}/${datasets.length} tables. ---`, "var(--primary)");
        showToast("Bulk Migration Finished!");

    } catch (e) {
        console.error("Bulk Migration Error", e);
        logMsg("A fatal error occurred during bulk migration.", "var(--danger)");
    }

    DOM.btnMigrate.disabled = false;
    DOM.btnMigrate.textContent = 'Start Migration';
}

async function startMigration() {
    let finalSource = '';
    const strat = DOM.migrationStrategy.value;
    const isPySpark = (strat === "IN_PLACE" || strat === "SNAPSHOT");

    if (DOM.chkManualMode.checked) {
        finalSource = DOM.manualSourceInput.value.trim();
        if (!finalSource) {
            logMsg("Error: Please provide a manual source URI.", "var(--danger)");
            showToast("Missing manual source URI", true);
            return;
        }
    } else {
        if (!selectedSourcePath) {
            logMsg("Error: Please select a source dataset first.", "var(--danger)");
            showToast("Missing source dataset", true);
            return;
        }
        finalSource = selectedSourcePath.join('.');
    }

    const targetPath = DOM.targetPathInput.value.trim();
    if (!targetPath) {
        showToast("Please enter a Target Path.", true);
        return;
    }

    if (DOM.chkBulkMigrate.checked) {
        await startBulkMigration(strat, targetPath, isPySpark);
        return;
    }

    if (!finalSource) {
        showToast("Please select a source dataset from the tree.", true);
        return;
    }

    DOM.btnMigrate.disabled = true;
    DOM.btnMigrate.innerHTML = '<div class="loader"></div> Migrating...';

    logMsg(`Starting migration (${strat}): ${finalSource} -> ${targetPath}`);

    const clusterBy = DOM.clusterByInput.value.trim();
    const validate = DOM.chkValidate.checked;

    const payload = {
        source_path: finalSource,
        target_path: targetPath,
        strategy: strat,
        cluster_by: clusterBy,
        validate: validate
    };

    try {
        const res = await fetch('/api/migrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success && data.job_id) {
            logMsg(`Migration job submitted. ID: ${data.job_id}`);
            const success = await pollJob(data.job_id, isPySpark);
            if (success) {
                logMsg(`Migration COMPLETED successfully!`, "var(--primary)");
                showToast("Migration completed successfully!");
            }
        } else {
            logMsg(`Migration failed to start: ${data.error}`, "var(--danger)");
            showToast("Migration failed.", true);
        }
    } catch (e) {
        logMsg(`Error: ${e.message}`, "var(--danger)");
    } finally {
        DOM.btnMigrate.disabled = false;
        DOM.btnMigrate.textContent = 'Start Migration';
    }
}

// --- History ---
async function loadHistory() {
    try {
        const res = await fetch('/api/history');
        const data = await res.json();

        DOM.historyTableBody.innerHTML = '';
        if (data.success && data.data) {
            data.data.forEach(row => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = "1px solid var(--border)";

                let statusColor = "var(--text-muted)";
                if (row.status === "COMPLETED") statusColor = "var(--success)";
                if (row.status === "FAILED" || row.status === "VALIDATION_FAILED") statusColor = "var(--danger)";
                if (row.status === "RUNNING") statusColor = "var(--primary)";

                let matchIcon = '-';
                if (row.row_count !== null && row.source_row_count !== null) {
                    if (row.row_count === row.source_row_count) {
                        matchIcon = '<span style="color: var(--success); font-weight: bold;">✅ Match</span>';
                    } else {
                        matchIcon = '<span style="color: var(--danger); font-weight: bold;">❌ Mismatch</span>';
                    }
                } else if (row.strategy !== 'CTAS' && row.status === 'COMPLETED') {
                    matchIcon = '<span style="color: var(--success); font-weight: bold;">✅ (Zero-Copy)</span>';
                }

                tr.innerHTML = `
                    <td style="padding: 0.5rem; font-size: 0.85rem;">${new Date(row.started_at + 'Z').toLocaleString()}</td>
                    <td style="padding: 0.5rem; word-break: break-all;">${row.source_path}</td>
                    <td style="padding: 0.5rem; word-break: break-all;">${row.target_path}</td>
                    <td style="padding: 0.5rem;">${row.strategy}</td>
                    <td style="padding: 0.5rem; color: ${statusColor}; font-weight: bold;">${row.status}</td>
                    <td style="padding: 0.5rem;">${row.source_row_count !== null ? row.source_row_count.toLocaleString() : 'N/A'}</td>
                    <td style="padding: 0.5rem;">${row.row_count !== null ? row.row_count.toLocaleString() : '-'}</td>
                    <td style="padding: 0.5rem;">${matchIcon}</td>
                `;
                DOM.historyTableBody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error("Failed to load history", e);
    }
}

DOM.btnOpenHistory.addEventListener('click', () => {
    loadHistory();
    DOM.historyModal.classList.remove('hidden');
});

DOM.btnCloseHistoryModal.addEventListener('click', () => {
    DOM.historyModal.classList.add('hidden');
});

DOM.historyModal.addEventListener('click', (e) => {
    if (e.target === DOM.historyModal) {
        DOM.historyModal.classList.add('hidden');
    }
});

// --- Diagnostics ---
async function runDiagnostics() {
    DOM.btnRunDiagnostics.disabled = true;
    DOM.btnRunDiagnostics.innerHTML = '<div class="loader"></div> Running...';
    DOM.diagnosticsResults.innerHTML = '';

    try {
        const res = await fetch('/api/diagnostics');
        const data = await res.json();

        if (data.success && data.data) {
            data.data.forEach(check => {
                const div = document.createElement('div');
                div.style.padding = "1rem";
                div.style.borderRadius = "8px";
                div.style.border = "1px solid var(--border)";
                div.style.background = "rgba(0,0,0,0.2)";

                let statusIcon = "❓";
                let statusColor = "var(--text-muted)";

                if (check.status === "PASS") {
                    statusIcon = "✅";
                    statusColor = "var(--success)";
                } else if (check.status === "FAIL") {
                    statusIcon = "❌";
                    statusColor = "var(--danger)";
                } else if (check.status === "WARNING") {
                    statusIcon = "⚠️";
                    statusColor = "#eab308"; // yellow
                }

                div.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <strong style="font-size: 1.1rem;">${check.name}</strong>
                        <span style="color: ${statusColor}; font-weight: bold; font-size: 1.2rem;">${statusIcon} ${check.status}</span>
                    </div>
                    <div style="color: var(--text-muted); font-size: 0.9rem;">${check.message}</div>
                `;
                DOM.diagnosticsResults.appendChild(div);
            });
        } else {
            showToast("Diagnostics failed.", true);
        }
    } catch (e) {
        showToast("Error running diagnostics.", true);
        console.error(e);
    } finally {
        DOM.btnRunDiagnostics.disabled = false;
        DOM.btnRunDiagnostics.textContent = 'Run System Checks';
    }
}

DOM.btnOpenDiagnostics.addEventListener('click', () => {
    DOM.diagnosticsResults.innerHTML = ''; // clear old results
    DOM.diagnosticsModal.classList.remove('hidden');
});

DOM.btnCloseDiagnosticsModal.addEventListener('click', () => {
    DOM.diagnosticsModal.classList.add('hidden');
});

DOM.diagnosticsModal.addEventListener('click', (e) => {
    if (e.target === DOM.diagnosticsModal) {
        DOM.diagnosticsModal.classList.add('hidden');
    }
});

DOM.btnRunDiagnostics.addEventListener('click', runDiagnostics);

// --- Event Listeners ---
DOM.btnOpenSettings.addEventListener('click', () => {
    DOM.settingsModal.classList.remove('hidden');
});
DOM.btnSaveSettings.addEventListener('click', saveSettings);
DOM.btnTestConn.addEventListener('click', testConnection);
DOM.btnMigrate.addEventListener('click', startMigration);
DOM.btnShutdown.addEventListener('click', async () => {
    if (confirm("Are you sure you want to shut down the Migrator?")) {
        try {
            await fetch('/api/shutdown', { method: 'POST' });
        } catch(e) {}
        document.body.innerHTML = '<div style="display: flex; height: 100vh; align-items: center; justify-content: center; font-size: 2rem; color: var(--text-muted);">The Migrator has been shut down. You can safely close this tab.</div>';
    }
});

DOM.chkManualMode.addEventListener('change', (e) => {
    if (e.target.checked) {
        DOM.dremioSourceGroup.style.display = 'none';
        DOM.manualSourceGroup.style.display = 'block';
        DOM.bulkMigrateGroup.style.display = 'none';
        DOM.chkBulkMigrate.checked = false;
        DOM.sourceDescription.textContent = "Provide the exact Spark SQL Catalog path or Physical URI to migrate.";
    } else {
        DOM.dremioSourceGroup.style.display = 'block';
        DOM.manualSourceGroup.style.display = 'none';
        DOM.bulkMigrateGroup.style.display = 'flex';
        DOM.sourceDescription.textContent = "Select a Source. The Migrator will automatically resolve S3 URIs for PySpark migrations.";
    }
});

// Close Modal Logic
DOM.btnCloseModal = document.getElementById('btnCloseModal');
DOM.btnCloseModal.addEventListener('click', () => {
    DOM.settingsModal.classList.add('hidden');
});
DOM.settingsModal.addEventListener('click', (e) => {
    if (e.target === DOM.settingsModal) {
        DOM.settingsModal.classList.add('hidden');
    }
});

// Init
loadSettings();
loadNamespaceRoot();
