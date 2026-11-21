import { useRef, useState } from 'react';
import { createDraftMap, uploadDxf } from '../../services/api';
import MapDraftEditor from './MapDraftEditor';
import './MapUploadControl.css';

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 800;
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Could not prepare the floor-plan image.'));
          return;
        }
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      image.onerror = () => reject(new Error('The selected file is not a readable floor-plan image.'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

async function hasSupportedImageSignature(file, extension) {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (extension === 'png') {
    return bytes.length === 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }
  return extension === 'jpg' || extension === 'jpeg'
    ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : false;
}

export default function MapUploadControl({ onActivateMap }) {
  const fileInput = useRef(null);
  const [imageDraft, setImageDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    setNotice('');
    if (file.size > 15 * 1024 * 1024) {
      setError('Choose a file smaller than 15 MB.');
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'dxf') {
      setBusy(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await uploadDxf(formData);
        const mapData = response.data.mapData || response.data;
        await onActivateMap(mapData);
        setNotice(`Loaded ${file.name}. Review the plotted areas and exits on the map.`);
      } catch (uploadError) {
        setError(uploadError.response?.data?.error || uploadError.response?.data?.detail || uploadError.message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!['png', 'jpg', 'jpeg'].includes(extension)) {
      setError('Upload a DXF, PNG, or JPG floor plan.');
      return;
    }

    try {
      if (!await hasSupportedImageSignature(file, extension)) {
        setError('The selected file does not match its PNG or JPG extension.');
        return;
      }
      const imageData = await readImage(file);
      setImageDraft(imageData);
    } catch (readError) {
      setError(readError.message);
    }
  }

  async function createImageMap(graph) {
    try {
      const response = await createDraftMap(graph);
      const mapData = response.data.mapData || response.data;
      await onActivateMap(mapData);
      setImageDraft(null);
      setNotice('Floor-plan draft created. Select areas to run map-based simulations.');
    } catch (createError) {
      const detail = createError.response?.data?.error || createError.response?.data?.detail;
      throw new Error(typeof detail === 'string' ? detail : createError.message);
    }
  }

  return (
    <>
      <div className="map-upload-control">
        <input
          ref={fileInput}
          type="file"
          accept=".dxf,.png,.jpg,.jpeg,image/png,image/jpeg"
          onChange={handleFileChange}
          className="map-upload-input"
          aria-label="Upload a DXF, PNG, or JPG floor plan"
        />
        <button
          type="button"
          className="map-upload-button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
        >
          <span aria-hidden="true">＋</span>
          {busy ? 'Importing plan…' : 'Import floor plan'}
        </button>
        <span className="map-upload-formats">DXF · PNG · JPG</span>
      </div>
      {(error || notice) && (
        <p className={`map-upload-feedback ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>
          {error || notice}
        </p>
      )}
      {imageDraft && (
        <MapDraftEditor
          imageData={imageDraft}
          onCancel={() => setImageDraft(null)}
          onCreate={createImageMap}
        />
      )}
    </>
  );
}
