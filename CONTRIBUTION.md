# Contributing to Game Engine Build

Welcome! This document outlines the core developer standards, dynamically loaded dependencies, and architectural mechanics required to maintain the advanced implementation of the Game Engine Build component.

---

## Core Architecture Pillars

1. **Modular WebGL Architecture**:
   * All WebGL configuration, matrix calculations, and buffer mappings are strictly encapsulated in `src/utils/webglHelpers.js`.
   * High-frequency render loop math resides inside optimized JS structures, decoupled from Preact state lifecycles to maintain 60 FPS performance.

2. **Pointer Lock & Event Handling**:
   * Global key listeners, mouse movements, scrolling, and touch events are processed in `src/utils/inputListeners.js`.
   * Clear boundaries ensure event listeners are registered and disposed of correctly on component lifecycle changes.

3. **Dynamic Component & View Texturing**:
   * Texturing mechanisms (including offscreen rendering of live Datacore view components using `html2canvas` and dynamic Lottie vector playback) reside in `src/utils/gameHelpers.js`.

---

## Local Compilation & Developer Loop

* **Logic Entry Point**: The core UI structure and overlay panels are orchestratred in `src/App.jsx`.
* **Loader Bootstrapper**: The dynamic requires and entry resolution reside in `src/index.jsx`.
* **Hot Reload Trigger**: Invoke `dc.app.workspace.activeLeaf.rebuildView()` to flush the view cache. The visualizer compiles your changes instantly without a full application restart.
