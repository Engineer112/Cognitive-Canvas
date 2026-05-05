export function setupSync() {
        /* ====================================================================
           9. CLOUD OPERATIONS & DASHBOARD
        ==================================================================== */
        window.saveToCloud = async function(event) {
            window.triggerTutAction('use_projects');
            if (!window.db) return window.showToast("Database offline: Firebase config missing or invalid.");
            if (!window.currentUser) return window.showToast("Auth offline: Please log in, or enable Anonymous Sign-in in Firebase Console.");
            
            window.saveCurrentTabState();

            const btn = (event && event.currentTarget) ? event.currentTarget : document.getElementById('save-btn');
            const span = btn ? btn.querySelector('span') : null;
            const origText = span ? span.innerText : btn.innerText; 
            if (span) span.innerText = "⏳..."; else btn.innerText = "⏳...";
            
            const pName = document.getElementById('project-name').value || "Untitled Draft";
            
            if (!window.currentProjectId) {
                window.currentProjectId = 'proj_' + Date.now();
                const tab = window.tabs.find(t => t.id === window.activeTabId);
                if (tab) tab.currentProjectId = window.currentProjectId;
            }

            const nodeData = [];
            window.nodeSequence.forEach(id => {
                const n = window.nodesMap.get(id);
                if (n) {
                    const titleInput = n.querySelector('.node-title-input');
                    const ed = n.querySelector('.editor');
                    const isImage = n.classList.contains('image-node');
                    const imgEl = n.querySelector('.node-image');
                    nodeData.push({ 
                        id: id, 
                        type: isImage ? 'image' : 'text',
                        src: isImage && imgEl ? imgEl.src : null,
                        title: titleInput ? titleInput.value : '',
                        text: ed && window.getEditorText ? window.getEditorText(ed) : '', 
                        x: parseFloat(n.style.left), 
                        y: parseFloat(n.style.top),
                        width: n.style.width || n.offsetWidth + 'px',
                        color: n.getAttribute('data-color') || 'default'
                    });
                }
            });

            try {
                const docRef = window.firebaseDoc(window.db, 'artifacts', window.appId, 'users', window.currentUser.uid, 'projects', window.currentProjectId);
                await window.firebaseSetDoc(docRef, { name: pName, nodes: nodeData, sequence: window.nodeSequence, edges: window.edges, updated: new Date().toISOString(), panX: window.panX, panY: window.panY, scale: window.scale });
                window.playSound('create'); 
                
                if (span) span.innerText = "✅ Saved"; else btn.innerText = "✅ Saved";
                setTimeout(() => { if (span) span.innerText = origText; else btn.innerText = origText; }, 2000);
            } catch (e) { 
                console.error("Save error:", e); 
                window.showToast(e.code === 'permission-denied' ? "Setup Required: Update your Firestore Security Rules to allow writes." : "Failed to save: " + e.message); 
                if (span) span.innerText = "❌ Error"; else btn.innerText = "❌ Error";
                setTimeout(() => { if (span) span.innerText = origText; else btn.innerText = origText; }, 2000);
            }
        }

        window.openDashboard = async function() {
            window.triggerTutAction('use_projects');
            if (!window.db) return window.showToast("Database offline: Firebase config missing or invalid.");
            if (!window.currentUser) return window.showToast("Auth offline: Please log in, or enable Anonymous Sign-in in Firebase Console.");
            
            document.getElementById('dashboard-modal').style.display = 'flex';
            const list = document.getElementById('project-list');
            list.innerHTML = "<p>Loading projects...</p>";

            try {
                const colRef = window.firebaseCollection(window.db, 'artifacts', window.appId, 'users', window.currentUser.uid, 'projects');
                const snap = await window.firebaseGetDocs(colRef);
                if (snap.empty) { list.innerHTML = "<p style='color:var(--text-muted)'>No saved projects found.</p>"; return; }
                
                list.innerHTML = '';
                snap.forEach(docSnap => {
                    const data = docSnap.data();
                    const div = document.createElement('div'); div.className = 'project-item';
                    div.setAttribute('role', 'listitem');
                    const date = new Date(data.updated).toLocaleDateString();
                    const numThoughts = data.nodes ? data.nodes.length : 0;
                    div.innerHTML = `
                        <div class="project-info">
                            <h3>${data.name || 'Untitled'}</h3>
                            <p>Last edited: ${date} • ${numThoughts} thoughts</p>
                        </div>
                        <div class="project-actions">
                            <button class="btn btn-secondary load-btn" aria-label="Load project ${data.name || 'Untitled'}">Load</button>
                            <button class="btn btn-danger del-proj-btn" aria-label="Delete project ${data.name || 'Untitled'}">Delete</button>
                        </div>
                    `;
                    div.querySelector('.load-btn').onclick = () => window.loadProject(docSnap.id, data);
                    const delBtn = div.querySelector('.del-proj-btn');
                    delBtn.onclick = () => window.deleteProject(docSnap.id, delBtn, div);
                    list.appendChild(div);
                });
            } catch(e) { 
                console.error("Dashboard error:", e); 
                list.innerHTML = e.code === 'permission-denied' ? `<p style="color: var(--error-border);">Setup Required: Update your Firestore Security Rules to allow reads.</p>` : `<p>Error loading projects: ${e.message}</p>`; 
            }
        }

        window.loadProject = function(pid, data) {
            // Check if already open
            const existingTab = window.tabs.find(t => t.currentProjectId === pid);
            if (existingTab) {
                window.switchTab(existingTab.id);
                document.getElementById('dashboard-modal').style.display = 'none';
                return;
            }

            window.saveCurrentTabState();
            
            const newTab = {
                id: 'tab_' + Date.now(),
                currentProjectId: pid,
                name: data.name || "Untitled",
                nodesMap: new Map(),
                nodeSequence: [],
                panX: data.panX !== undefined ? data.panX : 0,
                panY: data.panY !== undefined ? data.panY : 0,
                scale: data.scale !== undefined ? data.scale : 1,
                historyStack: [],
                historyIndex: -1
            };
            window.tabs.push(newTab);
            window.switchTab(newTab.id);
            
            if (data.sequence) {
                data.sequence.forEach(id => {
                    const nData = data.nodes.find(n => n.id === id);
                    if (nData) window.createNode(nData.x, nData.y, nData.text, nData.id, nData.color, false, nData.width, nData.title, nData.type || 'text', nData.src);
                });
            } else if (data.nodes) {
                data.nodes.forEach(nData => window.createNode(nData.x, nData.y, nData.text, nData.id, nData.color, false, nData.width, nData.title, nData.type || 'text', nData.src));
            }
            window.edges = data.edges ? JSON.parse(JSON.stringify(data.edges)) : [];
            window.updateGraph();
            
            document.getElementById('dashboard-modal').style.display = 'none';
            window.playSound('drop');
            
            window.historyStack = []; window.historyIndex = -1;
            setTimeout(() => { window.saveState(); window.renderTabBar(); }, 150);
        }

        window.deleteProject = async function(pid, btnElement, rowElement) {
            if (btnElement.innerText !== "Confirm?") {
                btnElement.innerText = "Confirm?";
                btnElement.style.background = "#FF6B6B";
                btnElement.style.color = "white";
                setTimeout(() => {
                    if (btnElement.innerText === "Confirm?") {
                        btnElement.innerText = "Delete";
                        btnElement.style.background = "";
                        btnElement.style.color = "";
                    }
                }, 3000);
                return;
            }
            try {
                rowElement.style.opacity = 0.5;
                await window.firebaseDeleteDoc(window.firebaseDoc(window.db, 'artifacts', window.appId, 'users', window.currentUser.uid, 'projects', pid));
                rowElement.remove();
                
                // Optional: If deleted project was currently open in a tab, you could close it.
                // Keeping it open as an unsaved draft is safer UX.
            } catch(e) { 
                console.error(e); 
                window.showToast("Failed to delete project."); 
                rowElement.style.opacity = 1; 
                btnElement.innerText = "Delete";
            }
        }


}