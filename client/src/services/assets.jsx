// assets.js — the Higgsfield art seam. Every image the game shows resolves
// through here; if a file hasn't been generated yet the <Art> component
// degrades to a styled placeholder, so the game is playable art-or-no-art.

import { useState } from 'react';

export const imageUrl = (name) => `/assets/images/${name}`;

export function Art({ name, alt, className }) {
  const [missing, setMissing] = useState(false);
  if (!name || missing) {
    return <div className={`art art-missing ${className || ''}`} role="img" aria-label={alt} />;
  }
  return (
    <img
      className={`art ${className || ''}`}
      src={imageUrl(name)}
      alt={alt}
      onError={() => setMissing(true)}
    />
  );
}
