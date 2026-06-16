export function setupCanvas() {
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    
    // Multi-touch tracking
    let activePointers = new Map();
    let initialPinchDistance = 0;
    let initialScale = 1;
    let initialPanX = 0;
    let initialPanY = 0;
    let pinchCenterX = 0;
    let pinchCenterY = 0;

    const workspace = document.getElementById('workspace');

    window.updateCanvasTransform = function() {
        const container = document.getElementById('canvas-content');
        if (container) {
            const s = window.scale || 1;
            const px = window.panX || 0;
            const py = window.panY || 0;
            container.style.transform = `translate(${px}px, ${py}px) scale(${s})`;
        }
        if (window.renderMinimap) window.renderMinimap();
    };

    window.zoomIn = function() {
        window.scale = Math.min((window.scale || 1) + 0.1, 3);
        window.updateCanvasTransform();
        window.updateTethers && window.updateTethers();
    };

    window.zoomOut = function() {
        window.scale = Math.max((window.scale || 1) - 0.1, 0.2);
        window.updateCanvasTransform();
        window.updateTethers && window.updateTethers();
    };

    window.resetView = function() {
        if (!window.nodesMap || window.nodesMap.size === 0) {
            window.scale = 1;
            window.panX = 0;
            window.panY = 0;
            window.updateCanvasTransform();
            return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        window.nodesMap.forEach(node => {
            const x = parseFloat(node.style.left);
            const y = parseFloat(node.style.top);
            if (!isNaN(x) && !isNaN(y)) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x + node.offsetWidth);
                maxY = Math.max(maxY, y + node.offsetHeight);
            }
        });
        if (minX === Infinity) return;
        
        const padding = 50;
        const width = maxX - minX;
        const height = maxY - minY;
        
        const scaleX = (window.innerWidth - padding * 2) / width;
        const scaleY = (window.innerHeight - padding * 2) / height;
        
        window.scale = Math.max(0.2, Math.min(1.5, scaleX, scaleY));
        window.panX = (window.innerWidth / 2) - ((minX + width / 2) * window.scale);
        window.panY = (window.innerHeight / 2) - ((minY + height / 2) * window.scale);
        
        window.updateCanvasTransform();
        window.updateTethers && window.updateTethers();
    };

    window.goToRootNode = function() {
        if (!window.nodeSequence || window.nodeSequence.length === 0) return;
        const rootId = window.nodeSequence[0];
        window.panToNode(rootId);
    };

    window.toggleFocusMode = function() {
        if (workspace) {
            workspace.classList.toggle('focus-mode');
        }
    };

    window.autoTidy = function(layoutType = 'grid') {
        if (!window.nodesMap || window.nodesMap.size === 0) return;
        
        const targetNodes = (window.selectedNodes && window.selectedNodes.size > 0) 
            ? Array.from(window.selectedNodes) 
            : Array.from(window.nodesMap.keys());
            
        let startX = 100, startY = 100;
        
        if (targetNodes.length > 0) {
            // Find bounding box to position relative to
            let minX = Infinity, minY = Infinity;
            targetNodes.forEach(id => {
                const node = window.nodesMap.get(id);
                if (node) {
                    minX = Math.min(minX, parseFloat(node.style.left) || 100);
                    minY = Math.min(minY, parseFloat(node.style.top) || 100);
                }
            });
            startX = isFinite(minX) ? minX : 100;
            startY = isFinite(minY) ? minY : 100;
        }

        const horizontalSpacing = 350;
        const verticalSpacing = 300;
        
        let x = startX, y = startY;

        if (layoutType === 'grid') {
            const cols = Math.max(1, Math.ceil(Math.sqrt(targetNodes.length)));
            let colCount = 0;
            targetNodes.forEach(id => {
                const node = window.nodesMap.get(id);
                if (!node) return;
                node.style.left = x + 'px';
                node.style.top = y + 'px';
                
                colCount++;
                if (colCount >= cols) {
                    colCount = 0;
                    x = startX;
                    y += verticalSpacing;
                } else {
                    x += horizontalSpacing;
                }
            });
        } else if (layoutType === 'horizontal') {
            targetNodes.forEach(id => {
                const node = window.nodesMap.get(id);
                if (!node) return;
                node.style.left = x + 'px';
                node.style.top = y + 'px';
                x += horizontalSpacing;
            });
        } else if (layoutType === 'vertical') {
            targetNodes.forEach(id => {
                const node = window.nodesMap.get(id);
                if (!node) return;
                node.style.left = x + 'px';
                node.style.top = y + 'px';
                y += verticalSpacing;
            });
        } else if (layoutType === 'tree') {
            let inDegreeMap = new Map();
            targetNodes.forEach(id => inDegreeMap.set(id, 0));
            if (window.edges) {
                window.edges.forEach(e => {
                    if (targetNodes.includes(e.source) && targetNodes.includes(e.target)) {
                        inDegreeMap.set(e.target, (inDegreeMap.get(e.target) || 0) + 1);
                    }
                });
            }
            
            let roots = targetNodes.filter(id => inDegreeMap.get(id) === 0);
            if (roots.length === 0 && targetNodes.length > 0) {
                roots = [targetNodes[0]]; 
            }

            let levels = new Map();
            let queue = roots.map(id => ({ id, level: 0 }));
            let visited = new Set();
            
            while (queue.length > 0) {
                let {id, level} = queue.shift();
                if (visited.has(id)) continue;
                visited.add(id);
                
                if (!levels.has(level)) levels.set(level, []);
                levels.get(level).push(id);
                
                if (window.edges) {
                    let targets = window.edges.filter(e => e.source === id && targetNodes.includes(e.target)).map(e => e.target);
                    for (let t of targets) {
                        if (!visited.has(t)) {
                            queue.push({ id: t, level: level + 1 });
                        }
                    }
                }
            }
            
            let unvisited = targetNodes.filter(id => !visited.has(id));
            if (unvisited.length > 0) {
                const maxLevel = levels.size > 0 ? Math.max(...Array.from(levels.keys())) + 1 : 0;
                levels.set(maxLevel, unvisited);
            }

            levels.forEach((nodes, level) => {
                let currX = startX; // use bounding box X
                nodes.forEach(nodeId => {
                    let n = window.nodesMap.get(nodeId);
                    if (n) {
                        n.style.left = currX + 'px';
                        n.style.top = (startY + level * verticalSpacing) + 'px';
                        currX += horizontalSpacing;
                    }
                });
            });
        }

        if (window.updateTethers) window.updateTethers();
        if (window.saveState) window.saveState();
    };

    window.showTidyMenu = function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        document.querySelectorAll('.context-menu').forEach(m => m.remove());
        
        const menu = document.createElement('div');
        menu.className = 'context-menu visible';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.style.position = 'fixed';
        menu.style.zIndex = '999999';
        
        menu.innerHTML = `
            <div style="padding: 4px 12px; font-size: 0.8rem; color: var(--text-color); opacity: 0.6; font-weight: bold; text-transform: uppercase;">Organize Layout</div>
            <button onclick="window.autoTidy('grid'); this.parentNode.remove();" class="text-style-btn">⏹️ Grid (Wrapped)</button>
            <button onclick="window.autoTidy('horizontal'); this.parentNode.remove();" class="text-style-btn">➡️ Horizontal Row</button>
            <button onclick="window.autoTidy('vertical'); this.parentNode.remove();" class="text-style-btn">⬇️ Vertical Stack</button>
            <button onclick="window.autoTidy('tree'); this.parentNode.remove();" class="text-style-btn">🌿 Tree Hierarchy</button>
        `;
        document.body.appendChild(menu);
        
        setTimeout(() => {
            const closeMenu = (evt) => {
                if (!menu.contains(evt.target)) {
                    menu.remove();
                    document.removeEventListener('pointerdown', closeMenu);
                }
            };
            document.addEventListener('pointerdown', closeMenu);
        }, 10);
    };

    window.panToNode = function(nodeId) {
        if (!window.nodesMap) return;
        const node = window.nodesMap.get(nodeId);
        if (!node) return;
        const s = window.scale || 1;
        const x = parseFloat(node.style.left) + node.offsetWidth / 2;
        const y = parseFloat(node.style.top) + node.offsetHeight / 2;
        window.panX = window.innerWidth / 2 - x * s;
        window.panY = window.innerHeight / 2 - y * s;
        window.updateCanvasTransform();
    };

    let lastTap = 0;
    
    workspace.addEventListener('pointerdown', (e) => {
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (activePointers.size === 2) {
            const pts = Array.from(activePointers.values());
            initialPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            const rect = workspace.getBoundingClientRect();
            pinchCenterX = (pts[0].x + pts[1].x) / 2 - rect.left;
            pinchCenterY = (pts[0].y + pts[1].y) / 2 - rect.top;
            initialScale = window.scale || 1;
            initialPanX = window.panX || 0;
            initialPanY = window.panY || 0;
            
            isPanning = false;
            if (window.isMarqueeSelecting) {
                window.isMarqueeSelecting = false;
                const marquee = document.getElementById('marquee');
                if (marquee) marquee.style.display = 'none';
            }
            workspace.setPointerCapture(e.pointerId);
            return;
        }

        // Only pan if clicking directly on workspace or canvas-content
        if (e.target.id === 'workspace' || e.target.id === 'canvas-content' || (e.target.tagName === 'svg' && e.target.id === 'tether-layer')) {
            const now = Date.now();
            if (now - lastTap < 300) {
                // Double tap detected
                const rect = workspace.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const actualX = (mouseX - (window.panX || 0)) / (window.scale || 1);
                const actualY = (mouseY - (window.panY || 0)) / (window.scale || 1);
                window.lastNodeCreationTime = Date.now();
                window.createNode(actualX, actualY);
                if (window.triggerTutAction) window.triggerTutAction('create_node');
                lastTap = 0; // reset
                return;
            }
            lastTap = now;

            if (e.shiftKey) {
                window.startMarqueeSelection(e);
                workspace.setPointerCapture(e.pointerId);
                return;
            }

            if (window.clearSelection) window.clearSelection();

            isPanning = true;
            startX = e.clientX - (window.panX || 0);
            startY = e.clientY - (window.panY || 0);
            workspace.setPointerCapture(e.pointerId);
            workspace.style.cursor = 'grabbing';
        }
    });

    workspace.addEventListener('pointermove', (e) => {
        if (activePointers.has(e.pointerId)) {
            activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        if (activePointers.size === 2 && initialPinchDistance > 0) {
            const pts = Array.from(activePointers.values());
            const currentDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            const zoomFactor = currentDistance / initialPinchDistance;
            
            let newScale = Math.max(0.1, Math.min(5, initialScale * zoomFactor));
            
            // Adjust pan to zoom around the initial pinch center
            window.panX = pinchCenterX - (pinchCenterX - initialPanX) * (newScale / initialScale);
            window.panY = pinchCenterY - (pinchCenterY - initialPanY) * (newScale / initialScale);
            
            // Add pan dragging simultaneously
            const currentCenterX = (pts[0].x + pts[1].x) / 2 - workspace.getBoundingClientRect().left;
            const currentCenterY = (pts[0].y + pts[1].y) / 2 - workspace.getBoundingClientRect().top;
            
            window.panX += (currentCenterX - pinchCenterX);
            window.panY += (currentCenterY - pinchCenterY);
            
            window.scale = newScale;
            window.updateCanvasTransform();
            window.updateTethers && window.updateTethers();
            return;
        }

        if (window.isMarqueeSelecting && activePointers.size < 2) {
            window.updateMarqueeSelection(e);
            return;
        }
        if (isPanning && activePointers.size < 2) {
            window.panX = e.clientX - startX;
            window.panY = e.clientY - startY;
            window.updateCanvasTransform();
        }
    });

    workspace.addEventListener('pointerup', (e) => {
        activePointers.delete(e.pointerId);
        
        if (activePointers.size < 2) {
            initialPinchDistance = 0;
            // if reduced to 1 pointer, let's reset the pan start so it doesn't jump
            if (activePointers.size === 1 && isPanning) {
                const remaining = Array.from(activePointers.values())[0];
                startX = remaining.x - (window.panX || 0);
                startY = remaining.y - (window.panY || 0);
            }
        }

        if (window.isMarqueeSelecting && activePointers.size === 0) {
            window.endMarqueeSelection(e);
            workspace.releasePointerCapture(e.pointerId);
            return;
        }
        if (isPanning && activePointers.size === 0) {
            isPanning = false;
            workspace.releasePointerCapture(e.pointerId);
            workspace.style.cursor = '';
            window.saveState && window.saveState();
        }
    });
    
    workspace.addEventListener('pointercancel', (e) => {
        activePointers.delete(e.pointerId);
        initialPinchDistance = 0;
        isPanning = false;
        window.isMarqueeSelecting = false;
    });

    workspace.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            // Zooming (Pinch to zoom on trackpad)
            e.preventDefault();
            
            const zoomFactor = Math.exp(-e.deltaY * 0.005);
            const oldScale = window.scale || 1;
            let newScale = Math.max(0.1, Math.min(5, oldScale * zoomFactor));
            
            const rect = workspace.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            window.panX = mouseX - (mouseX - (window.panX || 0)) * (newScale / oldScale);
            window.panY = mouseY - (mouseY - (window.panY || 0)) * (newScale / oldScale);
            window.scale = newScale;
            
            window.updateCanvasTransform();
            window.updateTethers && window.updateTethers();
        } else {
            // Panning (Two-finger scroll on trackpad / standard mouse wheel)
            e.preventDefault();
            window.panX = (window.panX || 0) - e.deltaX;
            window.panY = (window.panY || 0) - e.deltaY;
            window.updateCanvasTransform();
        }
    }, { passive: false });

    workspace.addEventListener('dblclick', (e) => {
        if (window.lastNodeCreationTime && Date.now() - window.lastNodeCreationTime < 500) return;
        if (e.target.id === 'workspace' || e.target.id === 'canvas-content' || (e.target.tagName === 'svg' && e.target.id === 'tether-layer') || e.target.tagName === 'svg' || e.target.tagName === 'path') {
            const rect = workspace.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const actualX = (mouseX - (window.panX || 0)) / (window.scale || 1);
            const actualY = (mouseY - (window.panY || 0)) / (window.scale || 1);
            window.createNode(actualX, actualY);
            if (window.triggerTutAction) window.triggerTutAction('create_node');
        }
    });

    // Minimap Implementation
    window.toggleMinimap = function() {
        const container = document.getElementById('minimap-container');
        if (container.style.display === 'none' || !container.style.display) {
            container.style.display = 'block';
            window.renderMinimap();
        } else {
            container.style.display = 'none';
        }
    };

    window.renderMinimap = function() {
        const container = document.getElementById('minimap-container');
        if (!container || container.style.display === 'none') return;
        
        const canvas = document.getElementById('minimap-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = container.clientWidth;
        const height = container.clientHeight;
        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, width, height);

        if (!window.nodesMap || window.nodesMap.size === 0) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        window.nodesMap.forEach(node => {
            const nx = parseFloat(node.style.left);
            const ny = parseFloat(node.style.top);
            if (!isNaN(nx) && !isNaN(ny)) {
                minX = Math.min(minX, nx);
                minY = Math.min(minY, ny);
                maxX = Math.max(maxX, nx + node.offsetWidth);
                maxY = Math.max(maxY, ny + node.offsetHeight);
            }
        });

        if (minX === Infinity) return;

        const padding = 60; // Minimal padding so the minimap bounds essentially just the nodes
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        const mapWidth = maxX - minX;
        const mapHeight = maxY - minY;
        
        const scaleX = width / mapWidth;
        const scaleY = height / mapHeight;
        const mapScale = Math.min(scaleX, scaleY);
        
        const offsetX = (width - mapWidth * mapScale) / 2;
        const offsetY = (height - mapHeight * mapScale) / 2;

        // Draw grid lines
        const gridColor = getComputedStyle(document.body).getPropertyValue('--grid-color').trim() || 'rgba(150, 150, 150, 0.15)';
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;

        const gridSize = 40; // Match the actual grid size
        const startLogicalX = minX - (offsetX / mapScale);
        const startLogicalY = minY - (offsetY / mapScale);
        const endLogicalX = startLogicalX + width / mapScale;
        const endLogicalY = startLogicalY + height / mapScale;

        const firstGridX = Math.floor(startLogicalX / gridSize) * gridSize;
        const firstGridY = Math.floor(startLogicalY / gridSize) * gridSize;

        ctx.beginPath();
        for (let lx = firstGridX; lx < endLogicalX; lx += gridSize) {
            const drawX = offsetX + (lx - minX) * mapScale;
            ctx.moveTo(drawX, 0);
            ctx.lineTo(drawX, height);
        }
        for (let ly = firstGridY; ly < endLogicalY; ly += gridSize) {
            const drawY = offsetY + (ly - minY) * mapScale;
            ctx.moveTo(0, drawY);
            ctx.lineTo(width, drawY);
        }
        ctx.stroke();

        // Draw connections
        if (window.edges && window.edges.length > 0) {
            ctx.strokeStyle = 'rgba(150, 150, 150, 0.4)';
            ctx.lineWidth = Math.max(1, 2 * mapScale);
            ctx.beginPath();
            window.edges.forEach(edge => {
                const src = window.nodesMap.get(edge.source);
                const tgt = window.nodesMap.get(edge.target);
                if (src && tgt) {
                    const sx = parseFloat(src.style.left) + src.offsetWidth / 2;
                    const sy = parseFloat(src.style.top) + src.offsetHeight / 2;
                    const tx = parseFloat(tgt.style.left) + tgt.offsetWidth / 2;
                    const ty = parseFloat(tgt.style.top) + tgt.offsetHeight / 2;
                    
                    const drawSX = offsetX + (sx - minX) * mapScale;
                    const drawSY = offsetY + (sy - minY) * mapScale;
                    const drawTX = offsetX + (tx - minX) * mapScale;
                    const drawTY = offsetY + (ty - minY) * mapScale;
                    
                    ctx.moveTo(drawSX, drawSY);
                    ctx.lineTo(drawTX, drawTY);
                }
            });
            ctx.stroke();
        }

        // Draw nodes
        window.nodesMap.forEach(node => {
            const nx = parseFloat(node.style.left);
            const ny = parseFloat(node.style.top);
            const w = node.offsetWidth;
            const h = node.offsetHeight;
            
            const drawX = offsetX + (nx - minX) * mapScale;
            const drawY = offsetY + (ny - minY) * mapScale;
            const drawW = w * mapScale;
            const drawH = h * mapScale;
            
            // Try to match the actual node color or fallback to a solid gray
            let nodeColor = 'rgba(150, 150, 150, 0.8)';
            if (node.dataset.color) {
                switch (node.dataset.color) {
                    case 'blue': nodeColor = 'rgba(59, 130, 246, 0.8)'; break;
                    case 'green': nodeColor = 'rgba(16, 185, 129, 0.8)'; break;
                    case 'purple': nodeColor = 'rgba(168, 85, 247, 0.8)'; break;
                    case 'yellow': nodeColor = 'rgba(245, 158, 11, 0.8)'; break;
                    case 'red': nodeColor = 'rgba(239, 68, 68, 0.8)'; break;
                }
            } else if (node.classList.contains('focused') || node.classList.contains('selected')) {
                nodeColor = 'rgba(59, 130, 246, 0.9)'; // Focus ring color vaguely
            }

            ctx.fillStyle = nodeColor;
            ctx.beginPath();
            ctx.roundRect(drawX, drawY, Math.max(2, drawW), Math.max(2, drawH), 2);
            ctx.fill();
        });

        // Update Viewport Rect
        const viewportBox = document.getElementById('minimap-viewport');
        if (viewportBox) {
            const s = window.scale || 1;
            const px = window.panX || 0;
            const py = window.panY || 0;
            
            const viewCenterX = (window.innerWidth / 2 - px) / s;
            const viewCenterY = (window.innerHeight / 2 - py) / s;
            const viewW = (window.innerWidth / s);
            const viewH = (window.innerHeight / s);
            
            const viewMapX = offsetX + (viewCenterX - viewW/2 - minX) * mapScale;
            const viewMapY = offsetY + (viewCenterY - viewH/2 - minY) * mapScale;
            const viewMapW = viewW * mapScale;
            const viewMapH = viewH * mapScale;
            
            viewportBox.style.left = viewMapX + 'px';
            viewportBox.style.top = viewMapY + 'px';
            viewportBox.style.width = viewMapW + 'px';
            viewportBox.style.height = viewMapH + 'px';
        }
        
        // Store map transform data for interactions
        container._mapTrans = { minX, minY, mapScale, offsetX, offsetY };
    };

    // Setup minimap dragging interactions
    const minimapOverlay = document.getElementById('minimap-overlay');
    if (minimapOverlay) {
        let isDraggingMinimap = false;
        
        const handleMinimapInteraction = (e) => {
            const container = document.getElementById('minimap-container');
            if (!container || !container._mapTrans) return;
            
            const rect = container.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            const trans = container._mapTrans;
            const logicalX = trans.minX + (clickX - trans.offsetX) / trans.mapScale;
            const logicalY = trans.minY + (clickY - trans.offsetY) / trans.mapScale;
            
            const s = window.scale || 1;
            window.panX = window.innerWidth / 2 - logicalX * s;
            window.panY = window.innerHeight / 2 - logicalY * s;
            window.updateCanvasTransform();
        };

        minimapOverlay.addEventListener('pointerdown', (e) => {
            isDraggingMinimap = true;
            minimapOverlay.setPointerCapture(e.pointerId);
            handleMinimapInteraction(e);
        });

        minimapOverlay.addEventListener('pointermove', (e) => {
            if (isDraggingMinimap) {
                handleMinimapInteraction(e);
            }
        });

        minimapOverlay.addEventListener('pointerup', (e) => {
            isDraggingMinimap = false;
            minimapOverlay.releasePointerCapture(e.pointerId);
        });
    }
}
