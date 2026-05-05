
        import { state } from "./state.js";
        import { setupFirebase } from "./firebase/config.js";
        import { setupAuth } from "./firebase/auth.js";
        import { setupSync } from "./firebase/sync.js";
        import "./export.js";
        import { setupCanvas } from "./canvas.js";

        // Global initialization
        document.addEventListener("DOMContentLoaded", () => {
            const toolbar = document.getElementById('main-toolbar');
            const savedDock = localStorage.getItem('cognitive_toolbar_dock') || 'dock-top';
            toolbar.classList.add(savedDock);
            
            // Toolbar Dragging Logic
            const dragHandle = document.getElementById('toolbar-drag-handle');
            let isDraggingToolbar = false;
            let currentHoveredZone = null;
            
            dragHandle.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                isDraggingToolbar = true;
                
                // Lock shape into the floating pill immediately
                toolbar.style.transition = 'none'; 
                toolbar.classList.remove('dock-top', 'dock-bottom', 'dock-left', 'dock-right');
                toolbar.classList.add('is-dragging');
                document.body.classList.add('show-dock-zones');
                
                // Snap directly under the mouse perfectly to the handle
                requestAnimationFrame(() => {
                    toolbar.style.left = `${e.clientX - 20}px`;
                    toolbar.style.top = `${e.clientY - 24}px`;
                    toolbar.style.transform = 'none';
                });
                
                dragHandle.setPointerCapture(e.pointerId);
                window.playSound('create'); 
            });

            document.addEventListener('pointermove', (e) => {
                if (isDraggingToolbar) {
                    // Update pill position
                    toolbar.style.left = `${e.clientX - 20}px`;
                    toolbar.style.top = `${e.clientY - 24}px`;
                    
                    const w = window.innerWidth;
                    const h = window.innerHeight;
                    const thresholdX = 120;
                    const thresholdY = 120;
                    
                    // Reset Active Zones
                    document.querySelectorAll('.dock-zone').forEach(z => z.classList.remove('active'));
                    currentHoveredZone = null;
                    
                    // Check intersections to trigger the docking UI elements visually
                    if (e.clientY < thresholdY) {
                        currentHoveredZone = 'dock-top';
                        document.querySelector('.dock-zone.top').classList.add('active');
                    } else if (e.clientY > h - thresholdY) {
                        currentHoveredZone = 'dock-bottom';
                        document.querySelector('.dock-zone.bottom').classList.add('active');
                    } else if (e.clientX < thresholdX) {
                        currentHoveredZone = 'dock-left';
                        document.querySelector('.dock-zone.left').classList.add('active');
                    } else if (e.clientX > w - thresholdX) {
                        currentHoveredZone = 'dock-right';
                        document.querySelector('.dock-zone.right').classList.add('active');
                    }
                }
            });

            document.addEventListener('pointerup', (e) => {
                if (isDraggingToolbar) {
                    isDraggingToolbar = false;
                    document.body.classList.remove('show-dock-zones');
                    document.querySelectorAll('.dock-zone').forEach(z => z.classList.remove('active'));
                    dragHandle.releasePointerCapture(e.pointerId);
                    
                    // Re-enable morphing transitions and clear dragging state
                    toolbar.style.transition = '';
                    toolbar.style.left = '';
                    toolbar.style.top = '';
                    toolbar.style.transform = '';
                    toolbar.classList.remove('is-dragging');
                    
                    // Apply newly selected dock shape, or fallback to the last saved configuration
                    let newDock = currentHoveredZone || localStorage.getItem('cognitive_toolbar_dock') || 'dock-top';
                    toolbar.classList.add(newDock);
                    localStorage.setItem('cognitive_toolbar_dock', newDock);
                    
                    window.playSound('drop');
                    currentHoveredZone = null;
                }
            });
        });

        /* ====================================================================
           1. CLOUD SETTINGS & FIREBASE INIT
        ==================================================================== */





        window.showToast = function(msg, isError = true) {
            const toast = document.getElementById('toast-notification');
            toast.innerText = msg;
            toast.style.background = isError ? 'var(--error-border)' : 'var(--grammar-border)';
            toast.style.top = '20px';
            setTimeout(() => { toast.style.top = '-100px'; }, 4000);
        }

        setupFirebase();
        setupAuth();
        setupSync();
        setupCanvas();

        /* ====================================================================
           2. MULTI-TAB ARCHITECTURE & STATE MANAGEMENT
        ==================================================================== */
        
        

        // Current Active Canvas State
         
        
        
        
        
         
        
        

        // Selection System
        let selectedNodes = new Set();
        window.selectedNodes = selectedNodes;
        let initialPositions = new Map();
        let isMarqueeSelecting = false;
        let marqueeStartX = 0, marqueeStartY = 0;
        let baseSelection = new Set();

        
        window.renderPathUI = function() {
            const sel = document.getElementById('path-selector');
            if (!sel) return;
            sel.innerHTML = '';
            window.storyPaths.forEach((p, idx) => {
                let opt = document.createElement('option');
                opt.value = p.id;
                opt.innerText = p.name + (p.id === window.compiledPathId ? ' (Compile)' : '');
                if (p.id === window.activeEditPathId) opt.selected = true;
                sel.appendChild(opt);
            });
            const markBtn = document.getElementById('compile-mark-btn');
            if (markBtn) {
                if (window.activeEditPathId === window.compiledPathId) {
                    markBtn.style.color = 'var(--grammar-border)';
                    markBtn.style.opacity = '1';
                    markBtn.innerHTML = '✓ Will Compile';
                } else {
                    markBtn.style.color = 'inherit';
                    markBtn.style.opacity = '0.5';
                    markBtn.innerHTML = 'Set to Compile';
                }
            }
        };

        window.switchPath = function(pathId) {
            if (window.activeEditPathId === pathId) return;
            let activeP = window.storyPaths.find(p => p.id === window.activeEditPathId);
            if (activeP) activeP.sequence = [...window.nodeSequence];
            
            window.activeEditPathId = pathId;
            let nextP = window.storyPaths.find(p => p.id === pathId);
            if (nextP) window.nodeSequence = [...nextP.sequence];
            
            const container = document.getElementById('nodes-container');
            container.replaceChildren(); 
            let attached = new Set();
            window.nodeSequence.forEach(id => {
                const node = window.nodesMap.get(id);
                if (node) { container.appendChild(node); attached.add(id); }
            });
            window.nodesMap.forEach((node, id) => {
                if (!attached.has(id)) {
                    // Nodes not in the active path are somewhat detached visually but still on the canvas floating
                    container.appendChild(node);
                    node.style.opacity = '0.4'; // fade out non-path nodes
                    node.querySelector('.seq-badge').innerText = '-';
                    node.querySelector('.seq-badge').style.background = 'gray';
                } else {
                    node.style.opacity = '1';
                    node.querySelector('.seq-badge').style.background = 'var(--focus-ring)';
                }
            });
            setTimeout(() => {
                window.updateSequenceUI();
                window.updateTethers();
                window.renderPathUI();
                window.clearSelection();
            }, 50); // slight delay to allow dom recalc
        };

        window.updateSequenceUI = function() {
            window.nodeSequence.forEach((nodeId, index) => {
                const node = window.nodesMap.get(nodeId);
                if (node) {
                    const badge = node.querySelector('.seq-badge');
                    if (badge) badge.innerText = (index + 1).toString();
                }
            });
            window.nodesMap.forEach((node, id) => {
                if (!window.nodeSequence.includes(id)) {
                    const badge = node.querySelector('.seq-badge');
                    if (badge) badge.innerText = "-";
                }
            });
        };

        window.forkPath = function() {
            let activeP = window.storyPaths.find(p => p.id === window.activeEditPathId);
            if (activeP) activeP.sequence = [...window.nodeSequence];
            
            let letter = String.fromCharCode(65 + window.storyPaths.length);
            let newPath = {
                id: 'p_' + Date.now(),
                name: 'Path ' + letter,
                sequence: [...window.nodeSequence], edges: JSON.parse(JSON.stringify(window.edges))
            };
            window.storyPaths.push(newPath);
            window.switchPath(newPath.id);
        };

        window.markCompiledPath = function() {
            window.compiledPathId = window.activeEditPathId;
            window.renderPathUI();
            window.updateTethers();
            window.showToast("Set path for compilation!");
            window.saveState();
        };
        
        
        window.addEdge = function(sourceId, targetId) {
            if(window.edges.some(e => e.source === sourceId && e.target === targetId)) return true; // Already exists
            
            // Cycle prevention
            const isReachable = (from, to) => {
                if (from === to) return true;
                let queue = [from], visited = new Set([from]);
                while (queue.length > 0) {
                    let curr = queue.shift();
                    let outs = window.edges.filter(e => e.source === curr);
                    for (let e of outs) {
                        if (e.target === to) return true;
                        if (!visited.has(e.target)) {
                            visited.add(e.target);
                            queue.push(e.target);
                        }
                    }
                }
                return false;
            };
            
            if (isReachable(targetId, sourceId)) {
                window.showToast && window.showToast("Cannot create cyclical connection.");
                return false;
            }

            const outbound = window.edges.filter(e => e.source === sourceId).length;
            let compileFlag = (outbound === 0);
            
            if (window.nodeSequence && window.nodeSequence.length > 0) {
                if (!window.nodeSequence.includes(sourceId) || !window.nodeSequence.includes(targetId)) {
                    compileFlag = false;
                }
            }
            
            window.edges.push({ id: 'edge_' + Date.now() + Math.floor(Math.random()*1000), source: sourceId, target: targetId, compile: compileFlag });
            return true;
        };
        
        window.toggleEdgeCompile = function(edgeId) {
            const edge = window.edges.find(e => e.id === edgeId);
            if(edge) {
                if (!edge.compile) {
                    // Backup states
                    const backups = window.edges.map(e => ({ id: e.id, compile: e.compile }));
                    
                    // Turn off any other compiled edges from the same source
                    window.edges.forEach(e2 => {
                        if (e2.source === edge.source && e2.id !== edgeId) e2.compile = false;
                    });
                    edge.compile = true;
                    
                    // Check if this results in multiple disjoint roots
                    let compiledEdges = window.edges.filter(e => e.compile);
                    let inDegree = new Map();
                    compiledEdges.forEach(e => {
                        if(!inDegree.has(e.source)) inDegree.set(e.source, 0);
                        if(!inDegree.has(e.target)) inDegree.set(e.target, 0);
                    });
                    compiledEdges.forEach(e => {
                        inDegree.set(e.target, inDegree.get(e.target) + 1);
                    });
                    let roots = 0;
                    inDegree.forEach(val => { if(val === 0) roots++; });
                    
                    if (roots > 1) {
                        // Revert and reject
                        window.edges.forEach(e => {
                            let b = backups.find(x => x.id === e.id);
                            if (b) e.compile = b.compile;
                        });
                        window.showToast && window.showToast("Cannot include tether. It must be connected to the main active path.");
                        return;
                    }
                } else {
                    edge.compile = false;
                }
                
                window.updateGraph && window.updateGraph();
                window.updateTethers && window.updateTethers();
                window.saveState && window.saveState();
            }
        };
        
        window.deleteEdge = function(edgeId) {
            window.edges = window.edges.filter(e => e.id !== edgeId);
            window.updateGraph();
            window.saveState();
        };

        window.updateGraph = function() {
            // Find true roots (nodes with 0 incoming edges across ANY tether)
            let inDegreeAll = new Map();
            window.nodesMap.forEach((node, id) => inDegreeAll.set(id, 0));
            window.edges.forEach(e => {
                inDegreeAll.set(e.target, (inDegreeAll.get(e.target) || 0) + 1);
            });
            
            let roots = Array.from(window.nodesMap.keys()).filter(id => inDegreeAll.get(id) === 0);
            
            if (roots.length === 0 && window.nodesMap.size > 0) {
                // cycle fallback
                roots = Array.from(window.nodesMap.keys());
            }

            // sort top to bottom, left to right
            roots.sort((a,b) => {
                let na = window.nodesMap.get(a), nb = window.nodesMap.get(b);
                if(!na || !nb) return 0;
                return parseFloat(na.style.top) - parseFloat(nb.style.top) || parseFloat(na.style.left) - parseFloat(nb.style.left);
            });
            
            if (roots.length > 0 && inDegreeAll.get(roots[0]) > 0) {
                roots = [roots[0]]; // Only take the top-left most as the root if everything is in a cycle
            }

            // Traverse follow compile edges
            let seq = [];
            let visited = new Set();
            let queue = [...roots];
            while(queue.length > 0) {
                let curr = queue.shift();
                if(visited.has(curr)) continue;
                visited.add(curr);
                seq.push(curr);
                
                let outs = window.edges.filter(e => e.source === curr && e.compile);
                // maintain top->bottom logic for ties
                outs.sort((ea, eb) => {
                    let na = window.nodesMap.get(ea.target), nb = window.nodesMap.get(eb.target);
                    if(!na || !nb) return 0;
                    return parseFloat(na.style.top) - parseFloat(nb.style.top) || parseFloat(na.style.left) - parseFloat(nb.style.left);
                });
                
                outs.forEach(e => queue.push(e.target));
            }
            
            // Nodes not in 'seq' are explicitly excluded from compilation.
            window.nodeSequence = seq;
            window.updateSequenceUI();
            window.updateTethers();
        };
        
        window.clearSelection = function() {
            selectedNodes.forEach(id => {
                const n = window.nodesMap.get(id);
                if (n) n.classList.remove('selected');
            });
            selectedNodes.clear();
        };

        window.startMarqueeSelection = function(e) {
            window.isMarqueeSelecting = true;
            const workspaceRect = document.getElementById('workspace').getBoundingClientRect();
            window.marqueeStartX = e.clientX - workspaceRect.left;
            window.marqueeStartY = e.clientY - workspaceRect.top;
            
            // if shift is held, we append to existing selection
            if (e.shiftKey) {
                baseSelection = new Set(selectedNodes);
            } else {
                baseSelection.clear();
                window.clearSelection();
            }

            const marquee = document.getElementById('marquee');
            if (marquee) {
                marquee.style.display = 'block';
                marquee.style.left = window.marqueeStartX + 'px';
                marquee.style.top = window.marqueeStartY + 'px';
                marquee.style.width = '0px';
                marquee.style.height = '0px';
            }
        };

        window.updateMarqueeSelection = function(e) {
            if (!window.isMarqueeSelecting) return;
            const marquee = document.getElementById('marquee');
            if (!marquee) return;
            
            const workspaceRect = document.getElementById('workspace').getBoundingClientRect();

            const currentX = e.clientX - workspaceRect.left;
            const currentY = e.clientY - workspaceRect.top;

            const x = Math.min(window.marqueeStartX, currentX);
            const y = Math.min(window.marqueeStartY, currentY);
            const width = Math.abs(currentX - window.marqueeStartX);
            const height = Math.abs(currentY - window.marqueeStartY);

            marquee.style.left = x + 'px';
            marquee.style.top = y + 'px';
            marquee.style.width = width + 'px';
            marquee.style.height = height + 'px';

            const marqueeRect = marquee.getBoundingClientRect();

            window.nodesMap.forEach((node, id) => {
                const nodeRect = node.getBoundingClientRect();
                const overlap = !(nodeRect.right < marqueeRect.left || 
                                  nodeRect.left > marqueeRect.right || 
                                  nodeRect.bottom < marqueeRect.top || 
                                  nodeRect.top > marqueeRect.bottom);
                
                if (overlap || baseSelection.has(id)) {
                    if (!selectedNodes.has(id)) {
                        selectedNodes.add(id);
                        node.classList.add('selected');
                    }
                } else {
                    if (selectedNodes.has(id)) {
                        selectedNodes.delete(id);
                        node.classList.remove('selected');
                    }
                }
            });
        };

        window.endMarqueeSelection = function() {
            window.isMarqueeSelecting = false;
            const marquee = document.getElementById('marquee');
            if (marquee) {
                marquee.style.display = 'none';
            }
        };

        window.selectNode = function(id, toggle = false) {
            const n = window.nodesMap.get(id);
            if (!n) return;
            if (toggle && selectedNodes.has(id)) {
                selectedNodes.delete(id);
                n.classList.remove('selected');
            } else {
                selectedNodes.add(id);
                n.classList.add('selected');
            }
        };

        window.saveCurrentTabState = function() {
            if (!window.activeTabId) return;
            const tab = window.tabs.find(t => t.id === window.activeTabId);
            if (tab) {
                           let activeP = window.storyPaths.find(p => p.id === window.activeEditPathId);
            if (activeP) activeP.sequence = [...window.nodeSequence];
            tab.nodesMap = window.nodesMap;
            tab.nodeSequence = window.nodeSequence; tab.edges = window.edges ? JSON.parse(JSON.stringify(window.edges)) : [];
            tab.storyPaths = JSON.parse(JSON.stringify(window.storyPaths));
            tab.activeEditPathId = window.activeEditPathId;
            tab.compiledPathId = window.compiledPathId;
                tab.currentProjectId = currentProjectId;
                tab.panX = window.panX;
                tab.panY = window.panY;
                tab.scale = scale;
                tab.historyStack = window.historyStack;
                tab.historyIndex = window.historyIndex;
                const titleInput = document.getElementById('project-name');
                if (titleInput) tab.name = titleInput.value;
            }
        };

        window.renderTabBar = function() {
            const tabBar = document.getElementById('tab-bar');
            if (!tabBar) return;
            tabBar.innerHTML = '';
            
            window.tabs.forEach(tab => {
                const tabEl = document.createElement('div');
                tabEl.className = `tab ${tab.id === window.activeTabId ? 'active' : ''}`;
                tabEl.setAttribute('role', 'tab');
                tabEl.setAttribute('aria-selected', tab.id === window.activeTabId);
                tabEl.tabIndex = 0;
                tabEl.onclick = () => window.switchTab(tab.id);
                tabEl.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') window.switchTab(tab.id); };
                
                const titleSpan = document.createElement('span');
                titleSpan.innerText = tab.name || 'Untitled Draft';
                titleSpan.style.maxWidth = '120px';
                titleSpan.style.overflow = 'hidden';
                titleSpan.style.textOverflow = 'ellipsis';
                
                const closeBtn = document.createElement('button');
                closeBtn.className = 'tab-close';
                closeBtn.innerHTML = '✕';
                closeBtn.setAttribute('aria-label', `Close ${tab.name}`);
                closeBtn.onclick = (e) => window.closeTab(e, tab.id);
                
                tabEl.appendChild(titleSpan);
                tabEl.appendChild(closeBtn);
                tabBar.appendChild(tabEl);
            });

            const addBtn = document.createElement('button');
            addBtn.className = 'new-tab-btn';
            addBtn.innerHTML = '➕';
            addBtn.setAttribute('aria-label', 'Create New Tab');
            addBtn.onclick = () => { window.addNewTab(); window.triggerTutAction('use_tabs'); };
            tabBar.appendChild(addBtn);
        };

        const projectNameInput = document.getElementById('project-name');
        if (projectNameInput) {
            projectNameInput.addEventListener('input', (e) => {
                window.triggerTutAction('use_tabs');
                if (!window.activeTabId) return;
                const tab = window.tabs.find(t => t.id === window.activeTabId);
                if (tab) {
                    tab.name = e.target.value;
                    window.renderTabBar();
                }
            });
        }

        window.switchTab = function(tabId) {
            if (tabId === window.activeTabId) return;
            window.saveCurrentTabState();
            
            const tab = window.tabs.find(t => t.id === tabId);
            if (!tab) return;
            
            window.clearSelection(); // Clear selection when switching tabs

            // Clean DOM without destroying nodes (window.nodesMap holds references)
            const container = document.getElementById('nodes-container');
            container.replaceChildren(); 

            // Load new tab data into globals
            window.nodesMap = tab.nodesMap;
            window.nodeSequence = tab.nodeSequence ? [...tab.nodeSequence] : []; window.edges = tab.edges ? JSON.parse(JSON.stringify(tab.edges)) : [];
            if (tab.storyPaths) {
                window.storyPaths = JSON.parse(JSON.stringify(tab.storyPaths));
                window.activeEditPathId = tab.activeEditPathId;
                window.compiledPathId = tab.compiledPathId;
            } else {
                window.storyPaths = [{ id: 'p_main', name: 'Path A', sequence: [...window.nodeSequence], edges: JSON.parse(JSON.stringify(window.edges)) }];
                window.activeEditPathId = 'p_main';
                window.compiledPathId = 'p_main';
            }
            window.currentProjectId = tab.currentProjectId;
            window.panX = tab.panX;
            window.panY = tab.panY;
            scale = tab.scale;
            window.historyStack = tab.historyStack;
            window.historyIndex = tab.historyIndex;
            document.getElementById('project-name').value = tab.name;

            // Re-attach active nodes
            window.nodeSequence.forEach(id => {
                const node = window.nodesMap.get(id);
                if (node) container.appendChild(node);
            });
            window.nodesMap.forEach(node => {
                if (!window.nodeSequence.includes(node.id)) container.appendChild(node);
            });

            window.activeTabId = tabId;
            window.updateCanvasTransform();
            
            window.updateSequenceUI();
            window.updateTethers();
            window.renderTabBar();
        };

        window.closeTab = function(e, tabId) {
            e.stopPropagation();
            const tab = window.tabs.find(t => t.id === tabId);
            if (tab) {
                tab.nodesMap.forEach(n => n.remove());
                tab.nodesMap.clear();
            }
            
            window.tabs = window.tabs.filter(t => t.id !== tabId);
            
            if (window.tabs.length === 0) {
                window.startNewProject(true);
            } else if (tabId === window.activeTabId) {
                window.switchTab(window.tabs[window.tabs.length - 1].id);
            } else {
                window.renderTabBar();
            }
        };

        window.addNewTab = function() {
            window.saveCurrentTabState();
            
            const newTab = {
                id: 'tab_' + Date.now(),
                currentProjectId: null,
                name: 'Untitled Draft',
                nodesMap: new Map(),
                nodeSequence: [],
                panX: 0, panY: 0, scale: 1,
                historyStack: [], historyIndex: -1
            };
            window.tabs.push(newTab);
            window.switchTab(newTab.id);
            
            window.resetView();
            window.createNode(window.innerWidth / 2 - 150, window.innerHeight / 2 - 100, `Double-tap the space to add a thought.

To reorder your flow, drag the numbered badge onto any other thought.`);
              
            setTimeout(() => window.saveState(), 150);
        };

        window.startNewProject = function(forceNewTab = false) {
            if (forceNewTab || window.tabs.length === 0) {
                window.addNewTab();
            } else {
                // Overwrite current tab
                window.nodesMap.forEach(n => n.remove());
                window.nodesMap.clear();  
                window.clearSelection();
                document.getElementById('project-name').value = "Untitled Draft";
                window.resetView();
                window.updateTethers();
                window.createNode(window.innerWidth / 2 - 150, window.innerHeight / 2 - 100, `Double-tap the space to add a thought.\n\nTo reorder your flow, drag the numbered badge onto any other thought.`);
                  
                setTimeout(() => { window.saveState(); window.renderTabBar(); }, 150);
            }
            document.getElementById('dashboard-modal').style.display = 'none';
        };

        /* ====================================================================
           3. UNDO/REDO ENGINE (Uses localized active globals)
        ==================================================================== */
        window.saveState = function() {
            if (window.isRestoring) return;
            
            if (window.historyIndex < window.historyStack.length - 1) {
                window.historyStack = window.historyStack.slice(0, window.historyIndex + 1);
            }

            const state = { sequence: [...nodeSequence], edges: JSON.parse(JSON.stringify(window.edges)), nodes: [] };
            window.nodesMap.forEach((n, id) => {
                const titleInput = n.querySelector('.node-title-input');
                const isImage = n.classList.contains('image-node');
                const imgEl = n.querySelector('.node-image');
                state.nodes.push({
                    id: id,
                    type: isImage ? 'image' : 'text',
                    src: isImage && imgEl ? imgEl.src : null,
                    title: titleInput ? titleInput.value : '',
                    text: n.querySelector('.editor').innerHTML, 
                    x: parseFloat(n.style.left),
                    y: parseFloat(n.style.top),
                    width: n.style.width || n.offsetWidth + 'px',
                    align: n.querySelector('.editor').style.textAlign || 'left',
                    color: n.getAttribute('data-color') || 'default'
                });
            });

            window.historyStack.push(state);
            if (window.historyStack.length > 50) window.historyStack.shift(); 
            window.historyIndex = window.historyStack.length - 1;
            window.saveCurrentTabState();
        };

        window.undoAction = function() {
            if (window.historyIndex > 0) {
                window.isRestoring = true;
                window.historyIndex--;
                window.restoreState(window.historyStack[window.historyIndex]);
                
                window.showToast("Undo", false);
            } else {
                window.showToast("Nothing to undo", false);
            }
        };

        window.redoAction = function() {
            if (window.historyIndex < window.historyStack.length - 1) {
                window.isRestoring = true;
                window.historyIndex++;
                window.restoreState(window.historyStack[window.historyIndex]);
                
                window.showToast("Redo", false);
            } else {
                window.showToast("Nothing to redo", false);
            }
        };

        window.restoreState = function(state) {
            window.nodesMap.forEach(n => n.remove());
            window.nodesMap.clear();
            
            window.clearSelection();

            if (state.nodes) {
                state.nodes.forEach(nData => {
                    window.createNode(nData.x, nData.y, nData.text, nData.id, nData.color, true, nData.width, nData.title, nData.type || 'text', nData.src, nData.align);
                });
            }
            if (state.sequence) {
                window.nodeSequence = [...state.sequence]; window.edges = state.edges ? JSON.parse(JSON.stringify(state.edges)) : [];
            }
            if (state.storyPaths) {
                window.storyPaths = JSON.parse(JSON.stringify(state.storyPaths));
                window.activeEditPathId = state.activeEditPathId;
                window.compiledPathId = state.compiledPathId;
            }
            
            window.updateSequenceUI();
            window.updateTethers();
            window.playSound('drop');
        };

        /* ====================================================================
           5. KEYBOARD SHORTCUTS & ACCESSIBILITY
        ==================================================================== */
        const defaultShortcuts = {
            undo: { key: 'z', ctrl: true, alt: false, shift: false, label: 'Undo Action' },
            redo: { key: 'z', ctrl: true, alt: false, shift: true, label: 'Redo Action' },
            newNode: { key: 'n', ctrl: false, alt: true, shift: false, label: 'New Thought Bubble' },
            duplicate: { key: 'd', ctrl: true, alt: false, shift: false, label: 'Duplicate Selected' },
            save: { key: 's', ctrl: true, alt: false, shift: false, label: 'Save Draft' },
            compile: { key: 'enter', ctrl: true, alt: false, shift: false, label: 'Compile Draft' },
            readAloud: { key: 'l', ctrl: true, alt: false, shift: true, label: 'Read Aloud (TTS)' },
            dictate: { key: 'd', ctrl: true, alt: false, shift: true, label: 'Dictate (STT)' },
            deleteNode: { key: 'backspace', ctrl: true, alt: false, shift: true, label: 'Delete Active Thought' },
            projects: { key: 'o', ctrl: true, alt: false, shift: false, label: 'Open Projects' },
            settings: { key: ',', ctrl: true, alt: false, shift: false, label: 'Open Personalization' },
            account: { key: 'a', ctrl: true, alt: false, shift: true, label: 'Open Account' },
            focusMode: { key: 'f', ctrl: true, alt: false, shift: true, label: 'Toggle Focus Mode' },
            autoTidy: { key: 't', ctrl: true, alt: false, shift: true, label: 'Auto-Tidy Canvas' },
            snapshot: { key: 'p', ctrl: true, alt: false, shift: true, label: 'Export Snapshot' },
            color1: { key: '1', ctrl: false, alt: true, shift: false, label: 'Color: Default' },
            color2: { key: '2', ctrl: false, alt: true, shift: false, label: 'Color: Blue' },
            color3: { key: '3', ctrl: false, alt: true, shift: false, label: 'Color: Green' },
            color4: { key: '4', ctrl: false, alt: true, shift: false, label: 'Color: Purple' },
            color5: { key: '5', ctrl: false, alt: true, shift: false, label: 'Color: Yellow' },
            color6: { key: '6', ctrl: false, alt: true, shift: false, label: 'Color: Red' }
        };

        let savedShortcuts = JSON.parse(localStorage.getItem('cognitive_shortcuts')) || {};
        let userShortcuts = { ...JSON.parse(JSON.stringify(defaultShortcuts)), ...savedShortcuts };
        let isRecordingShortcut = null;

        function formatShortcutDisplay(combo) {
            if (!combo) return '';
            let parts = [];
            if (combo.ctrl) parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
            if (combo.alt) parts.push(navigator.platform.includes('Mac') ? '⌥' : 'Alt');
            if (combo.shift) parts.push('Shift');
            
            let k = combo.key;
            if (k === ' ') k = 'Space';
            else if (k.length === 1) k = k.toUpperCase();
            else k = k.charAt(0).toUpperCase() + k.slice(1);
            
            parts.push(k);
            return parts.join(' + ');
        }

        window.renderShortcutsUI = function() {
            const list = document.getElementById('shortcuts-list');
            if (!list) return;
            list.innerHTML = '';
            for (let [action, combo] of Object.entries(userShortcuts)) {
                const item = document.createElement('div');
                item.className = 'shortcut-item';
                item.setAttribute('role', 'listitem');
                
                const label = document.createElement('span');
                label.innerText = combo.label;
                label.style.fontSize = '0.9rem';
                
                const btn = document.createElement('button');
                btn.className = `shortcut-btn ${isRecordingShortcut === action ? 'listening' : ''}`;
                btn.innerText = isRecordingShortcut === action ? 'Listening...' : formatShortcutDisplay(combo);
                btn.setAttribute('aria-label', `Remap shortcut for ${combo.label}`);
                btn.onclick = () => window.startRecordingShortcut(action);
                
                item.appendChild(label);
                item.appendChild(btn);
                list.appendChild(item);
            }
        };

        window.startRecordingShortcut = function(action) {
            isRecordingShortcut = action;
            window.renderShortcutsUI();
        };

        window.resetShortcuts = function() {
            userShortcuts = JSON.parse(JSON.stringify(defaultShortcuts));
            localStorage.removeItem('cognitive_shortcuts');
            isRecordingShortcut = null;
            window.renderShortcutsUI();
        };

        document.addEventListener('keydown', (e) => {
            if (isRecordingShortcut) {
                e.preventDefault();
                if (['control', 'shift', 'alt', 'meta', 'os'].includes((e.key || '').toLowerCase())) return; 
                
                userShortcuts[isRecordingShortcut].key = (e.key || '').toLowerCase();
                userShortcuts[isRecordingShortcut].ctrl = e.ctrlKey || e.metaKey;
                userShortcuts[isRecordingShortcut].alt = e.altKey;
                userShortcuts[isRecordingShortcut].shift = e.shiftKey;
                
                localStorage.setItem('cognitive_shortcuts', JSON.stringify(userShortcuts));
                isRecordingShortcut = null;
                window.renderShortcutsUI();
                return;
            }

            const isInput = e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
            
            // Handle Global Deletion
            if (!isInput && (e.key === 'Backspace' || e.key === 'Delete')) {
                e.preventDefault();
                if (selectedNodes.size > 0) {
                    selectedNodes.forEach(id => {
                        window.deleteNode && window.deleteNode(id, false);
                    });
                    window.clearSelection();
                    window.updateGraph && window.updateGraph();
                    window.playSound && window.playSound('drop');
                    window.saveState && window.saveState();
                    window.showToast && window.showToast("Deleted selection.");
                }
                return;
            }

            let pressedCombo = {
                key: (e.key || '').toLowerCase(),
                ctrl: e.ctrlKey || e.metaKey,
                alt: e.altKey,
                shift: e.shiftKey
            };

            for (let [action, combo] of Object.entries(userShortcuts)) {
                if (combo.key === pressedCombo.key && combo.ctrl === pressedCombo.ctrl && combo.alt === pressedCombo.alt && combo.shift === pressedCombo.shift) {
                    
                     
                    if (isInput && !combo.ctrl && !combo.alt) continue; 
                    
                    e.preventDefault();
                    switch(action) {
                        case 'undo': window.undoAction(); break;
                        case 'redo': window.redoAction(); break;
                        case 'save': window.saveToCloud(); break;
                        case 'compile': window.compileStory(); break;
                        case 'account': window.openAccountModal(); break;
                        case 'focusMode': window.toggleFocusMode(); break;
                        case 'autoTidy': window.autoTidy(); break;
                        case 'snapshot': window.takeSnapshot(); break;
                        case 'duplicate': {
                            if (selectedNodes.size === 0) return;
                            const newSelected = new Set();
                            selectedNodes.forEach(id => {
                                const n = window.nodesMap.get(id);
                                if (n) {
                                    const nx = parseFloat(n.style.left) + 40;
                                    const ny = parseFloat(n.style.top) + 40;
                                    const title = n.querySelector('.node-title-input').value;
                                    const text = n.querySelector('.editor').innerHTML;
                                    const color = n.getAttribute('data-color') || 'default';
                                    const width = n.style.width || n.offsetWidth + 'px';
                                    const isImage = n.classList.contains('image-node');
                                    const imgEl = n.querySelector('.node-image');
                                    
                                    const newId = 'node_' + Date.now() + Math.floor(Math.random() * 1000);
                                    window.createNode(nx, ny, text, newId, color, true, width, title, isImage ? 'image' : 'text', isImage && imgEl ? imgEl.src : null);
                                    newSelected.add(newId);
                                }
                            });
                            window.clearSelection();
                            newSelected.forEach(id => window.selectNode(id));
                            window.saveState();
                            window.showToast(`Duplicated ${newSelected.size} node(s)`);
                            break;
                        }
                        case 'readAloud': 
                            if (document.getElementById('compile-modal').style.display !== 'flex') window.compileStory();
                            setTimeout(() => window.readAloud(), 100);
                            break;
                        case 'dictate': {
                            const actEd = document.activeElement;
                            if (actEd && actEd.classList.contains('editor')) {
                                const n = actEd.closest('.node');
                                if (n) {
                                    const mic = n.querySelector('.mic-btn');
                                    if (mic) window.toggleDictation(mic, actEd);
                                }
                            } else { window.showToast("Focus inside a thought bubble to dictate."); }
                            break;
                        }
                        case 'newNode': 
                            const cx = (window.innerWidth / 2 - window.panX) / scale - 150;
                            const cy = (window.innerHeight / 2 - window.panY) / scale - 20;
                            window.createNode(cx, cy); 
                            window.saveState();
                            break;
                        case 'projects': window.openDashboard(); break;
                        case 'settings': 
                            document.getElementById('settings-modal').style.display = 'flex'; 
                            window.renderShortcutsUI();
                            window.triggerTutAction('open_settings');
                            break;
                        case 'color1': window.applyColorToActiveNode('default'); break;
                        case 'color2': window.applyColorToActiveNode('blue'); break;
                        case 'color3': window.applyColorToActiveNode('green'); break;
                        case 'color4': window.applyColorToActiveNode('purple'); break;
                        case 'color5': window.applyColorToActiveNode('yellow'); break;
                        case 'color6': window.applyColorToActiveNode('red'); break;
                    }
                    return;
                }
            }
        });

        window.applyColorToActiveNode = function(color) {
            if (selectedNodes.size > 0) {
                selectedNodes.forEach(id => {
                    const n = window.nodesMap.get(id);
                    if (n) {
                        if (color === 'default') {
                            n.removeAttribute('data-color');
                        } else {
                            n.setAttribute('data-color', color);
                        }
                    }
                });
                window.playSound('drop');
                window.saveState();
            } else {
                window.showToast("Select a thought bubble to change its color.");
            }
        };

        let audioCtx;
        window.playSound = function(type) {
            if (!document.getElementById('set-sound').checked) return;
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);

            if (type === 'create') {
                osc.type = 'sine'; osc.frequency.setValueAtTime(300, audioCtx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(500, audioCtx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
                osc.start(); osc.stop(audioCtx.currentTime + 0.1);
            } else if (type === 'drop') {
                osc.type = 'triangle'; osc.frequency.setValueAtTime(200, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
                osc.start(); osc.stop(audioCtx.currentTime + 0.08);
            }
        }

        window.applySettings = function() {
            const theme = document.getElementById('set-theme').value;
            document.body.className = `theme-${theme}`;
            const root = document.documentElement;
            root.style.setProperty('--font-family', document.getElementById('set-font').value);
            
            const spacing = document.getElementById('set-spacing').value;
            if (spacing === 'normal') { root.style.setProperty('--line-height', '1.6'); root.style.setProperty('--letter-spacing', '0.02em'); }
            else if (spacing === 'relaxed') { root.style.setProperty('--line-height', '1.8'); root.style.setProperty('--letter-spacing', '0.06em'); }
            else { root.style.setProperty('--line-height', '2.2'); root.style.setProperty('--letter-spacing', '0.1em'); }

            const shape = document.getElementById('set-shape').value;
            root.style.setProperty('--node-radius', shape === 'round' ? '16px' : '0px');

            const size = document.getElementById('set-size').value;
            if (size === 'small') root.style.setProperty('--editor-font-size', '1rem');
            else if (size === 'medium') root.style.setProperty('--editor-font-size', '1.15rem');
            else if (size === 'large') root.style.setProperty('--editor-font-size', '1.35rem');
            else if (size === 'xlarge') root.style.setProperty('--editor-font-size', '1.6rem');
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognizer = SpeechRecognition ? new SpeechRecognition() : null;
        let isManuallyStopped = false; 

        if (recognizer) { 
            recognizer.continuous = true; 
            recognizer.interimResults = false; 
        }
        
        let activeDictationEditor = null, activeMicBtn = null;
        if (recognizer) {
            recognizer.onresult = (e) => {
                if (activeDictationEditor) {
                    let newText = "";
                    for (let i = e.resultIndex; i < e.results.length; i++) {
                        if (e.results[i].isFinal) newText += e.results[i][0].transcript;
                    }
                    if (newText) {
                        newText = newText.trim();
                        let currentText = activeDictationEditor.innerText;
                        
                        if (currentText.length === 0 || /[.!?]\s*$/.test(currentText)) {
                            newText = newText.charAt(0).toUpperCase() + newText.slice(1);
                        }

                        activeDictationEditor.innerText += (currentText && !currentText.endsWith(' ') && !currentText.endsWith('\\n') ? " " : "") + newText;
                        window.processNodeText(activeDictationEditor);
                    }
                }
            };
            
            recognizer.onend = () => { 
                if (!isManuallyStopped && activeMicBtn) {
                    try { recognizer.start(); } catch(e) {}
                } else if (activeMicBtn) {
                    activeMicBtn.classList.remove('recording'); 
                    activeMicBtn.innerHTML = '🎙️';
                }
            };
        }

        window.toggleDictation = function(btn, editor) {
            window.triggerTutAction('use_voice');
            if (!recognizer) {
                window.showToast("Dictation is not supported in this browser. Try Chrome or Safari.");
                return;
            }
            if (btn.classList.contains('recording')) { 
                isManuallyStopped = true;
                recognizer.stop(); 
                btn.classList.remove('recording');
                btn.innerHTML = '🎙️';
                
                let text = editor.innerText;
                if (text.trim().length > 0 && !/[.!?]$/.test(text.trim())) {
                    editor.innerText = text.trim() + ". ";
                    window.processNodeText(editor);
                    window.saveState();
                }
                return; 
            }
            
            isManuallyStopped = true;
            document.querySelectorAll('.mic-btn').forEach(b => {
                b.classList.remove('recording');
                b.innerHTML = '🎙️';
            });
            try { recognizer.stop(); } catch(e) {}
            
            setTimeout(() => {
                isManuallyStopped = false;
                activeDictationEditor = editor; 
                activeMicBtn = btn;
                btn.classList.add('recording'); 
                btn.innerHTML = '🔴'; 
                try { recognizer.start(); } catch(e) {}
            }, 100);
        }

        window.readAloud = function() {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const text = document.getElementById('compiled-text').innerText;
                if (!text || text.trim() === '') {
                    window.showToast("Draft is empty. Add thoughts first!");
                    return;
                }
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 0.9;
                window.speechSynthesis.speak(utterance);
            }
        }

        // NLP Engine removed as it was hanging with no effect


        // Interactive Tutorial Engine
        const tutorialChunks = [
            {
                name: "1. The Basics",
                successTitle: "Great start! 🌟",
                successDesc: "You've got the basics down. Want to learn how to connect your thoughts?",
                steps: [
                    { 
                        title: "Double-Tap to Create 🌌", 
                        desc: "Double-click the background grid to spawn a thought.",
                        waitFor: "create_node", cssId: 0
                    },
                    { 
                        title: "Move & Resize ✋", 
                        desc: "Grab the top bar to move it. Pull the right edge to stretch.",
                        waitFor: "move_node", cssId: 1,
                        action: () => {
                            if(window.nodesMap.size === 0) {
                                const cx = (window.innerWidth / 2 - window.panX) / scale - 150;
                                const cy = (window.innerHeight / 2 - window.panY) / scale - 100;
                                window.createNode(cx, cy, "Drag my top bar!");
                            }
                        }
                    },
                    { 
                        title: "Name Your Thoughts 🏷️", 
                        desc: "Click 'Thought Title' in the top bar of a node to give it a name.",
                        waitFor: "name_node", cssId: 2
                    }
                ]
            },
            {
                name: "2. Structuring Ideas",
                successTitle: "Connections made! 🔗",
                successDesc: "Awesome job building a flow. Next up: Adding colors and media!",
                steps: [
                    { 
                        title: "Link Thoughts 🔗", desc: "Drag the numbered badge onto another thought, or onto empty space to spawn a new thought linked to it.",
                        waitFor: "link_node", cssId: 3,
                        action: () => {
                            if(window.nodesMap.size < 2) {
                                const cx = (window.innerWidth / 2 - window.panX) / scale + 200;
                                const cy = (window.innerHeight / 2 - window.panY) / scale - 100;
                                window.createNode(cx, cy, "Connect to me!");
                            }
                        }
                    },
                    { 
                        title: "Insert Between ✂️", desc: "Drag a single thought directly onto a connection line to snap it into the middle, or right-click the line to delete it!",
                        waitFor: "insert_between", cssId: 4,
                        action: () => {
                            if(window.nodesMap.size < 3) {
                                const cx = (window.innerWidth / 2 - window.panX) / scale - 150;
                                const cy = (window.innerHeight / 2 - window.panY) / scale + 150;
                                window.createNode(cx, cy, "Drop me on the tether!");
                            }
                        }
                    }
                ]
            },
            {
                name: "3. Styling & Media",
                successTitle: "Looking good! 🎨",
                successDesc: "Your canvas is coming to life. Ready to learn how to organize big projects?",
                steps: [
                    { 
                        title: "Color Coding 🎨", 
                        desc: "Click the palette icon on a node to color-code it for organization.",
                        waitFor: "color_node", cssId: 5
                    },
                    { 
                        title: "Listen & Dictate 🗣️", 
                        desc: "Use the speaker icon to hear your text (TTS), or the mic icon to dictate your thoughts (STT)!",
                        waitFor: "use_voice", cssId: 6
                    },
                    { 
                        title: "Add Visuals 🖼️", 
                        desc: "Drag & drop an image onto the canvas, or use the Image button in the toolbar.",
                        waitFor: "add_image", cssId: 7
                    }
                ]
            },
            {
                name: "4. Organization & Export",
                successTitle: "You're a Pro! 🧠",
                successDesc: "You've completed the full tour of Cognitive. Happy mapping!",
                steps: [
                    { 
                        title: "Tabs & Project Names 📁", 
                        desc: "Rename your project in the toolbar, or click the '+' tab to juggle multiple drafts.",
                        waitFor: "use_tabs", cssId: 8
                    },
                    { 
                        title: "Focus Mode 🧘", 
                        desc: "Overwhelmed? 'Focus' blurs out everything but your active thought.",
                        waitFor: "focus_mode", cssId: 9
                    },
                    { 
                        title: "Personalize ⚙️", 
                        desc: "Click Settings to change fonts, overlays, sizes, and keyboard shortcuts.",
                        waitFor: "open_settings", cssId: 10
                    },
                    { 
                        title: "Compile & Export 📝", 
                        desc: "Hit Compile to instantly merge your entire spatial web into a readable document.",
                        waitFor: "compile", cssId: 11
                    },
                    { 
                        title: "Projects & Save ☁️", 
                        desc: "Hit Save to safely sync, or open Projects to manage drafts and import offline .cvas files.",
                        waitFor: "use_projects", cssId: 12
                    },
                    { 
                        title: "Secure Your Account 🛡️", 
                        desc: "You are currently in a temporary Guest Session! Click Account to sign up and save your work permanently.",
                        waitFor: "open_account", cssId: 13
                    }
                ]
            }
        ];
        
        let currentChunkIndex = 0;
        let currentTutStepIndex = 0;

        window.triggerTutAction = function(actionName) {
            if (document.getElementById('tutorial-overlay').style.display === 'flex' && document.getElementById('tut-normal-view').style.display !== 'none') {
                const chunk = tutorialChunks[currentChunkIndex];
                if (!chunk) return;
                const currentStepData = chunk.steps[currentTutStepIndex];
                if (currentStepData && currentStepData.waitFor === actionName) {
                    window.nextTutStep();
                }
            }
        };

        window.dismissWelcome = function() {
            localStorage.setItem('cognitive_tutorial_seen', 'true');
            document.getElementById('welcome-modal').style.display = 'none';
            window.showToast("Tutorial skipped. You can always restart it from the Settings menu!", false);
        };

        window.acceptWelcome = function() {
            localStorage.setItem('cognitive_tutorial_seen', 'true');
            document.getElementById('welcome-modal').style.display = 'none';
            window.startTutorial();
        };

        window.startTutorial = function() {
            currentChunkIndex = 0;
            currentTutStepIndex = 0;
            document.getElementById('tutorial-overlay').style.display = 'flex';
            window.updateTutUI();
            window.playSound('create');
        };
        
        window.startNextChunk = function() {
            currentChunkIndex++;
            currentTutStepIndex = 0;
            window.updateTutUI();
            window.playSound('create');
        };

        window.nextTutStep = function() {
            const chunk = tutorialChunks[currentChunkIndex];
            if (!chunk) return;
            
            if (currentTutStepIndex < chunk.steps.length - 1) {
                currentTutStepIndex++;
                window.updateTutUI();
                window.playSound('drop');
            } else {
                // Chunk completed!
                if (currentChunkIndex < tutorialChunks.length - 1) {
                    // Show Interstitial
                    for (let i = 0; i <= 15; i++) document.body.classList.remove(`tut-step-${i}`);
                    document.getElementById('tut-normal-view').style.display = 'none';
                    document.getElementById('tut-chunk-view').style.display = 'flex';
                    
                    document.getElementById('tut-chunk-finish-title').innerText = chunk.successTitle;
                    document.getElementById('tut-chunk-finish-desc').innerText = chunk.successDesc;
                    document.getElementById('tut-start-chunk-btn').innerText = `Start: ${tutorialChunks[currentChunkIndex + 1].name.split('.')[1].trim()} ➔`;
                    window.playSound('drop');
                } else {
                    // Entire tutorial over
                    window.endTutorial();
                }
            }
        };

        window.updateTutUI = function() {
            const chunk = tutorialChunks[currentChunkIndex];
            if (!chunk) return;
            
            document.getElementById('tut-normal-view').style.display = 'flex';
            document.getElementById('tut-chunk-view').style.display = 'none';
            
            const step = chunk.steps[currentTutStepIndex];

            // Apply global state class to trigger specific CSS highlights
            for (let i = 0; i <= 15; i++) document.body.classList.remove(`tut-step-${i}`);
            document.body.classList.add(`tut-step-${step.cssId}`);

            document.getElementById('tut-chunk-name').innerText = chunk.name;
            document.getElementById('tut-title').innerText = step.title;
            document.getElementById('tut-desc').innerText = step.desc;
            document.getElementById('tut-progress').innerText = `${currentTutStepIndex + 1}/${chunk.steps.length}`;
            
            const nextBtn = document.getElementById('tut-next-btn');
            if (currentTutStepIndex === chunk.steps.length - 1) {
                if (currentChunkIndex === tutorialChunks.length - 1) {
                    nextBtn.innerText = "Finish 🎉";
                } else {
                    nextBtn.innerText = "Next Part ➔";
                }
            } else {
                nextBtn.innerText = "Next ➔";
            }

            // Execute dynamic mock setup actions if they exist
            if (step.action) {
                step.action();
            }
        };

        window.endTutorial = function() {
            for (let i = 0; i <= 15; i++) document.body.classList.remove(`tut-step-${i}`);
            document.getElementById('tutorial-overlay').style.display = 'none';
            window.showToast("You're ready to start mapping your thoughts!", false);
            window.playSound('drop');
        };

        async function initCognitiveApp() {
            try {
                document.getElementById('loading-screen').style.display = 'none';
                document.addEventListener('pointerdown', () => { if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); }, {once:true});
                
                window.startNewProject(true); // Initializes first tab
                
                // Trigger Welcome Prompt if it's the user's first time
                if (!localStorage.getItem('cognitive_tutorial_seen')) {
                    setTimeout(() => {
                        document.getElementById('welcome-modal').style.display = 'flex';
                    }, 500); // Slight delay for smoothness after the canvas loads
                }

            } catch (error) { 
                console.error("Critical Load Error:", error); 
                document.getElementById('loading-screen').innerText = "An error occurred during boot: " + error.message; 
            }
        }


        // Tooltip and NLP suggestions logic removed since it was an empty/hanging feature

        // Start Boot Sequence

        
        /* ====================================================================
           RECOVERY: CORE NODE, TETHER, EVENT LOGIC
        ==================================================================== */
        
        let isDraggingNode = false, draggedNode = null, dragOffsetX = 0, dragOffsetY = 0;
        let isLinking = false, linkingFromId = null, tempTether = null;
        let tetherLayer = document.getElementById('tether-layer');
        let workspace = document.getElementById('workspace');

        window.deleteNode = function(nodeId, save = true) {
            const node = window.nodesMap.get(nodeId);
            if (node) {
                node.remove();
                window.nodesMap.delete(nodeId);
            }
            if (window.nodeSequence) {
                window.nodeSequence = window.nodeSequence.filter(id => id !== nodeId);
            }
            if (window.edges) {
                window.edges = window.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
            }
            if (save && window.saveState) window.saveState();
            if (window.updateGraph) window.updateGraph();
            if (window.updateTethers) window.updateTethers();
            if (window.updateSequenceUI) window.updateSequenceUI();
        };

        window.getEditorText = function(editor) {
            if (!editor) return "";
            return editor.innerText || editor.textContent || "";
        };

        window.processNodeText = function(editor) {
            // Deprecated NLP Engine logic
        };

        window.processAllNodes = function() {
            // Deprecated NLP Engine logic
        };

        window.createNode = function(x, y, text = "", id = null, loadColor = null, isRestore = false, loadWidth = "300px", loadTitle = "", nodeType = "text", imageSrc = null, loadAlign = "left") {
            const nodeId = id || 'node_' + Date.now();
            const node = document.createElement('div');
            node.className = 'node';
            if (nodeType === 'image') node.classList.add('image-node');
            node.id = nodeId;
            node.style.left = x + "px";
            node.style.top = y + "px";
            node.style.width = loadWidth;

            if (loadColor && loadColor !== 'default') {
                node.setAttribute('data-color', loadColor);
            }

            const dragHandle = document.createElement('div');
            dragHandle.className = 'drag-handle';

            const colorContainer = document.createElement('div');
            colorContainer.style.position = 'relative';

            const colorBtn = document.createElement('button');
            colorBtn.className = 'icon-btn';
            colorBtn.setAttribute('aria-label', "Change node color");
            colorBtn.innerHTML = '🎨';
            colorBtn.onclick = (e) => {
                e.stopPropagation();
                window.triggerTutAction && window.triggerTutAction('color_node');
                
                const existing = document.querySelector('.color-dropdown');
                if (existing) existing.remove();

                const dropdown = document.createElement('div');
                dropdown.className = 'color-dropdown show';
                dropdown.style.top = '100%';
                dropdown.style.left = '0';
                dropdown.style.transform = 'none';

                const colors = [
                    { id: 'default', color: 'var(--node-bg)' },
                    { id: 'blue', color: 'rgba(59, 130, 246, 0.8)' },
                    { id: 'green', color: 'rgba(16, 185, 129, 0.8)' },
                    { id: 'purple', color: 'rgba(168, 85, 247, 0.8)' },
                    { id: 'yellow', color: 'rgba(245, 158, 11, 0.8)' },
                    { id: 'red', color: 'rgba(239, 68, 68, 0.8)' }
                ];
                
                colors.forEach(c => {
                    const swatch = document.createElement('button');
                    swatch.className = 'color-swatch';
                    swatch.style.background = c.color;
                    swatch.onclick = (ev) => {
                        ev.stopPropagation();
                        
                        const applyColor = (targetNode) => {
                            if (c.id === 'default') {
                                targetNode.removeAttribute('data-color');
                            } else {
                                targetNode.setAttribute('data-color', c.id);
                            }
                        };
                        
                        if (selectedNodes.has(nodeId)) {
                            selectedNodes.forEach(id => {
                                const n = window.nodesMap.get(id);
                                if (n) applyColor(n);
                            });
                        } else {
                            applyColor(node);
                        }
                        
                        dropdown.remove();
                        window.saveState && window.saveState();
                    };
                    dropdown.appendChild(swatch);
                });
                
                colorContainer.appendChild(dropdown);
                
                setTimeout(() => {
                    const closer = (ev) => {
                        if (!dropdown.contains(ev.target)) {
                            dropdown.remove();
                            document.removeEventListener('pointerdown', closer);
                        }
                    };
                    document.addEventListener('pointerdown', closer);
                }, 10);
            };
            
            colorContainer.appendChild(colorBtn);

            const titleInput = document.createElement('input');
            titleInput.className = 'node-title-input';
            titleInput.placeholder = "Thought Title";
            titleInput.value = loadTitle;
            titleInput.addEventListener('input', () => window.saveState && window.saveState());
            titleInput.addEventListener('click', () => window.triggerTutAction && window.triggerTutAction('name_node'));

            const rightIcons = document.createElement('div');
            rightIcons.style.display = 'flex';
            rightIcons.style.gap = '4px';

            const speakBtn = document.createElement('button');
            speakBtn.className = 'icon-btn';
            speakBtn.setAttribute('aria-label', "Read thought aloud");
            speakBtn.innerHTML = '🔊';
            speakBtn.onclick = (e) => {
                e.stopPropagation();
                window.triggerTutAction && window.triggerTutAction('use_voice');
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const editor = node.querySelector('.editor');
                    if (editor) {
                        const textStr = editor.innerText;
                        if (!textStr || textStr.trim() === '') return;
                        const utterance = new SpeechSynthesisUtterance(textStr);
                        utterance.rate = 0.9;
                        window.speechSynthesis.speak(utterance);
                    }
                }
            };
            
            const dictateBtn = document.createElement('button');
            dictateBtn.className = 'icon-btn';
            dictateBtn.setAttribute('aria-label', "Dictate thought");
            dictateBtn.innerHTML = '🎙️';
            dictateBtn.onclick = (e) => {
                e.stopPropagation();
                const editor = node.querySelector('.editor');
                if (editor && window.toggleDictation) {
                    window.toggleDictation(dictateBtn, editor);
                }
            };
            
            const delBtn = document.createElement('button');
            delBtn.className = 'icon-btn del-btn';
            delBtn.setAttribute('aria-label', "Delete node");
            delBtn.innerHTML = '✕';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (selectedNodes.has(nodeId)) {
                    selectedNodes.forEach(id => {
                        window.deleteNode && window.deleteNode(id, false);
                    });
                    window.clearSelection();
                    window.updateGraph && window.updateGraph();
                    window.playSound && window.playSound('drop');
                    window.saveState && window.saveState();
                    window.showToast && window.showToast("Deleted selection.");
                } else if (window.deleteNode) {
                    window.deleteNode(nodeId);
                }
            };

            rightIcons.appendChild(colorContainer);
            rightIcons.appendChild(speakBtn);
            rightIcons.appendChild(dictateBtn);
            rightIcons.appendChild(delBtn);

            const badge = document.createElement('div');
            badge.className = 'seq-badge';
            badge.innerHTML = "1";
            badge.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                if (!window.nodesMap.get(nodeId)) return;
                isLinking = true; linkingFromId = nodeId; badge.classList.add('linking');
                tempTether = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                tempTether.setAttribute('stroke', 'var(--focus-ring)'); 
                tempTether.setAttribute('stroke-width', '4');
                tempTether.setAttribute('fill', 'none'); 
                tempTether.setAttribute('stroke-dasharray', '6,6');
                tempTether.setAttribute('marker-end', 'url(#arrow-blue)');
                document.getElementById('tether-layer').appendChild(tempTether);
            });

            dragHandle.appendChild(badge);
            dragHandle.appendChild(titleInput);
            dragHandle.appendChild(rightIcons);
            
            dragHandle.addEventListener('pointerdown', (e) => {
                if (e.target.closest('button') || e.target.closest('input')) return;
                
                if (e.shiftKey) {
                    window.selectNode(nodeId, true);
                } else if (!selectedNodes.has(nodeId)) {
                    window.clearSelection();
                    window.selectNode(nodeId);
                }

                isDraggingNode = true;
                draggedNode = node;
                
                const scale = window.scale || 1;
                dragOffsetX = e.clientX/scale - parseFloat(node.style.left);
                dragOffsetY = e.clientY/scale - parseFloat(node.style.top);
                
                initialPositions.clear();
                selectedNodes.forEach(sid => {
                    const sn = window.nodesMap.get(sid);
                    if (sn) {
                        initialPositions.set(sid, {
                            left: parseFloat(sn.style.left) || 0,
                            top: parseFloat(sn.style.top) || 0,
                            dtX: parseFloat(sn.style.left) - parseFloat(node.style.left),
                            dtY: parseFloat(sn.style.top) - parseFloat(node.style.top)
                        });
                    }
                });

                e.stopPropagation();
            });

            const editor = document.createElement('div');
            editor.className = 'editor';
            editor.contentEditable = true;
            editor.innerHTML = text;
            if (loadAlign) editor.style.textAlign = loadAlign;
            
            editor.addEventListener('input', () => { window.saveState && window.saveState(); });
            editor.addEventListener('focus', () => node.classList.add('focused'));
            editor.addEventListener('blur', () => node.classList.remove('focused'));

            node.appendChild(dragHandle);
            if (nodeType === 'image' && imageSrc) {
                const img = document.createElement('img');
                img.className = 'node-image';
                img.src = imageSrc;
                img.onclick = () => window.panToNode && window.panToNode(nodeId);
                node.appendChild(img);
            }
            node.appendChild(editor);
            document.getElementById('nodes-container').appendChild(node);
            window.nodesMap.set(nodeId, node);
            
            if(!isRestore) {
                window.nodeSequence.push(nodeId);
                window.saveState && window.saveState();
                window.updateSequenceUI && window.updateSequenceUI();
            }
        };

        window.addEdge = function(sourceId, targetId) {
            if(window.edges.some(e => e.source === sourceId && e.target === targetId)) return true;

            // Cycle prevention
            const isReachable = (from, to) => {
                if (from === to) return true;
                let queue = [from], visited = new Set([from]);
                while (queue.length > 0) {
                    let curr = queue.shift();
                    let outs = window.edges.filter(e => e.source === curr);
                    for (let e of outs) {
                        if (e.target === to) return true;
                        if (!visited.has(e.target)) {
                            visited.add(e.target);
                            queue.push(e.target);
                        }
                    }
                }
                return false;
            };
            
            if (isReachable(targetId, sourceId)) {
                window.showToast && window.showToast("Cannot create cyclical connection.");
                return false;
            }

            const outbound = window.edges.filter(e => e.source === sourceId).length;
            let compileFlag = (outbound === 0);
            
            if (window.nodeSequence && window.nodeSequence.length > 0) {
                if (!window.nodeSequence.includes(sourceId) || !window.nodeSequence.includes(targetId)) {
                    compileFlag = false; 
                }
            }
            
            window.edges.push({ id: 'edge_' + Date.now() + Math.floor(Math.random()*1000), source: sourceId, target: targetId, compile: compileFlag });
            return true;
        };

        window.toggleEdgeCompile = function(edgeId) {
            const index = window.edges.findIndex(e => e.id === edgeId);
            if (index !== -1) {
                const edge = window.edges[index];
                if (!edge.compile) {
                    // Backup states
                    const backups = window.edges.map(e => ({ id: e.id, compile: e.compile }));
                    
                    // Turn off any other compiled edges from the same source
                    window.edges.forEach(e2 => {
                        if (e2.source === edge.source && e2.id !== edgeId) e2.compile = false;
                    });
                    edge.compile = true;
                    
                    // Check if this results in multiple disjoint roots
                    let compiledEdges = window.edges.filter(e => e.compile);
                    let inDegree = new Map();
                    compiledEdges.forEach(e => {
                        if(!inDegree.has(e.source)) inDegree.set(e.source, 0);
                        if(!inDegree.has(e.target)) inDegree.set(e.target, 0);
                    });
                    compiledEdges.forEach(e => {
                        inDegree.set(e.target, inDegree.get(e.target) + 1);
                    });
                    let roots = 0;
                    inDegree.forEach(val => { if(val === 0) roots++; });
                    
                    if (roots > 1) {
                        // Revert and reject
                        window.edges.forEach(e => {
                            let b = backups.find(x => x.id === e.id);
                            if (b) e.compile = b.compile;
                        });
                        window.showToast && window.showToast("Cannot include tether. It must be connected to the main active path.");
                        return;
                    }
                } else {
                    edge.compile = false;
                }
                window.updateGraph && window.updateGraph();
                window.updateTethers && window.updateTethers();
                window.saveState && window.saveState();
            }
        };

        window.deleteEdge = function(edgeId) {
            window.edges = window.edges.filter(e => e.id !== edgeId);
            window.updateGraph && window.updateGraph();
            window.updateTethers && window.updateTethers();
            window.saveState && window.saveState();
        };

        window.showTetherMenu = function(e, edgeId) {
            e.preventDefault();
            const edge = window.edges.find(x => x.id === edgeId);
            if(!edge) return;
            const menu = document.createElement('div');
            menu.className = 'context-menu visible';
            menu.style.left = e.clientX + 'px';
            menu.style.top = e.clientY + 'px';
            menu.style.position = 'fixed';
            menu.style.zIndex = '999999';
            
            menu.innerHTML = "<button onclick=\"window.toggleEdgeCompile('" + edgeId + "'); this.parentNode.remove();\" class=\"text-style-btn\">" + (edge.compile ? '❌ Exclude from Compile' : '✅ Include in Compile') + "</button>" +
                "<div style=\"height: 1px; background: var(--surface-border); margin: 4px 0;\"></div>" +
                "<button onclick=\"window.deleteEdge('" + edgeId + "'); this.parentNode.remove();\" class=\"text-style-btn\" style=\"color: var(--error-border)\">🗑️ Delete Tether</button>";
            document.body.appendChild(menu);
            
            setTimeout(() => {
                const closeMenu = (ev) => {
                    if(!menu.contains(ev.target)) {
                        menu.remove();
                        document.removeEventListener('pointerdown', closeMenu);
                    }
                };
                document.addEventListener('pointerdown', closeMenu);
            }, 10);
        };

        const getBoundPoint = (left, top, width, height, cx, cy, tx, ty) => {
            let dx = tx - cx;
            let dy = ty - cy;
            if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return {x: cx, y: cy + height/2 + 5, side: 'bottom'};
            
            let halfW = width / 2 + 5;
            let halfH = height / 2 + 5;
            
            let tX = Math.abs(dx) > 0.01 ? halfW / Math.abs(dx) : Infinity;
            let tY = Math.abs(dy) > 0.01 ? halfH / Math.abs(dy) : Infinity;
            
            let t = Math.min(tX, tY);
            let ix = dx * t;
            let iy = dy * t;
            
            let side = 'bottom';
            if (t === tX) {
                side = dx > 0 ? 'right' : 'left';
                iy = Math.max(-halfH + 15, Math.min(halfH - 15, iy));
            } else {
                side = dy > 0 ? 'bottom' : 'top';
                ix = Math.max(-halfW + 15, Math.min(halfW - 15, ix));
            }
            
            return { x: cx + ix, y: cy + iy, side };
        };

        window.updateTethers = function() {
            let tl = document.getElementById('tether-layer');
            if(!tl) return;
            
            const defs = tl.querySelector('defs');
            tl.innerHTML = '';
            if (defs) tl.appendChild(defs);
            
            let svgStr = '';
            
            window.edges.forEach(edge => {
                let n1 = window.nodesMap.get(edge.source);
                let n2 = window.nodesMap.get(edge.target);
                if (!n1 || !n2) return;
                
                let cx1 = parseFloat(n1.style.left) + n1.offsetWidth/2;
                let cy1 = parseFloat(n1.style.top) + n1.offsetHeight/2;
                let cx2 = parseFloat(n2.style.left) + n2.offsetWidth/2;
                let cy2 = parseFloat(n2.style.top) + n2.offsetHeight/2;
                
                let p1 = getBoundPoint(parseFloat(n1.style.left), parseFloat(n1.style.top), n1.offsetWidth, n1.offsetHeight, cx1, cy1, cx2, cy2);
                let p2 = getBoundPoint(parseFloat(n2.style.left), parseFloat(n2.style.top), n2.offsetWidth, n2.offsetHeight, cx2, cy2, cx1, cy1);
                
                let strokeColor = edge.compile ? 'var(--focus-ring)' : 'gray';
                let strokeWidth = edge.compile ? 4 : 2;
                let dashArray = edge.compile ? 'none' : '8,8';
                let markerUrl = edge.compile ? 'url(#arrow-blue)' : 'url(#arrow-gray)';
                
                // Calculate control points ensuring they extend outwards from their connection sides
                let dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                let cpOffset = Math.max(40, dist / 3);
                
                let cp1x = p1.x + (p1.side === 'right' ? cpOffset : p1.side === 'left' ? -cpOffset : 0);
                let cp1y = p1.y + (p1.side === 'bottom' ? cpOffset : p1.side === 'top' ? -cpOffset : 0);
                
                let cp2x = p2.x + (p2.side === 'right' ? cpOffset : p2.side === 'left' ? -cpOffset : 0);
                let cp2y = p2.y + (p2.side === 'bottom' ? cpOffset : p2.side === 'top' ? -cpOffset : 0);
                
                svgStr += '<g class="tether-group" data-edge-id="' + edge.id + '" data-source-id="' + edge.source + '" data-target-id="' + edge.target + '" role="button" tabindex="0" oncontextmenu="window.showTetherMenu(event, \'' + edge.id + '\')" onclick="window.panToNode(\'' + edge.target + '\')" onkeydown="if(event.key === \'Enter\' || event.key === \' \') { event.preventDefault(); window.panToNode(\'' + edge.target + '\'); }">' +
                       '<path d="M' + p1.x + ',' + p1.y + ' C' + cp1x + ',' + cp1y + ' ' + cp2x + ',' + cp2y + ' ' + p2.x + ',' + p2.y + '" ' +
                              'stroke="' + strokeColor + '" stroke-width="' + strokeWidth + '" fill="none" stroke-dasharray="' + dashArray + '" marker-end="' + markerUrl + '" class="tether-path"/>' +
                       '<path d="M' + p1.x + ',' + p1.y + ' C' + cp1x + ',' + cp1y + ' ' + cp2x + ',' + cp2y + ' ' + p2.x + ',' + p2.y + '" ' +
                              'stroke="transparent" stroke-width="24" fill="none" class="tether-hitbox" pointer-events="stroke" style="cursor: context-menu;" />' +
                       '</g>';
            });
            tl.innerHTML = tl.innerHTML + svgStr;
        };

        // Pointer event listeners for interaction logic
        document.addEventListener('pointerup', (e) => {
            if (isDraggingNode) {
                isDraggingNode = false;
                
                if (window.selectedNodes && window.selectedNodes.size === 1 && draggedNode) {
                    const originalPointerEvents = draggedNode.style.pointerEvents;
                    draggedNode.style.pointerEvents = 'none'; 
                    const under = document.elementFromPoint(e.clientX, e.clientY);
                    draggedNode.style.pointerEvents = originalPointerEvents;
                    
                    const targetTether = under ? under.closest('.tether-group') : null;
                    if (targetTether) {
                        const edgeId = targetTether.getAttribute('data-edge-id');
                        const edgeToReplace = window.edges.find(edge => edge.id === edgeId);
                        
                        if (edgeToReplace && draggedNode.id !== edgeToReplace.source && draggedNode.id !== edgeToReplace.target) {
                            window.deleteEdge(edgeToReplace.id);
                            
                            const success1 = window.addEdge(edgeToReplace.source, draggedNode.id);
                            const success2 = window.addEdge(draggedNode.id, edgeToReplace.target);
                            
                            if (!success1 || !success2) {
                                // Cycle or conflict occurred, revert
                                if (success1) window.edges = window.edges.filter(e => !(e.source === edgeToReplace.source && e.target === draggedNode.id));
                                if (success2) window.edges = window.edges.filter(e => !(e.source === draggedNode.id && e.target === edgeToReplace.target));
                                window.addEdge(edgeToReplace.source, edgeToReplace.target);
                            } else {
                                window.triggerTutAction && window.triggerTutAction('insert_between');
                            }
                            window.updateGraph && window.updateGraph();
                            window.updateTethers && window.updateTethers();
                        }
                    }
                }

                window.saveState && window.saveState();
            }
            if (isLinking) {
                isLinking = false;
                if (tempTether) { tempTether.remove(); tempTether = null; }
                const under = document.elementFromPoint(e.clientX, e.clientY);
                const targetNode = under ? under.closest('.node') : null;
                const targetTether = under ? under.closest('.tether-group') : null;
                
                // Exclude the source node itself
                if (targetNode && targetNode.id !== linkingFromId) {
                    window.addEdge(linkingFromId, targetNode.id);
                    window.updateGraph && window.updateGraph();
                    window.updateTethers && window.updateTethers();
                    window.saveState && window.saveState();
                } 
                else if (!targetNode && !targetTether) {
                    const rect = document.getElementById('workspace').getBoundingClientRect();
                    const scale = window.scale || 1;
                    const x = (e.clientX - rect.left - (window.panX || 0)) / scale;
                    const y = (e.clientY - rect.top - (window.panY || 0)) / scale;
                    const newId = 'node_' + Date.now();
                    window.createNode(x, y, "", newId);
                    window.addEdge(linkingFromId, newId);
                    window.updateGraph && window.updateGraph();
                    window.updateTethers && window.updateTethers();
                    window.saveState && window.saveState();
                }
                document.querySelectorAll('.seq-badge').forEach(b => b.classList.remove('linking'));
                window.updateTethers && window.updateTethers(); // clear any lingering temporary visuals
            }
        });

        document.addEventListener('pointermove', (e) => {
            if (isDraggingNode && draggedNode) {
                const scale = window.scale || 1;
                const newLeft = e.clientX/scale - dragOffsetX;
                const newTop = e.clientY/scale - dragOffsetY;
                
                if (selectedNodes.has(draggedNode.id)) {
                    selectedNodes.forEach(sid => {
                        const sn = window.nodesMap.get(sid);
                        const initial = initialPositions.get(sid);
                        if (sn && initial) {
                            sn.style.left = (newLeft + initial.dtX) + 'px';
                            sn.style.top = (newTop + initial.dtY) + 'px';
                        }
                    });
                } else {
                    draggedNode.style.left = newLeft + 'px';
                    draggedNode.style.top = newTop + 'px';
                }
                
                window.updateTethers && window.updateTethers();
            } else if (isLinking && tempTether && linkingFromId) {
                const n1 = window.nodesMap.get(linkingFromId);
                if(!n1) return;
                const scale = window.scale || 1;
                const p1x = (parseFloat(n1.style.left) + n1.offsetWidth/2);
                const p1y = (parseFloat(n1.style.top) + n1.offsetHeight/2);
                const p2x = (e.clientX - window.panX) / scale;
                const p2y = (e.clientY - window.panY) / scale;
                
                let p1 = getBoundPoint(parseFloat(n1.style.left), parseFloat(n1.style.top), n1.offsetWidth, n1.offsetHeight, p1x, p1y, p2x, p2y);
                
                let dist = Math.hypot(p2x - p1.x, p2y - p1.y);
                let cpOffset = Math.max(40, dist / 3);
                
                let cp1x = p1.x + (p1.side === 'right' ? cpOffset : p1.side === 'left' ? -cpOffset : 0);
                let cp1y = p1.y + (p1.side === 'bottom' ? cpOffset : p1.side === 'top' ? -cpOffset : 0);
                
                tempTether.setAttribute('d', "M" + p1.x + "," + p1.y + " C" + cp1x + "," + cp1y + " " + p2x + "," + p2y + " " + p2x + "," + p2y);
            }
        });

initCognitiveApp();

    