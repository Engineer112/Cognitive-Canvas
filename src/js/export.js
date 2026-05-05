import { Document, Paragraph, TextRun, Packer } from "docx";
import html2canvas from "html2canvas";

window.compileStory = function() {
    const textDiv = document.getElementById('compiled-text');
    if (!textDiv) return;
    
    let parts = [];
    window.nodeSequence.forEach(id => {
        const node = window.nodesMap.get(id);
        if (node) {
            const editor = node.querySelector('.editor');
            if (editor) {
                // simple innerText is generally fine for a draft
                parts.push(editor.innerText);
            }
        }
    });

    textDiv.innerText = parts.join('\n\n');
    document.getElementById('compile-modal').style.display = 'flex';
};

window.downloadDraft = function() {
    const text = document.getElementById('compiled-text').innerText;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const title = document.getElementById('project-name').value || 'Draft';
    a.download = title + '.txt';
    a.click();
    URL.revokeObjectURL(url);
};

window.downloadDocx = async function() {
    const text = document.getElementById('compiled-text').innerText;
    const paras = text.split('\n\n').map(p => new Paragraph({
        children: [new TextRun(p)]
    }));

    const doc = new Document({
        sections: [{
            properties: {},
            children: paras
        }]
    });

    try {
        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const title = document.getElementById('project-name').value || 'Draft';
        a.download = title + '.docx';
        a.click();
        URL.revokeObjectURL(url);
        window.showToast("Word document saved!", false);
    } catch (e) {
        console.error(e);
        window.showToast("Failed to generate docx.", true);
    }
};

window.exportProject = function() {
    window.saveCurrentTabState();
    const tab = window.tabs.find(t => t.id === window.activeTabId);
    if (!tab) return;
    
    // We need to serialize nodesMap properly
    const nodes = [];
    tab.nodesMap.forEach((node, id) => {
        const isImage = node.classList.contains('image-node');
        const imgEl = node.querySelector('.node-image');
        const titleInput = node.querySelector('.node-title-input');
        nodes.push({
            id: id,
            type: isImage ? 'image' : 'text',
            src: isImage && imgEl ? imgEl.src : null,
            title: titleInput ? titleInput.value : '',
            text: node.querySelector('.editor').innerHTML, 
            x: parseFloat(node.style.left),
            y: parseFloat(node.style.top),
            width: node.style.width || node.offsetWidth + 'px',
            align: node.querySelector('.editor').style.textAlign || 'left',
            color: node.getAttribute('data-color') || 'default'
        });
    });

    const projectData = {
        name: tab.name,
        nodes: nodes,
        nodeSequence: tab.nodeSequence,
        edges: tab.edges,
        storyPaths: tab.storyPaths,
        activeEditPathId: tab.activeEditPathId,
        compiledPathId: tab.compiledPathId
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = (tab.name || 'Project') + '.cvas';
    a.click();
};

window.importProject = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            window.addNewTab();
            document.getElementById('project-name').value = data.name || "Imported Project";
            
            // clear the newly added tab's canvas
            window.nodesMap.forEach(n => n.remove());
            window.nodesMap.clear();
            
            window.nodeSequence = data.nodeSequence || [];
            window.edges = data.edges || [];
            if (data.storyPaths) {
                window.storyPaths = data.storyPaths;
                window.activeEditPathId = data.activeEditPathId;
                window.compiledPathId = data.compiledPathId;
            }

            if (data.nodes) {
                data.nodes.forEach(nData => {
                    if (window.createNode) {
                        window.createNode(nData.x, nData.y, nData.text || '', nData.id, nData.color, true, nData.width, nData.title, nData.type || 'text', nData.src, nData.align);
                    }
                });
            }
            window.saveState();
            window.updateTethers && window.updateTethers();
            document.getElementById('dashboard-modal').style.display = 'none';
        } catch(err) {
            window.showToast("Invalid project file format", true);
        }
    };
    reader.readAsText(file);
    event.target.value = null;
};

window.handleImageUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const cx = (window.innerWidth / 2 - window.panX) / window.scale - 150;
        const cy = (window.innerHeight / 2 - window.panY) / window.scale - 20;
        window.createNode(cx, cy, "", null, null, false, "300px", "", "image", e.target.result);
        window.saveState();
    };
    reader.readAsDataURL(file);
    event.target.value = null;
};

window.takeSnapshot = async function() {
    window.showToast("Taking snapshot...", false);
    document.body.classList.add('hide-ui-for-snapshot');
    try {
        const canvas = await html2canvas(document.getElementById('workspace'), {
            useCORS: true,
            allowTaint: true,
            backgroundColor: null
        });
        const url = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = (document.getElementById('project-name').value || "snapshot") + ".png";
        a.click();
    } catch(e) {
        console.error(e);
        window.showToast("Failed to take snapshot.", true);
    }
    document.body.classList.remove('hide-ui-for-snapshot');
};

