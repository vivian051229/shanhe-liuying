export const LAYER = 512;
function decode(src) {
  return new Promise((res, rej) => { const img = new Image(); img.decoding = 'async'; img.onload = () => res(img); img.onerror = () => rej(new Error(`Could not load photo: ${src}`)); img.src = src; });
}
export async function loadTextures(gl, photos, onProgress) {
  const limit = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);
  if (photos.length > limit) throw new Error(`This device supports at most ${limit} photos; the catalog has ${photos.length}.`);
  const arrTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, arrTex);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, LAYER, LAYER, photos.length);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const scratch = document.createElement('canvas'); scratch.width = scratch.height = LAYER;
  const ctx = scratch.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  // Initialize neutral images so the curtain can render before downloads complete.
  ctx.fillStyle = '#5c4438';ctx.fillRect(0,0,LAYER,LAYER);
  for(let i=0;i<photos.length;i++) gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,i,LAYER,LAYER,1,gl.RGBA,gl.UNSIGNED_BYTE,scratch);
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
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY,0,0,0,i,LAYER,LAYER,1,gl.RGBA,gl.UNSIGNED_BYTE,scratch);
        gl.activeTexture(active);
      } catch(err) { console.warn(err.message); }
      onProgress(++done / photos.length);
    }
  };
  // A slow or missing photograph must not block opening the work.
  void Promise.all(Array.from({length:6},worker));
  return arrTex;
}
