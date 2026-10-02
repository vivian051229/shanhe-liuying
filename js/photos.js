export const LAYER = 256;
export const ATLAS_CELLS = 4;
function decode(src) {
  return new Promise((res, rej) => { const img = new Image(); img.decoding = 'async'; img.onload = () => res(img); img.onerror = () => rej(new Error(`Could not load photo: ${src}`)); img.src = src; });
}
export async function loadTextures(gl, photos, onProgress) {
  const limit = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);
  const depth = Math.ceil(photos.length / ATLAS_CELLS);
  if (depth > limit) throw new Error(`This device supports at most ${limit} photos; the catalog needs ${depth} texture layers.`);
  const arrTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, arrTex);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, LAYER * 2, LAYER * 2, depth);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const scratch = document.createElement('canvas'); scratch.width = scratch.height = LAYER * 2;
  const ctx = scratch.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  // Initialize neutral images so the curtain can render before downloads complete.
  ctx.fillStyle = '#160d0b';ctx.fillRect(0,0,LAYER*2,LAYER*2);
  for(let i=0;i<depth;i++) gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,i,LAYER*2,LAYER*2,1,gl.RGBA,gl.UNSIGNED_BYTE,scratch);
  // Bundle existing WebP bytes unchanged: six requests, with no extra compression.
  const bundles = new Map();
  if (photos.every(p => p.previewBundle)) {
    for(let i=0;i<photos.length;i+=4) {
      const p=photos[i];
      if(!bundles.has(p.previewBundle)) bundles.set(p.previewBundle,[]);
      bundles.get(p.previewBundle).push({layer:Math.floor(i/4),p});
    }
    let done=0;
    const upload = img => {
      ctx.clearRect(0,0,512,512);ctx.drawImage(img,0,0,512,512);
    };
    void Promise.all([...bundles].map(async ([src,layers]) => {
      let data;
      try {const response=await fetch(src);if(!response.ok)throw new Error('Preview bundle unavailable');data=await response.arrayBuffer();} catch(err) {console.warn(err.message);}
      for(const {layer,p} of layers) {
        let url;
        try {
          url=data ? URL.createObjectURL(new Blob([data.slice(p.previewBundleOffset,p.previewBundleOffset+p.previewBundleLength)],{type:'image/webp'})) : p.previewAtlas;
          const img=await decode(url);upload(img);
          const active=gl.getParameter(gl.ACTIVE_TEXTURE);
          gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D_ARRAY,arrTex);
          gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,layer,512,512,1,gl.RGBA,gl.UNSIGNED_BYTE,scratch);
          gl.activeTexture(active);
        } catch(err) {console.warn(err.message);} finally {if(data && url)URL.revokeObjectURL(url);}
        onProgress(++done/depth);
      }
    }));
    return arrTex;
  }
  // Four photos share one download, already arranged for a single GPU upload.
  const hasAtlases = photos.every((p,i) => p.previewAtlas && p.previewAtlasCell === i % 4 && (i % 4 === 0 || p.previewAtlas === photos[i-i%4].previewAtlas));
  if (hasAtlases) {
    const queue = Array.from({length:depth}, (_,i)=>i);
    let loaded = 0;
    const worker = async () => {
      while(queue.length) {
        const layer = queue.shift();
        try {
          const img = await decode(photos[layer*4].previewAtlas);
          ctx.clearRect(0,0,LAYER*2,LAYER*2);ctx.drawImage(img,0,0,LAYER*2,LAYER*2);
          const active=gl.getParameter(gl.ACTIVE_TEXTURE);
          gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D_ARRAY,arrTex);
          gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,layer,LAYER*2,LAYER*2,1,gl.RGBA,gl.UNSIGNED_BYTE,scratch);
          gl.activeTexture(active);
        } catch(err) {console.warn(err.message);}
        onProgress(++loaded/depth);
      }
    };
    void Promise.all(Array.from({length:8},worker));
    return arrTex;
  }
  scratch.width = scratch.height = LAYER;
  let done = 0;
  const queue = photos.map((_, i) => i);
  const worker = async () => {
    while (queue.length) {
      const i = queue.shift();
      try {
        const img = await decode(photos[i].preview ?? photos[i].src);
        ctx.clearRect(0,0,LAYER,LAYER);ctx.drawImage(img,0,0,LAYER,LAYER);
        // Upload without changing the render loop's active texture unit.
        const active=gl.getParameter(gl.ACTIVE_TEXTURE);
        gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D_ARRAY,arrTex);
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,(i%2)*LAYER,Math.floor((i%4)/2)*LAYER,Math.floor(i/4),LAYER,LAYER,1,gl.RGBA,gl.UNSIGNED_BYTE,scratch);
        gl.activeTexture(active);
      } catch(err) { console.warn(err.message); }
      onProgress(++done / photos.length);
    }
  };
  // A slow or missing photograph must not block opening the work.
  void Promise.all(Array.from({length:6},worker));
  return arrTex;
}
