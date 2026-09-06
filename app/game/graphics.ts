import * as THREE from 'three';

// Keep the original material objects: question blocks swap them during play.
export function enhanceMaterials(scene: THREE.Scene) {
  const originals = new Map<THREE.MeshStandardMaterial, {
    roughness: number; metalness: number; envMapIntensity: number;
    emissive: THREE.Color; emissiveIntensity: number;
  }>();
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial) || originals.has(material)) continue;
      originals.set(material, {
        roughness: material.roughness, metalness: material.metalness,
        envMapIntensity: material.envMapIntensity, emissive: material.emissive.clone(),
        emissiveIntensity: material.emissiveIntensity,
      });
      const color = material.color.getHexString();
      if (['ffca2d', 'ffe483', 'e39c09'].includes(color)) {
        material.metalness = .82;
        material.roughness = .18;
        material.emissive.copy(material.color);
        material.emissiveIntensity = .04;
        material.envMapIntensity = 1.6;
      } else if (['159341', '24bf55'].includes(color)) {
        material.metalness = .28;
        material.roughness = .2;
        material.envMapIntensity = 1.3;
      }
      material.needsUpdate = true;
    }
  });
  return () => {
    for (const [material, original] of originals) {
      material.roughness = original.roughness;
      material.metalness = original.metalness;
      material.envMapIntensity = original.envMapIntensity;
      material.emissive.copy(original.emissive);
      material.emissiveIntensity = original.emissiveIntensity;
      material.needsUpdate = true;
    }
    originals.clear();
  };
}

// Cap the optional passes by total pixels as well as DPR on large displays.
export function graphicsPixelRatio(width: number, height: number, deviceRatio: number) {
  return Math.min(deviceRatio, 1.5, Math.sqrt(2_000_000 / Math.max(1, width * height)));
}
