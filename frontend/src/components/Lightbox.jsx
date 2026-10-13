import { useEffect } from 'react';
import { imgUrl } from '../api.js';

export default function Lightbox({ photo, onClose }) {
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="lightbox" onClick={onClose} role="dialog">
      <img src={imgUrl(photo.url)} alt={photo.caption || ''} />
      {photo.caption && <p>{photo.caption}</p>}
    </div>
  );
}
