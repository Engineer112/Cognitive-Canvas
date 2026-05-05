export const state = {
    tabs: [],
    activeTabId: null,
    nodesMap: new Map(),
    nodeSequence: [],
    storyPaths: [],
    activeEditPathId: null,
    compiledPathId: null,
    panX: 0,
    panY: 0,
    scale: 1,
    currentProjectId: null,
    historyStack: [],
    edges: [],
    historyIndex: -1,
    isRestoring: false,
    selectedNodes: new Set(),
    isMarqueeSelecting: false,
    marqueeStartX: 0,
    marqueeStartY: 0,
    baseSelection: new Set(),
    customDictionary: new Set()
};

// Expose these onto window for legacy compatibility where things are overly entangled
Object.keys(state).forEach(key => {
    Object.defineProperty(window, key, {
        get: () => state[key],
        set: (val) => { state[key] = val; }
    });
});
