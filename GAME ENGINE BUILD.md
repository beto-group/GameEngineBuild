---
author: beto.group
name.official: Game Engine Build
price: "0"
category:
  - visualization
platform: desktop
tags:
  - game-engine
  - 3d
  - webgl
  - sandbox
  - texture-projection
  - first-person
  - interactive
  - html2canvas
desc: A first-person 3D sandbox engine allowing users to build with primitives and project live Datacore components onto surfaces as dynamic textures.
status: experimental
complexity: advanced
id: 14
resources:
  - gameenginebuild.clip.gif
  - game_engine_build_1.webp
  - game_engine_build_2.webp
longDesc: A full-featured, first-person interactive 3D environment built with WebGL that functions as a "sandbox" world inside an Obsidian note. It allows users to navigate a 3D space, spawn and manipulate primitive objects, and, most uniquely, project images, Lottie animations, and even other live Datacore components onto surfaces as dynamic textures.
version.obsidian: 1.4.11
version: 2.0.1
---

```datacorejsx
const activeFile = dc.resolvePath("GAME ENGINE BUILD") || "_RESOURCES/DATACORE/_DONE/GAME ENGINE BUILD/GAME ENGINE BUILD";
const folderPath = activeFile.substring(0, activeFile.lastIndexOf('/'));
const { View } = await dc.require(folderPath + "/src/index.jsx");

return <View folderPath={folderPath} />;
```
