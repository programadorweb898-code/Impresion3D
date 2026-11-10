import * as THREE from 'three';

// Typed arrays are transferred once per geometry, including shared instances.
// Preserve world transforms and bounds without rebuilding XML on the UI thread.
export function packModel(root) {
  root.updateMatrixWorld(true);
  const geometries = [],
    meshes = [],
    transfer = [],
    ids = new Map();
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    if (!ids.has(geometry)) {
      geometry.computeBoundingBox();
      const attributes = {};
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        attributes[name] = {
          array: attribute.array,
          itemSize: attribute.itemSize,
          normalized: attribute.normalized,
        };
        transfer.push(attribute.array.buffer);
      }
      ids.set(geometry, geometries.length);
      geometries.push({
        attributes,
        min: geometry.boundingBox.min.toArray(),
        max: geometry.boundingBox.max.toArray(),
      });
    }
    meshes.push({
      geometry: ids.get(geometry),
      matrix: mesh.matrixWorld.toArray(),
      name: mesh.name,
      color: mesh.material.color.toArray(),
      vertexColors: mesh.material.vertexColors,
      userData: mesh.userData,
    });
  });
  const partBounds = root.userData.partBounds
    ? root.userData.partBounds.map((part) => {
        const box = new THREE.Box3(
          new THREE.Vector3(...part.min),
          new THREE.Vector3(...part.max),
        ).applyMatrix4(root.matrixWorld);
        return {
          name: part.name,
          min: box.min.toArray(),
          max: box.max.toArray(),
        };
      })
    : [];
  if (!root.userData.partBounds)
    root.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const box = new THREE.Box3().setFromObject(mesh, true);
      partBounds.push({
        name: mesh.name,
        min: box.min.toArray(),
        max: box.max.toArray(),
      });
    });
  return {
    data: { geometries, meshes, userData: { ...root.userData, partBounds } },
    transfer: [...new Set(transfer)],
  };
}

export function unpackModel(data) {
  const geometries = data.geometries.map((item) => {
    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(item.attributes))
      geometry.setAttribute(
        name,
        new THREE.BufferAttribute(
          attribute.array,
          attribute.itemSize,
          attribute.normalized,
        ),
      );
    geometry.boundingBox = new THREE.Box3(
      new THREE.Vector3(...item.min),
      new THREE.Vector3(...item.max),
    );
    return geometry;
  });
  const root = new THREE.Group();
  root.userData = data.userData;
  for (const item of data.meshes) {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color().fromArray(item.color),
      vertexColors: item.vertexColors,
      roughness: 0.8,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(geometries[item.geometry], material);
    mesh.matrix.fromArray(item.matrix);
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldNeedsUpdate = true;
    mesh.name = item.name;
    mesh.userData = item.userData;
    root.add(mesh);
  }
  return root;
}
