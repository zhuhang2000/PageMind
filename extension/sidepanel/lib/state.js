let _lastResult = null;
let _savedPrompts = [];
let _editingPromptId = "";
let _attachedImages = [];
let _currentPageData = null;
let _contentModules = [];
let _selectedModuleIds = new Set();
let _activeFullContentModuleId = "";
let _fullContentDirty = false;
let _activeFullContentAction = "";
let _pendingFullContentSelections = [];
let _activeFullContentTextContent = "";

export function getLastResult() { return _lastResult; }
export function setLastResult(v) { _lastResult = v; }

export function getSavedPrompts() { return _savedPrompts; }
export function setSavedPrompts(v) { _savedPrompts = v; }

export function getEditingPromptId() { return _editingPromptId; }
export function setEditingPromptId(v) { _editingPromptId = v; }

export function getAttachedImages() { return _attachedImages; }
export function setAttachedImages(v) { _attachedImages = v; }

export function getCurrentPageData() { return _currentPageData; }
export function setCurrentPageDataRaw(v) { _currentPageData = v; }

export function getContentModules() { return _contentModules; }
export function setContentModules(v) { _contentModules = v; }

export function getSelectedModuleIds() { return _selectedModuleIds; }
export function setSelectedModuleIds(v) { _selectedModuleIds = v; }

export function getActiveFullContentModuleId() { return _activeFullContentModuleId; }
export function setActiveFullContentModuleId(v) { _activeFullContentModuleId = v; }

export function getFullContentDirty() { return _fullContentDirty; }
export function setFullContentDirty(v) { _fullContentDirty = v; }

export function getActiveFullContentAction() { return _activeFullContentAction; }
export function setActiveFullContentAction(v) { _activeFullContentAction = v; }

export function getPendingFullContentSelections() { return _pendingFullContentSelections; }
export function setPendingFullContentSelections(v) { _pendingFullContentSelections = v; }

export function getActiveFullContentTextContent() { return _activeFullContentTextContent; }
export function setActiveFullContentTextContent(v) { _activeFullContentTextContent = v; }
