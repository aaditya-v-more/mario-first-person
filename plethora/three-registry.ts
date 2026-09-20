import type * as THREE from 'three';

export let ACESFilmicToneMapping: typeof THREE.ACESFilmicToneMapping;
export let BoxGeometry: typeof THREE.BoxGeometry;
export let BufferGeometry: typeof THREE.BufferGeometry;
export let CanvasTexture: typeof THREE.CanvasTexture;
export let CircleGeometry: typeof THREE.CircleGeometry;
export let Color: typeof THREE.Color;
export let ConeGeometry: typeof THREE.ConeGeometry;
export let CylinderGeometry: typeof THREE.CylinderGeometry;
export let DirectionalLight: typeof THREE.DirectionalLight;
export let DoubleSide: typeof THREE.DoubleSide;
export let Fog: typeof THREE.Fog;
export let Group: typeof THREE.Group;
export let HemisphereLight: typeof THREE.HemisphereLight;
export let InstancedMesh: typeof THREE.InstancedMesh;
export let Material: typeof THREE.Material;
export let MathUtils: typeof THREE.MathUtils;
export let Matrix4: typeof THREE.Matrix4;
export let Mesh: typeof THREE.Mesh;
export let MeshBasicMaterial: typeof THREE.MeshBasicMaterial;
export let MeshPhysicalMaterial: typeof THREE.MeshPhysicalMaterial;
export let MeshStandardMaterial: typeof THREE.MeshStandardMaterial;
export let Object3D: typeof THREE.Object3D;
export let PCFSoftShadowMap: typeof THREE.PCFSoftShadowMap;
export let PerspectiveCamera: typeof THREE.PerspectiveCamera;
export let Quaternion: typeof THREE.Quaternion;
export let RepeatWrapping: typeof THREE.RepeatWrapping;
export let SRGBColorSpace: typeof THREE.SRGBColorSpace;
export let Scene: typeof THREE.Scene;
export let Shape: typeof THREE.Shape;
export let ShapeGeometry: typeof THREE.ShapeGeometry;
export let SphereGeometry: typeof THREE.SphereGeometry;
export let Texture: typeof THREE.Texture;
export let TorusGeometry: typeof THREE.TorusGeometry;
export let Vector3: typeof THREE.Vector3;
export let WebGLRenderer: typeof THREE.WebGLRenderer;

export function setThree(module: unknown) {
  ({
    ACESFilmicToneMapping,
    BoxGeometry,
    BufferGeometry,
    CanvasTexture,
    CircleGeometry,
    Color,
    ConeGeometry,
    CylinderGeometry,
    DirectionalLight,
    DoubleSide,
    Fog,
    Group,
    HemisphereLight,
    InstancedMesh,
    Material,
    MathUtils,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    Object3D,
    PCFSoftShadowMap,
    PerspectiveCamera,
    Quaternion,
    RepeatWrapping,
    SRGBColorSpace,
    Scene,
    Shape,
    ShapeGeometry,
    SphereGeometry,
    Texture,
    TorusGeometry,
    Vector3,
    WebGLRenderer,
  } = module as typeof THREE);
}
