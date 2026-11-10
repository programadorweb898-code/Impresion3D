import { parseLocalMesh } from './local-model-parser.js';
import { packModel } from './model-transfer.js';

self.onmessage = ({ data: { buffer, format } }) => {
  try {
    const root = parseLocalMesh(buffer, format);
    const packed = packModel(root);
    self.postMessage(packed.data, packed.transfer);
  } catch (error) {
    self.postMessage({
      error: error.isModelError
        ? error.message
        : 'El archivo no contiene un modelo 3D válido.',
    });
  }
};
