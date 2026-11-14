// Affiche les calques plein écran (recadrage, visionneuse, extrait vidéo) au-dessus de l'app.
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { currentOverlays, subscribeOverlays } from './overlays.js';
import { Cropper } from './Cropper.jsx';
import { Lightbox } from './Lightbox.jsx';
import { VideoTrim } from './VideoTrim.jsx';

const COMPONENTS = { cropper: Cropper, lightbox: Lightbox, videotrim: VideoTrim };

export function OverlayHost() {
  const overlays = useSyncExternalStore(subscribeOverlays, currentOverlays);
  return overlays.map(({ id, type, props }) => {
    const Component = COMPONENTS[type];
    return createPortal(<Component key={id} {...props} />, document.body, String(id));
  });
}
