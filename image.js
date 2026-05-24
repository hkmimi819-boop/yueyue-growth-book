/**
 * 将照片压缩为 JPEG Base64，便于存入加密云端（兼容 iPhone 大图）
 */
(function (global) {
  'use strict';

  const DEFAULTS = {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.82,
    maxDataUrlLength: 900000,
  };

  function loadImageElement(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('无法读取照片，请换一张或重新拍摄'));
      };
      img.src = url;
    });
  }

  async function loadBitmap(file) {
    if (typeof createImageBitmap === 'function') {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (_) {
        /* 部分格式回退到 Image */
      }
    }
    return loadImageElement(file);
  }

  function drawToDataUrl(source, maxWidth, maxHeight, quality) {
    const srcW = source.width;
    const srcH = source.height;
    const scale = Math.min(1, maxWidth / srcW, maxHeight / srcH);
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(source, 0, 0, w, h);

    if (source.close) source.close();

    return canvas.toDataURL('image/jpeg', quality);
  }

  async function compressOnce(file, opts) {
    const maxWidth = opts.maxWidth ?? DEFAULTS.maxWidth;
    const maxHeight = opts.maxHeight ?? DEFAULTS.maxHeight;
    const quality = opts.quality ?? DEFAULTS.quality;
    const bitmap = await loadBitmap(file);
    return drawToDataUrl(bitmap, maxWidth, maxHeight, quality);
  }

  function isImageFile(file) {
    if (!file) return false;
    if (file.type && file.type.startsWith('image/')) return true;
    return /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(file.name || '');
  }

  async function compress(file, options) {
    if (!isImageFile(file)) {
      throw new Error('请选择图片文件');
    }

    let quality = options?.quality ?? DEFAULTS.quality;
    const maxLen = options?.maxDataUrlLength ?? DEFAULTS.maxDataUrlLength;
    let result = await compressOnce(file, { ...options, quality });

    while (result.length > maxLen && quality > 0.45) {
      quality = Math.round((quality - 0.08) * 100) / 100;
      result = await compressOnce(file, { ...options, quality });
    }

    return result;
  }

  global.BabyBookImage = { compress };
})(window);
